'use client';

import Link from 'next/link';
import { useDockItems } from '@/lib/hooks/use-dock-items';
import { useScrollDirection } from '@/lib/hooks/use-scroll-direction';
import { useOverlayOpen } from '@/lib/hooks/use-overlay-open';

/**
 * Five-slot floating navigation bar for every width below `lg`, where the
 * sidebar is hidden and the hamburger has been removed.
 *
 * Slot count is fixed at five so each target is ~64px wide even on a 320px
 * screen, which is what allows all five labels to stay visible rather than
 * collapsing to icons.
 */
export function MobileDock() {
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
      // Sits below every overlay. `components/ui/sheet.tsx` is the only
      // overlay primitive now and renders at z-70, so the dock can sit at
      // z-60 without painting over any dialog.
      className={`fixed inset-x-0 bottom-0 z-60 lg:hidden transition-transform duration-300 ease-out ${
        collapsed || overlayOpen ? 'translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="glass-dock mx-2 mb-[max(0.5rem,var(--spacing-safe-b))] flex items-stretch h-(--spacing-dock)">
        {slots.map((slot) => {
          const Icon = slot.icon;

          return (
            <Link
              key={slot.key}
              href={slot.href}
              aria-current={slot.active ? 'page' : undefined}
              aria-label={slot.key === 'subscriptions' ? 'Subscriptions' : slot.label}
              className="relative flex-1 min-w-0 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
            >
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
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileDock;
