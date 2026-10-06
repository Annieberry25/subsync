/** Shared shapes for the transactional email pipeline. */

export interface SubscriptionEmailData {
  id: string;
  name: string;
  price: number;
  currency: string | null;
  billingCycle: string | null;
  nextBillingDate: string;
  /** Days until the next charge. Negative when already past due. */
  daysUntilRenewal?: number;
}

/** Resend only accepts these; anything else is a template bug rather than data. */
export type EmailKind = 'welcome' | 'subscription_created' | 'renewal_reminder';