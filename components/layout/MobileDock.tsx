'use client';

import Link from 'next/link';
import { useDockItems } from '@/lib/hooks/use-dock-items';
import { useScrollDirection } from '@/lib/hooks/use-scroll-direction';
import { useOverlayOpen } from '@/lib/hooks/use-overlay-open';

interface MobileDockProps {
  onOpenMore: () => void;
  /**
   * Whether the More sheet is currently open. Needed for `aria-expanded` to
   * reflect real state — the slot's `active` flag only says the current route
   * is the More route, which is true whether or not the sheet is showing.
   */
  moreOpen?: boolean;
}

/**
 * Four-slot floating navigation bar for every width below `lg`, where the
 * sidebar is hidden and the hamburger has been removed.
 *
 * Slot count is fixed at four so each target is ~76px wide even on a 320px
 * screen, which is what allows all four labels to stay visible rather than
 * collapsing to icons.
 */
export function MobileDock({ onOpenMore, moreOpen = false }: MobileDockProps) {
  const { slots, visible } = useDockItems();
  const { direction, atTop } = useScrollDirection();
  const overlayOpen = useOverlayOpen();

  // Hidden on downward scroll to hand the screen back to the content, and
  // while an overlay owns the viewport.
  const collapsed = direction === 'down' && !atTop;

  if (!visible) return null;

  return (
    <nav
      aria-label="Primary"
      data-mobile-dock=""
      // Sits below every overlay. The modals that have not yet moved onto
      // `components/ui/sheet.tsx` render at z-50, so the dock must stay under
      // that until the migration in Phase 5 is complete; this value moves to
      // z-60 once every overlay shares one primitive.
      className={`fixed inset-x-0 bottom-0 z-40 lg:hidden transition-transform duration-300 ease-out ${
        collapsed || overlayOpen ? 'translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="glass-dock mx-2 mb-[max(0.5rem,var(--spacing-safe-b))] flex items-stretch h-(--spacing-dock)">
        {slots.map((slot) => {
          const Icon = slot.icon;
          const isRoute = Boolean(slot.href);

          const content = (
            <>
              <span
                aria-hidden="true"
                className={`absolute top-0 left-1/2 -translate-x-1/2 h-1 rounded-b-full bg-[#14B8A6] transition-opacity duration-200 ${
                  slot.active ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <Icon
                className={`w-5 h-5 shrink-0 transition-colors duration-200 ${
                  slot.active ? 'text-[#14B8A6]' : 'text-[#94A3B8]'
                }`}
                aria-hidden="true"
              />
              <span
                className={`text-[11px] font-semibold leading-none truncate max-w-full px-0.5 transition-colors duration-200 ${
                  slot.active ? 'text-[#14B8A6]' : 'text-[#94A3B8]'
                }`}
              >
                {slot.label}
              </span>
            </>
          );

          const shared = `relative flex-1 min-w-0 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
            isRoute
              ? ''
              : 'appearance-none border-none bg-transparent font-inherit'
          }`;

          if (isRoute) {
            return (
              <Link
                key={slot.key}
                href={slot.href!}
                aria-current={slot.active ? 'page' : undefined}
                aria-label={slot.key === 'subscriptions' ? 'Subscriptions' : slot.label}
                className={shared}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={slot.key}
              type="button"
              onClick={onOpenMore}
              aria-expanded={moreOpen}
              aria-controls="more-sheet-panel"
              aria-haspopup="dialog"
              className={shared}
            >
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileDock;
