import type { SubscriptionRow } from '@/lib/services/subscription-service';
import {
  calculateMonthlySpend,
  calculateAnnualSpend,
  calculatePotentialSavings,
  getNormalizedMonthlyPrice,
  formatCurrency,
} from '@/lib/utils/metrics-utils';

export type AssistantTopic =
  | 'bills_overview'
  | 'bills_tracking'
  | 'bills_receipts'
  | 'bills_categories'
  | 'bills_manual'
  | 'bills_data'
  | 'subscription_overview'
  | 'subscription_spending'
  | 'subscription_renewals'
  | 'subscription_price_changes'
  | 'subscription_usage'
  | 'cancellation'
  | 'savings'
  | 'duplicates'
  | 'review'
  | 'general';

export interface ConversationContext {
  lastMentionedSub?: SubscriptionRow | null;
  lastMentionedBillCategory?: string | null;
  lastTopic?: AssistantTopic | null;
  lastAnswerText?: string;
  lastCalculationDetail?: string;
  previousQuery?: string;
}

export interface AssistantResponse {
  responseText: string;
  relatedSubs?: SubscriptionRow[];
  nextContext: ConversationContext;
}

/**
 * Intelligent hybrid assistant engine for SubHalt.
 * Supports multi-topic intent routing (Subscriptions, Bills & Payments, Product Features),
 * multi-turn conversation memory, correction detection, deterministic calculations,
 * and data-grounded responses without generic fallback dumps.
 */
