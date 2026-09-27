import type { ReactNode } from 'react';

interface FilterBarProps {
  children: ReactNode;
  /** Rendered at the end of the bar and excluded from the scrolling track. */
  trailing?: ReactNode;
  ariaLabel?: string;
  className?: string;
}

/**
 * Filter controls collapse into a single snap-scrolling chip row on phones,
 * where wrapping them costs more vertical space than a whole content section,
 * and expand into a wrapping row from `md` up.
 *
 * `trailing` is kept outside the scroll track so primary actions such as
 * "Add subscription" never scroll out of reach.
 */
export function FilterBar({
  children,
  trailing,
  ariaLabel = 'Filters',
  className = '',
}: FilterBarProps) {
  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      <div
        role="group"
        aria-label={ariaLabel}
        className="filter-scroll flex-1 min-w-0 py-0.5 -mx-1 px-1"
      >
        {children}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}

export default FilterBar;
