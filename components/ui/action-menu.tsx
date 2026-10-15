'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';

/** Client-only detection without a setState-in-effect. Same shape Sheet uses. */
const emptySubscribe = () => () => {};

export interface ActionMenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** Destructive rows get the app's red; everything else is neutral. */
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** Replaces the label while the row is working, e.g. "Restoring". */
  busyLabel?: string;
  busy?: boolean;
}

interface ActionMenuProps {
  /** Names the control for assistive tech, e.g. `Actions for Netflix`. */
  triggerLabel: string;
  items: ActionMenuItem[];
}

/**
 * A horizontal-dots menu for a card's secondary actions.
 *
 * Three full-width buttons at the foot of a card read as the card's primary
 * content and leave it with nothing else to say. Moving them behind one control
 * leaves the card itself visible and puts the destructive option a deliberate
 * step away rather than a target beside "Restore".
 *
 * Rendered in a portal and positioned against the trigger's viewport rect, so it
 * escapes the card's overflow and stacking context. The positioning and
 * dismissal handling mirror the subscription card's menu, which predates this.
 */
export function ActionMenu({ triggerLabel, items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 16 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    // 208px is the menu's own width; clamping keeps it fully on screen when the
    // trigger sits near the right edge.
    const right = Math.max(16, Math.min(window.innerWidth - 208, window.innerWidth - rect.right));
    setPos({ top: rect.bottom + 6, right });
    setOpen(true);
  };

  /*
   * The menu is position: fixed, so it is clipped by the bottom of the viewport
   * and a trigger near the end of a long list would open it half off-screen with
   * no way to reach the lower rows.
   *
   * The fix is to make the page itself taller by exactly the amount the menu
   * overflows. The browser then produces (or lengthens) a scrollbar, the reader
   * scrolls down, and the whole menu comes into view. The padding is removed on
   * close so the page does not stay stretched.
   */
  useEffect(() => {
    if (!open || !mounted) return;

    const MENU_HEIGHT = 4 + items.length * 45 + 8;
    const overflow = pos.top + MENU_HEIGHT - window.innerHeight;

    if (overflow <= 0) return;

    const { body } = document;
    const previousPaddingBottom = body.style.paddingBottom;
    body.style.paddingBottom = `${overflow + 12}px`;

    // Bring the menu itself into view once the page has grown to fit it.
    window.scrollBy({ top: overflow, behavior: 'smooth' });

    return () => {
      body.style.paddingBottom = previousPaddingBottom;
    };
  }, [open, mounted, pos.top, items.length]);

  useEffect(() => {
    if (!open) return;

    const startY = window.scrollY;
    const startX = window.scrollX;

    const handleScroll = (event: Event) => {
      const target = event.target as Element | null;
      // Scrolling inside the menu is fine; scrolling the page is not, because the
      // menu is positioned in viewport coordinates and would detach from it.
      if (menuRef.current && target && menuRef.current.contains(target as Node)) return;
      const dy = Math.abs(window.scrollY - startY);
      const dx = Math.abs(window.scrollX - startX);
      const scrolledInner = target && 'scrollTop' in target;
      if (dy > 4 || dx > 4 || scrolledInner) setOpen(false);
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleResize = () => setOpen(false);

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const menu: ReactNode =
    open && mounted && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: `${pos.top}px`, right: `${pos.right}px` }}
            className="w-52 rounded-2xl bg-[#0F1111] border border-[#1A1D1D] shadow-xl py-1.5 z-[9999]"
            role="menu"
            aria-orientation="vertical"
            aria-label={triggerLabel}
          >
            {items.map((item) => {
              const Icon = item.icon;
              const danger = item.tone === 'danger';
              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled || item.busy}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={`w-full px-3.5 py-2.5 min-h-[44px] text-xs font-medium flex items-center gap-2.5 transition-colors text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    danger
                      ? 'text-[#D9363E] hover:bg-[#D9363E]/10'
                      : 'text-[#F5F7F6] hover:bg-[#1A1D1D]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.busy ? (item.busyLabel ?? item.label) : item.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className="p-1.5 text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D]/50 rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {menu}
    </>
  );
}

export default ActionMenu;