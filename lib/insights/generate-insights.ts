import { calculateCategoryBreakdown } from '@/lib/utils/analytics-utils';
import {
  calculateAnnualSpend,
  getNormalizedMonthlyPrice,
  formatCurrency,
} from '@/lib/utils/metrics-utils';
import { isOverdueSubscription, type SubscriptionRow } from '@/lib/services/subscription-service';

/**
 * Insight generation.
 *
 * Extracted from the dashboard card so there is exactly one definition of "what
 * the assistant currently thinks". The push notifier and the card both call
 * `buildInsights` and compare `id`: if the card rendered from a second copy of
 * these rules, a user could be told about an insight the card does not show.
 */

export interface SmartInsightCandidate {
  id: string;
  title: string;
  category: 'actionable' | 'informational' | 'neutral';
  priority: number;
  preview: string;
  observation: string;
  meaning: string;
  recommendation: string;
}

const KNOWN_VIDEO_STREAMING = [
  'netflix',
  'disney+',
  'hulu',
  'hbo max',
  'max',
  'amazon prime video',
  'apple tv+',
];

/**
 * Every insight that currently applies, highest priority first.
 *
 * Ordered by `priority` rather than returned pre-sorted so the caller can pick a
 * different one — the push wants only genuinely actionable ones, while the card
 * always shows the top of the list.
 */
