import { Children, type ReactNode } from 'react';

type StatColumns = 'auto' | 1 | 2 | 3 | 4;

const GRID_COLUMN_CLASSES: Record<Exclude<StatColumns, 'auto'>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
};

interface StatGridProps {
  children: ReactNode;
  /**
   * `auto` is the default dashboard shape: a single swipe line on a phone,
   * three columns at `md`, four at `lg`. Pass an explicit count for summary
   * strips that must not reflow as the viewport widens.
   */
  columns?: StatColumns;
  className?: string;
}

export function StatGrid({ children, columns = 'auto', className = '' }: StatGridProps) {
  if (columns === 'auto') {
    return (
      <div
        className={`flex overflow-x-auto overscroll-x-contain snap-x snap-mandatory no-scrollbar gap-3 md:grid md:grid-cols-3 md:gap-4 lg:grid-cols-4 ${className}`}
      >
        {Children.map(children, (child) => (
          <div className="w-[70%] max-w-[300px] shrink-0 snap-start min-w-0 md:w-auto md:max-w-none">
            {child}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid ${GRID_COLUMN_CLASSES[columns]} gap-3 sm:gap-4 ${className}`}>
      {children}
    </div>
  );
}

export default StatGrid;
