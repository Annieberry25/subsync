import type { ReactNode } from 'react';

type StatColumns = 'auto' | 1 | 2 | 3 | 4;

const COLUMN_CLASSES: Record<StatColumns, string> = {
  auto: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
};

interface StatGridProps {
  children: ReactNode;
  /**
   * `auto` is the default dashboard shape: two columns on a phone, three at
   * `md`, four at `lg`. Pass an explicit count for summary strips that must
   * not reflow as the viewport widens.
   */
  columns?: StatColumns;
  className?: string;
}

/**
 * Single-row-per-stat layout that never drops below two columns, because a
 * one-column stack of KPI cards pushes the actual content below the fold on
 * every dashboard load.
 */
export function StatGrid({ children, columns = 'auto', className = '' }: StatGridProps) {
  return (
    <div className={`grid ${COLUMN_CLASSES[columns]} gap-3 sm:gap-4 ${className}`}>
      {children}
    </div>
  );
}

export default StatGrid;
