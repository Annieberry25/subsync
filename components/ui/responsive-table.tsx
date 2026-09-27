import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export interface ResponsiveTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /**
   * Becomes the card's primary line on mobile, rendered without a label
   * prefix. Only the first column marked `primary` is honoured.
   */
  primary?: boolean;
  /** Rendered in the card header's trailing slot, right-aligned. */
  trailing?: boolean;
  /** Table-only; omitted from the mobile card entirely. */
  desktopOnly?: boolean;
  align?: 'left' | 'right' | 'center';
  headerClassName?: string;
  cellClassName?: string;
}

export interface ResponsiveTableProps<T> {
  data: T[];
  columns: ResponsiveTableColumn<T>[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  /** Accessible name for the mobile row button. */
  getRowLabel?: (row: T) => string;
  /**
   * Trailing per-row controls. Supplying this makes only the primary line
   * tappable rather than the whole card, because a button cannot legally
   * contain other buttons.
   */
  renderRowActions?: (row: T) => ReactNode;
  caption?: ReactNode;
  emptyState?: ReactNode;
  className?: string;
  /** Pin the first column while the table scrolls horizontally at md+. */
  stickyFirstColumn?: boolean;
}

const ALIGN_CLASSES = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const;

/**
 * Renders one dataset as a real `<table>` from `md` up and as a list of
 * stacked cards below it, so narrow screens never get a horizontally
 * scrolling grid or a 4-across set of truncated columns.
 *
 * Both views are rendered into the DOM and toggled with `hidden`/`md:block`
 * rather than being chosen at runtime, which keeps the column markup in one
 * place instead of duplicated per call site.
 */
export function ResponsiveTable<T>({
  data,
  columns,
  rowKey,
  onRowClick,
  getRowLabel,
  renderRowActions,
  caption,
  emptyState,
  className = '',
  stickyFirstColumn = true,
}: ResponsiveTableProps<T>) {
  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const primaryColumn = columns.find((c) => c.primary) ?? columns[0];
  const trailingColumn = columns.find((c) => c.trailing);
  const detailColumns = columns.filter(
    (c) => c !== primaryColumn && c !== trailingColumn && !c.desktopOnly,
  );
  const hasActions = Boolean(renderRowActions);

  return (
    <div className={className}>
      {/* ---- md and up: real table ---- */}
      <div className="hidden md:block table-scroll">
        <table className="w-full min-w-[640px] text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="sticky top-(--spacing-header) z-20 bg-[#0F1111]">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] px-3 py-2.5 whitespace-nowrap ${
                    ALIGN_CLASSES[column.align ?? 'left']
                  } ${column.headerClassName ?? ''} ${
                    stickyFirstColumn && index === 0 ? 'table-sticky-col' : ''
                  }`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={rowKey(row, rowIndex)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-t border-[#1A1D1D] ${
                  onRowClick ? 'cursor-pointer hover:bg-[#1A1D1D]/40' : ''
                }`}
              >
                {columns.map((column, columnIndex) => (
                  <td
                    key={column.key}
                    className={`px-3 py-2.5 text-[#F5F7F6] align-middle ${
                      ALIGN_CLASSES[column.align ?? 'left']
                    } ${column.cellClassName ?? ''} ${
                      stickyFirstColumn && columnIndex === 0
                        ? 'table-sticky-col font-medium'
                        : ''
                    }`}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- below md: stacked cards ---- */}
      <ul className="md:hidden space-y-2.5">
        {data.map((row, rowIndex) => {
          const detail = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#F5F7F6] break-words">
                  {primaryColumn.cell(row)}
                </span>
              </span>
              {trailingColumn && (
                <span className="shrink-0 text-sm font-semibold text-[#F5F7F6] tabular-nums">
                  {trailingColumn.cell(row)}
                </span>
              )}
              {onRowClick && (
                <ChevronRight
                  className="w-4 h-4 shrink-0 text-[#94A3B8]"
                  aria-hidden="true"
                />
              )}
            </>
          );

          return (
            <li
              key={rowKey(row, rowIndex)}
              className="rounded-2xl border border-[#1A1D1D] bg-[#0F1111] overflow-hidden focus-within:ring-2 focus-within:ring-[#14B8A6]/50"
            >
              {/* Without row actions the entire card is the tap target. With
                  them, only the primary line is, so the action buttons remain
                  independently reachable. */}
              {onRowClick && !hasActions ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  aria-label={getRowLabel?.(row)}
                  className="w-full flex items-center gap-2 min-h-[56px] px-3.5 py-3 text-left cursor-pointer hover:bg-[#1A1D1D]/40 transition-colors"
                >
                  {detail}
                </button>
              ) : (
                <div className="flex items-center gap-2 px-3.5 py-3 min-h-[56px]">
                  {onRowClick ? (
                    <button
                      type="button"
                      onClick={() => onRowClick(row)}
                      aria-label={getRowLabel?.(row)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer rounded-lg"
                    >
                      {detail}
                    </button>
                  ) : (
                    detail
                  )}
                </div>
              )}

              {detailColumns.length > 0 && (
                <dl className="px-3.5 pb-3 pt-1 space-y-1.5 border-t border-[#1A1D1D]">
                  {detailColumns.map((column) => (
                    <div
                      key={column.key}
                      className="flex items-baseline justify-between gap-3 min-h-6"
                    >
                      <dt className="text-[11px] text-[#94A3B8] shrink-0">
                        {column.header}
                      </dt>
                      <dd className="text-xs text-[#F5F7F6] text-right min-w-0 break-words">
                        {column.cell(row)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {renderRowActions && (
                <div className="flex justify-end gap-2 px-3.5 pb-3 pt-1 border-t border-[#1A1D1D]">
                  {renderRowActions(row)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ResponsiveTable;