export function buildInsights(subscriptions: SubscriptionRow[]): SmartInsightCandidate[] {
  const activeSubs = subscriptions.filter(
    (sub) => sub.status === 'active' || sub.status === 'trial'
  );
  const pausedSubs = subscriptions.filter((sub) => sub.status === 'paused');
  const canceledSubs = subscriptions.filter((sub) => sub.status === 'canceled');
  const categoryBreakdown = calculateCategoryBreakdown(subscriptions);
  const totalAnnualSpend = calculateAnnualSpend(subscriptions);

  const candidates: SmartInsightCandidate[] = [];

  // Catch-it-before-it-bills rules. Both use the shared overdue definition so
  // this engine can never disagree with the dashboard banner or the renewals
  // page about what is overdue.

  const overdueSubs = subscriptions.filter((sub) => isOverdueSubscription(sub));
  if (overdueSubs.length > 0) {
    const overdueMonthly = overdueSubs.reduce(
      (acc, sub) => acc + getNormalizedMonthlyPrice(sub),
      0
    );
    candidates.push({
      id: 'renewal-overdue',
      title: 'Overdue Subscriptions',
      category: 'actionable',
      priority: 98,
      preview:
        overdueSubs.length === 1
          ? `${overdueSubs[0].name} is past its billing date.`
          : `${overdueSubs.length} subscriptions are past their billing date.`,
      observation:
        overdueSubs.length === 1
          ? `${overdueSubs[0].name} was due on ${overdueSubs[0].next_billing_date} and is still marked ${overdueSubs[0].status}, about ${formatCurrency(getNormalizedMonthlyPrice(overdueSubs[0]))}/month.`
          : `${overdueSubs.length} subscriptions (${overdueSubs
              .slice(0, 3)
              .map((s) => s.name)
              .join(', ')}) are past their billing dates, about ${formatCurrency(overdueMonthly)}/month together.`,
      meaning:
        'An overdue charge can go through the moment your payment method works, so money you have not budgeted can still leave.',
      recommendation:
        'Cancel or pause the ones you no longer want before they bill again.',
    });
  }

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const trialEndingSoon = activeSubs.filter((sub) => {
    if (sub.status !== 'trial') return false;
    if (isOverdueSubscription(sub)) return false;
    const next = new Date(sub.next_billing_date);
    if (Number.isNaN(next.getTime())) return false;
    return next.getTime() - startOfToday.getTime() <= 7 * MS_PER_DAY;
  });
  if (trialEndingSoon.length > 0) {
    const first = trialEndingSoon[0];
    const daysUntil = Math.max(
      0,
      Math.ceil(
        (new Date(first.next_billing_date).getTime() - startOfToday.getTime()) / MS_PER_DAY
      )
    );
    const daysLabel = daysUntil === 0 ? 'less than a day' : `${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
    candidates.push({
      id: 'trial-ending-soon',
      title: 'Trial Ending Soon',
      category: 'actionable',
      priority: 96,
      preview:
        trialEndingSoon.length === 1
          ? `${first.name} starts billing in ${daysLabel}.`
          : `${trialEndingSoon.length} free trials are about to start billing.`,
      observation:
        trialEndingSoon.length === 1
          ? `Your ${first.name} trial ends on ${first.next_billing_date} and will bill ${formatCurrency(getNormalizedMonthlyPrice(first))} unless you cancel first.`
          : `${trialEndingSoon.map((s) => s.name).join(', ')} all start billing within the next 7 days.`,
      meaning:
        'Trials convert to paid automatically — the charge happens unless you decide against it first.',
      recommendation:
        'Cancel from the subscription page before the trial ends if you are not planning to keep it.',
    });
  }

  // 1. Genuine duplicate subscriptions (strictly verified — never guess).
  const nameCounts: Record<string, number> = {};
  activeSubs.forEach((sub) => {
    const normalized = sub.name.trim().toLowerCase();
    nameCounts[normalized] = (nameCounts[normalized] || 0) + 1;
  });
  const exactDuplicateName = Object.keys(nameCounts).find(
    (name) => nameCounts[name] > 1
  );

  const activeVideoSubs = activeSubs.filter(
    (sub) =>
      sub.category === 'Streaming' &&
      KNOWN_VIDEO_STREAMING.some((k) => sub.name.toLowerCase().includes(k))
  );

  if (exactDuplicateName) {
    const dupName =
      activeSubs.find((s) => s.name.trim().toLowerCase() === exactDuplicateName)?.name ||
      exactDuplicateName;
    candidates.push({
      id: 'duplicate-services-exact',
      title: 'Duplicate Services',
      category: 'actionable',
      priority: 95,
      preview: 'Potential duplicate subscription detected.',
      observation: `You have more than one active subscription for ${dupName}.`,
      meaning: `Having duplicate accounts often means you're accidentally being billed twice.`,
      recommendation: `Check your account settings to see if you can merge or cancel one of them.`,
    });
  } else if (activeVideoSubs.length >= 3) {
    candidates.push({
      id: 'duplicate-services-streaming',
      title: 'Potential Savings',
      category: 'actionable',
      priority: 95,
      preview: 'Multiple video streaming subscriptions active.',
      observation: `You're currently subscribed to ${activeVideoSubs.length} video streaming services (${activeVideoSubs
        .slice(0, 3)
        .map((s) => s.name)
        .join(', ')}).`,
      meaning: `It's easy to pay for several streaming apps at once without watching all of them.`,
      recommendation: `Pausing or rotating services you aren't using right now is a simple way to save each month.`,
    });
  }

  // 2. Spending trend & addition velocity.
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentSubs = activeSubs.filter((sub) => {
    const dateStr = sub.created_at || sub.start_date;
    if (!dateStr) return false;
    const subDate = new Date(dateStr);
    return subDate >= thirtyDaysAgo && subDate <= now;
  });

  if (recentSubs.length >= 2) {
    const recentIncrease = recentSubs.reduce(
      (acc, s) => acc + getNormalizedMonthlyPrice(s),
      0
    );
    candidates.push({
      id: 'spending-trend-velocity',
      title: 'Spending Trend',
      category: 'actionable',
      priority: 90,
      preview: 'Monthly subscription spending increased this month.',
      observation: `Your monthly spending went up by ${formatCurrency(
        recentIncrease
      )} after adding ${recentSubs.length} new services this month.`,
      meaning: `Adding multiple services quickly can cause your monthly total to jump.`,
      recommendation: `Take a quick moment to review these new additions and make sure they're all still worth keeping.`,
    });
  } else if (recentSubs.length === 1) {
    const recentSub = recentSubs[0];
    const monthlyIncrease = getNormalizedMonthlyPrice(recentSub);
    candidates.push({
      id: 'spending-trend-single',
      title: 'Spending Trend',
      category: 'actionable',
      priority: 88,
      preview: 'Monthly subscription spending increased recently.',
      observation: `Your monthly spending went up by ${formatCurrency(
        monthlyIncrease
      )} after adding ${recentSub.name}.`,
      meaning: `Even single new subscriptions naturally increase your regular monthly total over time.`,
      recommendation: `It's worth checking if this new service replaces an older plan you no longer need.`,
    });
  }

  // 3. Billing frequency distribution.
  if (activeSubs.length >= 3) {
    const monthlyCount = activeSubs.filter((s) => s.billing_cycle === 'monthly').length;
    const yearlyCount = activeSubs.filter((s) => s.billing_cycle === 'yearly').length;
    const monthlyPct = (monthlyCount / activeSubs.length) * 100;
    const yearlyPct = (yearlyCount / activeSubs.length) * 100;

    if (monthlyPct >= 75) {
      candidates.push({
        id: 'spending-habit-monthly',
        title: 'Billing Flexibility',
        category: 'informational',
        priority: 85,
        preview: 'Most of your subscriptions use monthly billing.',
        observation: `${monthlyPct.toFixed(
          0
        )}% of your active subscriptions are billed on a monthly basis.`,
        meaning: `Monthly billing gives you great flexibility, but annual plans often come with a nice discount.`,
        recommendation: `If there are services you plan to keep long-term, switching to annual billing could save you 15–20%.`,
      });
    } else if (yearlyPct >= 60) {
      candidates.push({
        id: 'spending-habit-yearly',
        title: 'Annual Savings',
        category: 'informational',
        priority: 85,
        preview: "You're taking full advantage of annual discounts.",
        observation: `${yearlyPct.toFixed(
          0
        )}% of your active subscriptions are billed annually.`,
        meaning: `This locks in the lowest rates for your favorite services.`,
        recommendation: `Just keep an eye on renewal dates so annual charges don't catch you off guard.`,
      });
    }
  }

  // 4. Annual run-rate projection.
  if (totalAnnualSpend > 0) {
    candidates.push({
      id: 'annual-projection',
      title: 'Annual Projection',
      category: 'informational',
      priority: 80,
      preview: 'Here is your projected annual subscription cost.',
      observation: `At your current rate, you'll spend about ${formatCurrency(
        totalAnnualSpend
      )} on subscriptions this year.`,
      meaning: `Small monthly costs can add up to a significant total over twelve months.`,
      recommendation: `Checking in on your plans once or twice a year is a great way to keep your budget on track.`,
    });
  }

  // 5. Category concentration.
  if (categoryBreakdown.length >= 3) {
    const sortedBreakdown = [...categoryBreakdown].sort(
      (a, b) => b.percentage - a.percentage
    );
    const topTwoPct = sortedBreakdown[0].percentage + sortedBreakdown[1].percentage;

    if (topTwoPct >= 75) {
      candidates.push({
        id: 'portfolio-balance',
        title: 'Category Concentration',
        category: 'informational',
        priority: 70,
        preview: 'Your spending is concentrated in two main categories.',
        observation: `${topTwoPct.toFixed(0)}% of your subscription budget goes toward ${sortedBreakdown[0].category} and ${sortedBreakdown[1].category}.`,
        meaning: `When most of your budget goes to two areas, smaller subscriptions elsewhere can easily slip by.`,
        recommendation: `A quick look across all categories can help ensure your spending stays balanced.`,
      });
    }
  }

  // 6. Savings progress.
  const totalInactive = pausedSubs.length + canceledSubs.length;
  if (totalInactive >= 2) {
    candidates.push({
      id: 'savings-progress',
      title: 'Savings Progress',
      category: 'informational',
      priority: 65,
      preview: "You're actively keeping subscription costs low.",
      observation: `You currently have ${totalInactive} paused or canceled subscriptions in your account.`,
      meaning: `Pausing services you aren't using right now is a smart way to protect your monthly budget.`,
        recommendation: `Keep them paused until you need them again. We'll keep your account settings ready.`,
    });
  }

  // 7. Neutral fallback.
  if (subscriptions.length > 0) {
    candidates.push({
      id: 'everything-looks-good',
      title: 'Subscription Overview',
      category: 'neutral',
      priority: 10,
      preview: 'Your subscriptions look healthy and balanced.',
      observation: 'All of your active subscriptions look steady and well-managed.',
      meaning: "We haven't spotted any unexpected price jumps, recent surges, or duplicate services.",
      recommendation: "Everything is in good shape! We'll keep monitoring your renewals and let you know if anything changes.",
    });
  }

  // 8. Empty state.
  if (subscriptions.length === 0) {
    candidates.push({
      id: 'no-subscriptions',
      title: 'Getting Started',
      category: 'neutral',
      priority: 1,
      preview: 'Add subscriptions to get personalized insights.',
      observation:
        "You haven't added any recurring subscriptions to your dashboard yet.",
      meaning: `Once you add your active plans, we'll start analyzing spending trends and helpful savings tips.`,
      recommendation: 'Add your first subscription whenever you’re ready to get started.',
    });
  }

  return candidates.sort((a, b) => b.priority - a.priority);
}

/**
 * The insight the card leads with, or null when there is nothing to say.
 *
 * Null only when there are no subscriptions at all and no candidate could be
 * built, which the current rules cannot produce — but it is handled rather than
 * assumed, because the card dereferences this unconditionally.
 */
export function getTopInsight(
  subscriptions: SubscriptionRow[]
): SmartInsightCandidate | null {
  const insights = buildInsights(subscriptions);
  return insights.length > 0 ? insights[0] : null;
}

/**
 * The first insight worth interrupting someone about.
 *
 * Only `actionable` ones qualify. Pushing "your annual projection" or "everything
 * looks good" trains people to dismiss notifications without reading them, which
 * costs the channel for the messages that do matter. Anything informational is
 * still visible in the card; it just does not cost an interruption.
 */
export function getPushableInsight(
  subscriptions: SubscriptionRow[]
): SmartInsightCandidate | null {
  return (
    buildInsights(subscriptions).find((insight) => insight.category === 'actionable') ?? null
  );
}