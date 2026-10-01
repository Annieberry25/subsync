import { PLAN_LIMITS } from '@/lib/constants/plan-limits';

/**
 * Maximum active subscriptions a free-tier user can track.
 *
 * Derived from the plan table (single source of truth) so the server-side
 * enforcement, the client-side gate, and the advertised plan copy can never
 * drift apart.
 */
export const FREE_SUBSCRIPTION_LIMIT = PLAN_LIMITS.free.maxSubscriptions;
