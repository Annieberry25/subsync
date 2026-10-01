'use client';

/**
 * Small "PLUS" marker for affordances that are not in the free plan.
 *
 * Purely presentational — whether a feature is actually gated is decided by
 * `hasPlanFeature()` in lib/constants/plan-limits.ts. Keeping the badge dumb
 * means it can sit anywhere a feature is listed without ever disagreeing with
 * the enforcement.
 */
export function PlusBadge({
  className = '',
  label = 'Plus',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      data-testid="plus-badge"
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#14B8A6]/10 border border-[#14B8A6]/25 text-[#14B8A6] text-[10px] font-semibold uppercase tracking-wider leading-none shrink-0 ${className}`}
    >
      {label}
    </span>
  );
}

export default PlusBadge;