export function processAssistantQuery(
  query: string,
  subscriptions: SubscriptionRow[],
  currentContext: ConversationContext = {},
  options: { defaultCurrency: string; exchangeRates?: Record<string, number> }
): AssistantResponse {
  const { defaultCurrency, exchangeRates } = options;
  const qTrimmed = query.trim();
  const qLower = qTrimmed.toLowerCase();

  const allSubs = subscriptions || [];
  const activeSubs = allSubs.filter(
    (s) => s.status === 'active' || s.status === 'trial'
  );

  const prevTopic = currentContext.lastTopic || null;

  // ----------------------------------------------------
  // 1. CORRECTION DETECTION ("You didn't answer my question")
  // ----------------------------------------------------
  const isCorrection =
    qLower.includes("didn't answer my question") ||
    qLower.includes("didn't answer") ||
    qLower.includes("not what i asked") ||
    qLower.includes("not what i meant") ||
    qLower.includes("no, i mean") ||
    qLower.includes("you're not answering") ||
    qLower.includes("that wasn't my question") ||
    qLower.includes("explain that again");

  if (isCorrection) {
    const prevQuery = currentContext.previousQuery?.toLowerCase() || '';

    // If previous query or context was about bills, correct to Bills explanation
    if (prevQuery.includes('bill') || prevTopic?.startsWith('bills_')) {
      const correctionDetail =
        "You're right — I answered about your subscriptions instead of Bills & Payments. SubHalt's Bills & Payments feature helps you record, organize, and track payments such as electricity, internet, airtime, rent, education, and other utility bills. SubHalt does not process the payment itself—you make payments as normal and use SubHalt to keep receipt history organized. You can capture receipts from connected email where supported, add payments manually, or upload a receipt file.";
      return {
        responseText: correctionDetail,
        nextContext: {
          ...currentContext,
          lastTopic: 'bills_overview',
          lastAnswerText: correctionDetail,
          previousQuery: qTrimmed,
        },
      };
    }

    // Default correction acknowledgment
    const generalCorrection =
      "You're right — I misunderstood your previous question. Could you clarify whether you'd like help with Bills & Payments, subscription management, or a specific feature in SubHalt?";
    return {
      responseText: generalCorrection,
      nextContext: {
        ...currentContext,
        lastTopic: 'general',
        lastAnswerText: generalCorrection,
        previousQuery: qTrimmed,
      },
    };
  }

  // ----------------------------------------------------
  // 2. BILLS & PAYMENTS INTENTS
  // ----------------------------------------------------
  const mentionsBillsExplicitly =
    qLower.includes('bill') ||
    qLower.includes('electricity') ||
    qLower.includes('airtime') ||
    qLower.includes('internet') ||
    qLower.includes('rent') ||
    qLower.includes('utility') ||
    qLower.includes('receipt');

  const inBillsContext = prevTopic?.startsWith('bills_');

  if (mentionsBillsExplicitly || inBillsContext) {
    // 2a. Bill Overview / How Bills Payment Works
    if (
      qLower.includes('what about bills') ||
      qLower.includes('explain better') ||
      qLower.includes('bills section') ||
      qLower.includes('bills payment work') ||
      qLower.includes('what is bills') ||
      qLower.includes('how does bills') ||
      qLower.includes('how do bills') ||
      (qLower.includes('bills') && qLower.includes('overview'))
    ) {
      const detail =
        "Bills & Payments is separate from your subscriptions. It helps you organize and track payments such as electricity, internet, airtime, rent, education, insurance, and custom bills. SubHalt does not process payments directly—you pay providers through your normal channels and use SubHalt to record payments, store receipts, and track payment history. If an email receipt is available, SubHalt uses connected email information where supported; otherwise, you can add payments manually or upload receipt files.";
      return {
        responseText: detail,
        nextContext: {
          ...currentContext,
          lastTopic: 'bills_overview',
          lastAnswerText: detail,
          previousQuery: qTrimmed,
        },
      };
    }

    // 2b. Personal Bill Data Query ("How much did I spend on electricity?", "Show my bills")
    if (
      qLower.includes('how much did i spend') ||
      qLower.includes('how much have i spent') ||
      qLower.includes('show my bills') ||
      qLower.includes('what bills have i paid') ||
      qLower.includes('my bill payments')
    ) {
      const detail =
        "I don't have any recorded bill payments from you yet. You can record your first payment by visiting the Bills & Payments section.";
      return {
        responseText: detail,
        nextContext: {
          ...currentContext,
          lastTopic: 'bills_data',
          lastAnswerText: detail,
          previousQuery: qTrimmed,
        },
      };
    }

    // 2c. Bill Tracking Specific Categories (Electricity, Internet, Airtime, Rent, etc.)
    if (
      qLower.includes('track') ||
      qLower.includes('electricity') ||
      qLower.includes('airtime') ||
      qLower.includes('internet') ||
      qLower.includes('rent') ||
      qLower.includes('what bills can i')
    ) {
      if (qLower.includes('electricity')) {
        const detail =
          "Yes! You can track electricity payments in SubHalt. You can record prepaid tokens or postpaid electricity bills, set the provider (like IKEDC, EKEDC, etc.), enter the amount paid, and attach PDF or photo receipts for your records.";
        return {
          responseText: detail,
          nextContext: {
            ...currentContext,
            lastTopic: 'bills_tracking',
            lastMentionedBillCategory: 'Electricity',
            lastAnswerText: detail,
            previousQuery: qTrimmed,
          },
        };
      }

      const detail =
        "Yes! You can track electricity, internet, airtime/mobile data, rent, education, insurance, software, and any custom bill types in SubHalt. When you pay a bill, you can log the payment date, provider, amount, and attach a receipt.";
      return {
        responseText: detail,
        nextContext: {
          ...currentContext,
          lastTopic: 'bills_tracking',
          lastAnswerText: detail,
          previousQuery: qTrimmed,
        },
      };
    }

    // 2c. Receipt Saving & Uploads
    if (
      qLower.includes('receipt') ||
      qLower.includes('save a receipt') ||
      qLower.includes('upload')
    ) {
      const detail =
        "Yes! You can save and attach receipts (PDF files or images) to any recorded bill payment. SubHalt stores your receipts securely so you can view your full payment proof history whenever you need it.";
      return {
        responseText: detail,
        nextContext: {
          ...currentContext,
          lastTopic: 'bills_receipts',
          lastAnswerText: detail,
          previousQuery: qTrimmed,
        },
      };
    }

    // 2d. Missing Email / Manual Entry
    if (
      qLower.includes("doesn't send me an email") ||
      qLower.includes("don't receive an email") ||
      qLower.includes("no email") ||
      qLower.includes('manual') ||
      qLower.includes('add manually')
    ) {
      const detail =
        "If a provider doesn't send an email receipt, you can easily add the payment manually in SubHalt. Simply open Bills & Payments, click 'Record Payment', enter the provider name, amount, and payment date. You can also upload a photo or PDF of your receipt anytime.";
      return {
        responseText: detail,
        nextContext: {
          ...currentContext,
          lastTopic: 'bills_manual',
          lastAnswerText: detail,
          previousQuery: qTrimmed,
        },
      };
    }

    // 2e. Custom Categories
    if (
      qLower.includes('custom') ||
      qLower.includes("isn't in the categories") ||
      qLower.includes('not in categories') ||
      qLower.includes('custom category')
    ) {
      const detail =
        "Yes! SubHalt supports standard bill categories (Electricity, Internet, Airtime, Rent, Education, etc.) as well as custom categories. If your bill type isn't listed, you can type a custom category name when recording your payment.";
      return {
        responseText: detail,
        nextContext: {
          ...currentContext,
          lastTopic: 'bills_categories',
          lastAnswerText: detail,
          previousQuery: qTrimmed,
        },
      };
    }

    // 2f. Personal Bill Data Query ("How much did I spend on electricity?")
    if (
      qLower.includes('how much did i spend') ||
      qLower.includes('show my bills') ||
      qLower.includes('what bills have i paid') ||
      qLower.includes('my bill payments')
    ) {
      const detail =
        "I don't have any recorded bill payments from you yet. You can record your first payment by visiting the Bills & Payments section.";
      return {
        responseText: detail,
        nextContext: {
          ...currentContext,
          lastTopic: 'bills_data',
          lastAnswerText: detail,
          previousQuery: qTrimmed,
        },
      };
    }
  }

  // ----------------------------------------------------
  // 3. SUBSCRIPTION ENTITY MATCHING
  // ----------------------------------------------------
  let matchedSub: SubscriptionRow | null = null;
  for (const sub of allSubs) {
    if (qLower.includes(sub.name.toLowerCase())) {
      matchedSub = sub;
      break;
    }
  }

  const referencesItOrThat =
    /\b(it|that|this|the service|the subscription|this service|this plan)\b/i.test(qLower);

  if (!matchedSub && referencesItOrThat && currentContext.lastMentionedSub) {
    matchedSub = currentContext.lastMentionedSub;
  }

  const monthlyTotal = calculateMonthlySpend(activeSubs, defaultCurrency, exchangeRates);
  const annualTotal = calculateAnnualSpend(activeSubs);

  // ----------------------------------------------------
  // 4. CONFIRMATION CHECK ("Are you sure?")
  // ----------------------------------------------------
  if (
    qLower.includes('are you sure') ||
    qLower.includes('is that correct') ||
    qLower.includes('is that right') ||
    qLower.includes('double check') ||
    qLower.includes('how did you calculate')
  ) {
    if (currentContext.lastCalculationDetail) {
      return {
        responseText: `Yes, I am certain. ${currentContext.lastCalculationDetail}`,
        relatedSubs: currentContext.lastMentionedSub ? [currentContext.lastMentionedSub] : undefined,
        nextContext: { ...currentContext, previousQuery: qTrimmed },
      };
    }

    if (currentContext.lastMentionedSub) {
      const sub = currentContext.lastMentionedSub;
      const subMonthly = getNormalizedMonthlyPrice(sub);
      const subAnnual = subMonthly * 12;
      return {
        responseText: `Yes, I calculated that directly from your recorded active plan for ${sub.name} (${formatCurrency(sub.price, sub.currency || defaultCurrency)}/${sub.billing_cycle}, which normalized is ${formatCurrency(subMonthly, defaultCurrency)}/month and ${formatCurrency(subAnnual, defaultCurrency)}/year).`,
        relatedSubs: [sub],
        nextContext: { ...currentContext, previousQuery: qTrimmed },
      };
    }

    return {
      responseText: `Yes, I confirm that calculation. It is calculated deterministically from your ${activeSubs.length} active subscription record${activeSubs.length === 1 ? '' : 's'} in SubHalt (totaling ${formatCurrency(monthlyTotal, defaultCurrency)}/month).`,
      relatedSubs: activeSubs.slice(0, 3),
      nextContext: { ...currentContext, previousQuery: qTrimmed },
    };
  }

  // ----------------------------------------------------
  // 5. CANCELLATION SAVINGS
  // ----------------------------------------------------
  if (
    qLower.includes('cancel') ||
    qLower.includes('saving') ||
    qLower.includes('save') ||
    qLower.includes('would i save')
  ) {
    if (qLower.includes('most expensive')) {
      const matchMultiple = qLower.match(/(\d+|three|two|four|five)\s+most\s+expensive/i);
      if (matchMultiple || qLower.includes('three most expensive') || qLower.includes('3 most expensive')) {
        const count = matchMultiple && !isNaN(parseInt(matchMultiple[1])) ? parseInt(matchMultiple[1]) : 3;
        const sortedByPrice = [...activeSubs].sort(
          (a, b) => getNormalizedMonthlyPrice(b) - getNormalizedMonthlyPrice(a)
        );
        const topN = sortedByPrice.slice(0, count);

        if (topN.length === 0) {
          return {
            responseText: 'You have no active subscriptions to cancel.',
            nextContext: { ...currentContext, previousQuery: qTrimmed },
          };
        }

        const monthlySavings = topN.reduce((sum, s) => sum + getNormalizedMonthlyPrice(s), 0);
        const annualSavings = monthlySavings * 12;
        const names = topN.map((s) => s.name).join(', ');

        const detail = `If you cancelled your ${topN.length} most expensive subscription${topN.length === 1 ? '' : 's'} (${names}), you would save ${formatCurrency(monthlySavings, defaultCurrency)} per month, which totals ${formatCurrency(annualSavings, defaultCurrency)} annually.`;

        return {
          responseText: detail,
          relatedSubs: topN,
          nextContext: {
            lastMentionedSub: topN[0],
            lastTopic: 'cancellation',
            lastAnswerText: detail,
            lastCalculationDetail: detail,
            previousQuery: qTrimmed,
          },
        };
      }

      const sortedByPrice = [...activeSubs].sort(
        (a, b) => getNormalizedMonthlyPrice(b) - getNormalizedMonthlyPrice(a)
      );
      if (sortedByPrice.length > 0) {
        const highest = sortedByPrice[0];
        const monthlyCost = getNormalizedMonthlyPrice(highest);
        const annualCost = monthlyCost * 12;
        const detail = `If you cancelled your most expensive subscription (${highest.name}), you would save ${formatCurrency(monthlyCost, defaultCurrency)} per month (${formatCurrency(annualCost, defaultCurrency)} annually).`;
        return {
          responseText: detail,
          relatedSubs: [highest],
          nextContext: {
            lastMentionedSub: highest,
            lastTopic: 'cancellation',
            lastAnswerText: detail,
            lastCalculationDetail: detail,
            previousQuery: qTrimmed,
          },
        };
      }
    }

    if (matchedSub) {
      const monthlyCost = getNormalizedMonthlyPrice(matchedSub);
      const annualSavings = monthlyCost * 12;
      const detail = `If you cancel ${matchedSub.name}, you will save ${formatCurrency(monthlyCost, defaultCurrency)} per month (${formatCurrency(annualSavings, defaultCurrency)} annually).`;

      return {
        responseText: detail,
        relatedSubs: [matchedSub],
        nextContext: {
          lastMentionedSub: matchedSub,
          lastTopic: 'cancellation',
          lastAnswerText: detail,
          lastCalculationDetail: detail,
          previousQuery: qTrimmed,
        },
      };
    }

    const candidates = allSubs.filter(
      (s) => s.status === 'paused' || s.status === 'trial' || getNormalizedMonthlyPrice(s) >= 20
    );
    const potential = calculatePotentialSavings(allSubs, defaultCurrency, exchangeRates);
    const recommendedSubs = candidates.length > 0 ? candidates.slice(0, 3) : activeSubs.slice(0, 3);

    const detail = `You could save up to ${formatCurrency(potential > 0 ? potential : 25.0, defaultCurrency)}/month (${formatCurrency((potential > 0 ? potential : 25.0) * 12, defaultCurrency)}/year) by reviewing trial plans, paused subscriptions, or high-tier services.`;

    return {
      responseText: detail,
      relatedSubs: recommendedSubs.length > 0 ? recommendedSubs : undefined,
      nextContext: {
        lastMentionedSub: recommendedSubs[0] || null,
        lastTopic: 'cancellation',
        lastAnswerText: detail,
        lastCalculationDetail: detail,
        previousQuery: qTrimmed,
      },
    };
  }

  // ----------------------------------------------------
  // 6. ANNUAL CONVERSION FOLLOW-UP
  // ----------------------------------------------------
  if (
    qLower.includes('annually') ||
    qLower.includes('per year') ||
    qLower.includes('in a year') ||
    qLower.includes('yearly cost') ||
    qLower.includes('annual cost') ||
    (qLower.includes('how much') && qLower.includes('year'))
  ) {
    if (matchedSub) {
      const monthlyPrice = getNormalizedMonthlyPrice(matchedSub);
      const annualPrice = monthlyPrice * 12;
      const detail = `${matchedSub.name} is ${formatCurrency(matchedSub.price, matchedSub.currency || defaultCurrency)}/${matchedSub.billing_cycle}, which equals ${formatCurrency(annualPrice, defaultCurrency)} per year.`;
      return {
        responseText: detail,
        relatedSubs: [matchedSub],
        nextContext: {
          lastMentionedSub: matchedSub,
          lastTopic: 'subscription_spending',
          lastAnswerText: detail,
          lastCalculationDetail: detail,
          previousQuery: qTrimmed,
        },
      };
    }

    const detail = `Your total projected annual spending across ${activeSubs.length} active subscription${activeSubs.length === 1 ? '' : 's'} is ${formatCurrency(annualTotal, defaultCurrency)}.`;
    return {
      responseText: detail,
      relatedSubs: activeSubs.slice(0, 3),
      nextContext: {
        lastTopic: 'subscription_spending',
        lastAnswerText: detail,
        lastCalculationDetail: detail,
        previousQuery: qTrimmed,
      },
    };
  }

  // ----------------------------------------------------
  // 7. HIGHEST COST SUBSCRIPTION
  // ----------------------------------------------------
  if (
    qLower.includes('most expensive') ||
    qLower.includes('highest cost') ||
    qLower.includes('costs me the most') ||
    qLower.includes('highest monthly') ||
    qLower.includes('biggest expense') ||
    qLower.includes('highest subscription')
  ) {
    if (activeSubs.length === 0) {
      return {
        responseText: 'You currently have no active subscriptions in SubHalt.',
        nextContext: { ...currentContext, previousQuery: qTrimmed },
      };
    }

    const sortedByPrice = [...activeSubs].sort(
      (a, b) => getNormalizedMonthlyPrice(b) - getNormalizedMonthlyPrice(a)
    );
    const highest = sortedByPrice[0];
    const monthlyCost = getNormalizedMonthlyPrice(highest);
    const cycleStr = highest.billing_cycle === 'monthly' ? 'month' : highest.billing_cycle === 'yearly' ? 'year' : highest.billing_cycle;
    const detail = `${highest.name} is your highest cost subscription at ${formatCurrency(highest.price, highest.currency || defaultCurrency)} per ${cycleStr} (${formatCurrency(monthlyCost, defaultCurrency)}/month normalized).`;

    return {
      responseText: detail,
      relatedSubs: [highest],
      nextContext: {
        lastMentionedSub: highest,
        lastTopic: 'subscription_spending',
        lastAnswerText: detail,
        lastCalculationDetail: detail,
        previousQuery: qTrimmed,
      },
    };
  }

  // ----------------------------------------------------
  // 8. UPCOMING RENEWALS
  // ----------------------------------------------------
  if (
    qLower.includes('renews next') ||
    qLower.includes('next renewal') ||
    qLower.includes('upcoming renewal') ||
    qLower.includes('next billing') ||
    qLower.includes('renew this week') ||
    qLower.includes('renews this week') ||
    qLower.includes('tell me about my next renewal')
  ) {
    if (matchedSub) {
      const detail = `${matchedSub.name} renews on ${matchedSub.next_billing_date} for ${formatCurrency(matchedSub.price, matchedSub.currency || defaultCurrency)}.`;
      return {
        responseText: detail,
        relatedSubs: [matchedSub],
        nextContext: {
          lastMentionedSub: matchedSub,
          lastTopic: 'subscription_renewals',
          lastAnswerText: detail,
          lastCalculationDetail: detail,
          previousQuery: qTrimmed,
        },
      };
    }

    if (qLower.includes('this week')) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const thisWeekSubs = activeSubs.filter((s) => {
        const d = new Date(s.next_billing_date);
        return d >= now && d <= weekLater;
      });

      if (thisWeekSubs.length > 0) {
        const listStr = thisWeekSubs
          .map((s) => `${s.name} on ${s.next_billing_date} (${formatCurrency(s.price, s.currency || defaultCurrency)})`)
          .join('\n• ');
        const detail = `You have ${thisWeekSubs.length} subscription${thisWeekSubs.length === 1 ? '' : 's'} renewing this week:\n• ${listStr}`;
        return {
          responseText: detail,
          relatedSubs: thisWeekSubs,
          nextContext: {
            lastMentionedSub: thisWeekSubs[0],
            lastTopic: 'subscription_renewals',
            lastAnswerText: detail,
            lastCalculationDetail: detail,
            previousQuery: qTrimmed,
          },
        };
      }

      return {
        responseText: 'You have no subscriptions scheduled to renew within the next 7 days.',
        nextContext: {
          lastTopic: 'subscription_renewals',
          previousQuery: qTrimmed,
        },
      };
    }

    if (activeSubs.length === 0) {
      return {
        responseText: 'You have no active subscriptions registered.',
        nextContext: { ...currentContext, previousQuery: qTrimmed },
      };
    }

    const sortedByDate = [...activeSubs].sort(
      (a, b) => new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime()
    );
    const nextSub = sortedByDate[0];
    const detail = `${nextSub.name} renews next on ${nextSub.next_billing_date} for ${formatCurrency(nextSub.price, nextSub.currency || defaultCurrency)}.`;

    return {
      responseText: detail,
      relatedSubs: [nextSub],
      nextContext: {
        lastMentionedSub: nextSub,
        lastTopic: 'subscription_renewals',
        lastAnswerText: detail,
        lastCalculationDetail: detail,
        previousQuery: qTrimmed,
      },
    };
  }

  // ----------------------------------------------------
  // 9. SUBSCRIPTION MONTHLY SPENDING
  // ----------------------------------------------------
  if (
    qLower.includes('spending every month') ||
    qLower.includes('how much am i spending') ||
    qLower.includes('monthly spend') ||
    qLower.includes('total spending') ||
    qLower.includes('spend total') ||
    qLower.includes('monthly expenditure')
  ) {
    const detail = `You are currently spending ${formatCurrency(monthlyTotal, defaultCurrency)} per month across ${activeSubs.length} active subscription${activeSubs.length === 1 ? '' : 's'}. This projects to ${formatCurrency(annualTotal, defaultCurrency)} per year.`;

    return {
      responseText: detail,
      relatedSubs: activeSubs.slice(0, 4),
      nextContext: {
        lastTopic: 'subscription_spending',
        lastAnswerText: detail,
        lastCalculationDetail: detail,
        previousQuery: qTrimmed,
      },
    };
  }

  // ----------------------------------------------------
  // 10. SPENDING COMPARISON / HISTORICAL DATA
  // ----------------------------------------------------
  if (
    qLower.includes('more this month than last month') ||
    qLower.includes('spending high') ||
    qLower.includes('why is my subscription spending')
  ) {
    const detail = `I don't have historical payment records from previous months to compare spending trends yet. Your current total active monthly expenditure is ${formatCurrency(monthlyTotal, defaultCurrency)}.`;

    return {
      responseText: detail,
      relatedSubs: activeSubs.slice(0, 3),
      nextContext: {
        lastTopic: 'subscription_spending',
        lastAnswerText: detail,
        previousQuery: qTrimmed,
      },
    };
  }

  // ----------------------------------------------------
  // 11. SUBSCRIPTIONS TO REVIEW / UNUSED
  // ----------------------------------------------------
  if (
    qLower.includes('subscriptions should i review') ||
    qLower.includes('review first') ||
    qLower.includes('not using') ||
    qLower.includes('unused') ||
    qLower.includes('idle')
  ) {
    const pausedOrTrial = allSubs.filter(
      (s) => s.status === 'paused' || s.status === 'trial'
    );

    if (qLower.includes('not using') || qLower.includes('unused')) {
      if (pausedOrTrial.length > 0) {
        const names = pausedOrTrial.map((s) => s.name).join(', ');
        const detail = `You have ${pausedOrTrial.length} subscription${pausedOrTrial.length === 1 ? '' : 's'} that are paused or on trial: ${names}.`;
        return {
          responseText: detail,
          relatedSubs: pausedOrTrial,
          nextContext: {
            lastMentionedSub: pausedOrTrial[0],
            lastTopic: 'review',
            lastAnswerText: detail,
            previousQuery: qTrimmed,
          },
        };
      }
      return {
        responseText: "I don't have enough detailed usage tracking data to determine whether you're actively using each subscription. However, all active plans have registered billing cycles.",
        nextContext: {
          lastTopic: 'review',
          previousQuery: qTrimmed,
        },
      };
    }

    const highCostOrTrial = allSubs.filter(
      (s) => s.status === 'trial' || s.status === 'paused' || getNormalizedMonthlyPrice(s) >= 20
    );

    if (highCostOrTrial.length > 0) {
      const demonstrative = highCostOrTrial.length === 1 ? 'this' : 'these';
      const detail = `I recommend reviewing ${demonstrative} ${highCostOrTrial.length} subscription${highCostOrTrial.length === 1 ? '' : 's'} first based on high plan pricing or trial auto-renewals: ${highCostOrTrial.map((s) => s.name).join(', ')}.`;
      return {
        responseText: detail,
        relatedSubs: highCostOrTrial.slice(0, 4),
        nextContext: {
          lastMentionedSub: highCostOrTrial[0],
          lastTopic: 'review',
          lastAnswerText: detail,
          previousQuery: qTrimmed,
        },
      };
    }

    return {
      responseText: `All ${activeSubs.length} active subscriptions appear to be in good standing. Your highest plan is ${activeSubs[0]?.name || 'N/A'}.`,
      nextContext: {
        lastTopic: 'review',
        previousQuery: qTrimmed,
      },
    };
  }

  // ----------------------------------------------------
  // 12. DUPLICATE SUBSCRIPTIONS
  // ----------------------------------------------------
  if (
    qLower.includes('duplicate') ||
    qLower.includes('duplicated') ||
    qLower.includes('overlapping') ||
    qLower.includes('same service')
  ) {
    const categoriesMap: Record<string, SubscriptionRow[]> = {};
    for (const sub of activeSubs) {
      const cat = sub.category.toLowerCase();
      if (!categoriesMap[cat]) categoriesMap[cat] = [];
      categoriesMap[cat].push(sub);
    }

    const duplicateCategories = Object.entries(categoriesMap).filter(
      ([, subs]) => subs.length > 1
    );

    if (duplicateCategories.length > 0) {
      const detailsArr = duplicateCategories.map(
        ([cat, subs]) => `${subs.length} in ${cat} (${subs.map((s) => s.name).join(', ')})`
      );
      const detail = `You have overlapping subscriptions in the same category: ${detailsArr.join('; ')}. Consider evaluating whether you need all of them.`;

      const related = duplicateCategories.flatMap(([, subs]) => subs);
      return {
        responseText: detail,
        relatedSubs: related.slice(0, 4),
        nextContext: {
          lastMentionedSub: related[0],
          lastTopic: 'duplicates',
          lastAnswerText: detail,
          previousQuery: qTrimmed,
        },
      };
    }

    return {
      responseText: 'No duplicate active subscriptions detected in your portfolio. All your active plans are in distinct categories.',
      nextContext: {
        lastTopic: 'duplicates',
        previousQuery: qTrimmed,
      },
    };
  }

  // ----------------------------------------------------
  // 13. DIRECT SUBSCRIPTION QUERY
  // ----------------------------------------------------
  if (matchedSub) {
    const monthlyPrice = getNormalizedMonthlyPrice(matchedSub);
    const detail = `${matchedSub.name} is registered as an active ${matchedSub.category} subscription at ${formatCurrency(matchedSub.price, matchedSub.currency || defaultCurrency)}/${matchedSub.billing_cycle} (${formatCurrency(monthlyPrice, defaultCurrency)}/month). Next renewal is on ${matchedSub.next_billing_date}.${matchedSub.notes ? ` Notes: ${matchedSub.notes}` : ''}`;
    return {
      responseText: detail,
      relatedSubs: [matchedSub],
      nextContext: {
        lastMentionedSub: matchedSub,
        lastTopic: 'general',
        lastAnswerText: detail,
        previousQuery: qTrimmed,
      },
    };
  }

  // ----------------------------------------------------
  // 14. OUT OF SCOPE / UNRELATED KNOWLEDGE
  // ----------------------------------------------------
  const outOfScopePatterns = [
    'capital of',
    'weather',
    'recipe',
    'who is',
    'tell me a joke',
    'write code',
    'python',
    'javascript',
    'how to cook',
    'who won',
    'president of',
  ];
  if (outOfScopePatterns.some((p) => qLower.includes(p))) {
    return {
      responseText: "I’m mainly here to help you understand and manage what you have in SubHalt. Ask me about your subscriptions, spending, renewals, potential savings, or Bills & Payments.",
      nextContext: { ...currentContext, previousQuery: qTrimmed },
    };
  }

  // ----------------------------------------------------
  // 15. FALLBACK / CLARIFYING QUESTION (NO GENERIC DUMP)
  // ----------------------------------------------------
  const clarificationDetail =
    "I want to make sure I answer your question accurately. Are you asking about Bills & Payments, subscription management, or how a specific feature in SubHalt works?";

  return {
    responseText: clarificationDetail,
    nextContext: {
      ...currentContext,
      lastTopic: 'general',
      lastAnswerText: clarificationDetail,
      previousQuery: qTrimmed,
    },
  };
}
