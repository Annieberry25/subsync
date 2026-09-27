/** Client-safe shape of a subscription discovered by scanning a Gmail inbox. */
export interface DiscoveredSubscription {
  id: string;
  providerName: string;
  amount: number;
  currency: string;
  category: string;
  billingCycle: string;
  from: string;
  subject: string;
  date: string;
}