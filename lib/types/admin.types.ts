export interface AdminOverview {
  totalUsers: number;
  activeUsers30d: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalPlanSubscriptions: number;
  paidPlans: number;
  pendingPlans: number;
  failedPlans: number;
  estimatedMrrUsd: number;
  gmailConnections: number;
  aiConversations: number;
  inboxItems: number;
  billPayments: number;
  recentActivity: AdminActivityItem[];
}

export interface AdminActivityItem {
  id: string;
  email: string;
  user_full_name: string | null;
  type: string;
  title: string;
  description: string | null;
  amount: number | null;
  currency: string | null;
  timestamp: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  plan_tier: string;
  plan_expires_at: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface AdminUserDetail {
  profile: AdminUserRow;
  subscriptionCount: number;
  activeSubscriptionCount: number;
  planSubscriptions: AdminPlanSubscriptionRow[];
  recentActivity: AdminActivityItem[];
}

export interface AdminPlanSubscriptionRow {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  plan: string;
  paystack_reference: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired';
  amount: number;
  currency: string;
  access_code: string | null;
  paid_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface AdminBillProviderRow {
  id: string;
  name: string;
  category: string;
  country: string;
  region: string | null;
  official_website: string | null;
  official_payment_url: string | null;
  verification_status: 'verified' | 'user_submitted' | 'unverified';
  supported_regions: string[] | null;
  created_at: string;
}

export interface AdminProviderInput {
  name: string;
  category: string;
  country: string;
  region?: string | null;
  official_website?: string | null;
  official_payment_url?: string | null;
  verification_status?: 'verified' | 'user_submitted' | 'unverified';
  supported_regions?: string[] | null;
}