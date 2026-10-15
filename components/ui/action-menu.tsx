'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';

/** Client-only detection without a setState-in-effect. Same shape Sheet uses. */
const emptySubscribe = () => () => {};

/** The menu's own width, in px. Clamped against the viewport below. */
const MENU_WIDTH = 208;
/** A row plus its own padding. */
const MENU_ROW_HEIGHT = 45;
/** Minimum breathing room between the menu and any edge of the viewport. */
const VIEWPORT_GAP = 8;

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
  const [pos, setPos] = useState({ top: 0, right: 16, above: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  /**
   * Position the menu against the trigger, flipping above it when there is not
   * enough room below.
   *
   * This previously grew the page instead: on open, a menu that would overflow the
   * bottom of the viewport added matching padding to <body> and scrolled the window
   * down so the rows came into view. That was self-defeating. The scroll-dismissal
   * listener below is registered on `window` in the capture phase, so the very
   * `scrollBy` this performed was read as the reader scrolling, and closed the menu
   * again. On any card near the end of a long list the menu opened, scrolled, and
   * vanished in the same frame, which is indistinguishable from a dead control.
   *
   * Flipping keeps the menu entirely within the viewport, so nothing has to scroll
   * and there is no scroll to mistake for a dismissal.
   */
  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = 4 + items.length * MENU_ROW_HEIGHT + 8;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Only flip when it genuinely helps: a trigger near the top of a long list has
    // more room below than above, and flipping there would push the menu off the
    // top of the screen instead.
    const above = spaceBelow < menuHeight + VIEWPORT_GAP && spaceAbove > spaceBelow;

    const top = above
      ? Math.max(VIEWPORT_GAP, rect.top - VIEWPORT_GAP - menuHeight)
      : rect.bottom + VIEWPORT_GAP;

    // Clamped so the menu stays fully on screen when the trigger sits near the
    // right edge.
    const right = Math.max(
      VIEWPORT_GAP,
      Math.min(window.innerWidth - MENU_WIDTH, window.innerWidth - rect.right)
    );

    setPos({ top, right, above });
    setOpen(true);
  };

  /**
   * Dismissal.
   *
   * Registered in the capture phase on `window`, which is what lets it see a scroll
   * on any scrolling container rather than only on the page. Note that nothing in
   * this component scrolls the page any more: the menu flips above its trigger
   * instead of growing the document, so the only scrolls this can see are the
   * reader's own.
   */
  useEffect(() => {
    if (!open) return;

    const startY = window.scrollY;
    const startX = window.scrollX;

    const handleScroll = (event: Event) => {
      // A scroll dispatched at `window` has target `window`, which is not a Node,
      // and `Node.contains()` throws on one. That exception propagated out of the
      // listener and killed the dismissal entirely: a scroll neither closed the
      // menu nor ran any later handler.
      const target = event.target;
      const node = target instanceof Node ? target : null;

      // Scrolling inside the menu is fine; scrolling the page is not, because the
      // menu is positioned in viewport coordinates and would detach from it.
      if (menuRef.current && node && menuRef.current.contains(node)) return;
      const dy = Math.abs(window.scrollY - startY);
      const dx = Math.abs(window.scrollX - startX);
      const scrolledInner = node !== null && 'scrollTop' in node;
      if (dy > 4 || dx > 4 || scrolledInner) setOpen(false);
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
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
            className={`w-52 max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain rounded-2xl bg-[#0F1111] border border-[#1A1D1D] shadow-xl py-1.5 z-[9999] ${
              pos.above ? 'origin-bottom' : 'origin-top'
            }`}
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