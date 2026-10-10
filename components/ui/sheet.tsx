'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const emptySubscribe = () => () => {};

/* ------------------------------------------------------------------ *
 * Scroll lock
 *
 * Ref-counted on purpose. The More sheet can open a ConfirmDialog on top
 * of itself, and several pages keep more than one modal mounted. A naive
 * "set hidden on open, clear on close" implementation unlocks the page the
 * moment the inner dialog closes, letting the content behind scroll away
 * while the outer dialog is still visible.
 * ------------------------------------------------------------------ */
let lockCount = 0;

/**
 * Mirrors `lockCount > 0` onto the document element so floating UI (the dock
 * and the FAB) can step out of the way. Kept in sync here rather than by
 * each overlay so the two can never disagree.
 */
function syncOverlayFlag() {
  if (lockCount > 0) {
    document.documentElement.dataset.overlayOpen = 'true';
  } else {
    delete document.documentElement.dataset.overlayOpen;
  }
}

function lockScroll() {
  if (lockCount > 0) {
    lockCount += 1;
    return;
  }

  const scrollbarWidth =
    window.innerWidth - document.documentElement.clientWidth;

  // Lock both roots: with `html.h-full` in app/layout.tsx the document may
  // establish the scrolling box, in which case a body-only lock does nothing.
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  // Compensate for the removed scrollbar so the layout does not jump.
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }

  lockCount = 1;
  syncOverlayFlag();
}

function unlockScroll() {
  if (lockCount === 0) return;

  lockCount -= 1;
  if (lockCount > 0) return;

  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  syncOverlayFlag();
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const DRAG_DISMISS_THRESHOLD = 120;

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /**
   * DOM id for the dialog panel, so a trigger can point `aria-controls` at it.
   */
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /**
   * Controls rendered before the title, so a back chevron leads the heading
   * instead of trailing it next to the close button.
   */
  headerLeading?: React.ReactNode;
  /**
   * Extra controls rendered beside the close button. Used by dialogs that
   * carry their own header actions, e.g. the AI assistant's saved-conversation
   * toggle.
   */
  headerAction?: React.ReactNode;
  children?: React.ReactNode;
  /** Pinned to the bottom of the panel, outside the scrolling body. */
  footer?: React.ReactNode;
  showClose?: boolean;
  className?: string;
  bodyClassName?: string;
  /** Allow drag-to-dismiss. Off for dialogs that must be answered. */
  dismissible?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'full';
  /**
   * `center` is the default, but on phones it degrades to a bottom sheet with
   * top-rounded corners, which is both easier to reach and safer for the
   * one-handed case. `bottom` stays a sheet at every width.
   */
  placement?: 'center' | 'bottom';
}

const SIZE_CLASSES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  full: 'sm:max-w-4xl',
} as const;

export function Sheet({
  open,
  onClose,
  id,
  title,
  description,
  headerLeading,
  headerAction,
  children,
  footer,
  showClose = true,
  className = '',
  bodyClassName = '',
  dismissible = true,
  size = 'md',
  placement = 'center',
}: SheetProps) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const dragState = useRef<{ startY: number; offset: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const titleId = useId();
  const descriptionId = useId();

  /* Scroll lock + focus capture/restore. */
  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    lockScroll();

    return () => {
      unlockScroll();
      restoreFocusRef.current?.focus?.();
      restoreFocusRef.current = null;
    };
  }, [open]);

  /* Escape to dismiss, Tab to cycle within the panel. */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [dismissible, onClose],
  );

  useEffect(() => {
    if (!open) return;

    window.addEventListener('keydown', handleKeyDown);

    // Move focus inside the panel. rAF lets the entrance animation start from
    // a visible state instead of flashing the un-focused content.
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target =
        panel.querySelector<HTMLElement>('[data-sheet-autofocus]') ??
        panel.querySelector<HTMLElement>(FOCUSABLE) ??
        panel;
      target.focus();
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(frame);
    };
  }, [open, handleKeyDown]);

  /* Drag-to-dismiss. Pointer events only, so the panel still tracks the
   * finger when the gesture outruns the element's box. */
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dismissible || event.pointerType === 'mouse') return;
    dragState.current = { startY: event.clientY, offset: 0 };
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    if (!state) return;
    state.offset = Math.max(0, event.clientY - state.startY);
    setDragOffset(state.offset);
  };

  const handlePointerUp = () => {
    const state = dragState.current;
    dragState.current = null;
    setDragging(false);
    if (state && state.offset > DRAG_DISMISS_THRESHOLD) onClose();
    setDragOffset(0);
  };

  if (!open || !mounted) return null;

  const hasHeader = Boolean(title || description || headerAction || headerLeading);
  const isBottom = placement === 'bottom';

  const panel = (
    <div
      data-sheet-root=""
      className={`fixed inset-0 z-[70] flex justify-center bg-black/70 animate-in fade-in duration-200 ${
        isBottom ? 'items-end' : 'items-end sm:items-center'
      }`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        data-sheet-panel=""
        onClick={(event) => event.stopPropagation()}
        className={`w-full ${SIZE_CLASSES[size]} flex flex-col bg-[#0F1111] border border-[#1A1D1D] rounded-t-[20px] sm:rounded-[20px] outline-none max-h-[92dvh] sm:max-h-[85dvh] animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 ${className}`}
        style={
          dragOffset > 0
            ? {
                transform: `translateY(${dragOffset}px)`,
                transition: dragging ? 'none' : 'transform 200ms ease-out',
              }
            : undefined
        }
      >
        {dismissible && (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="shrink-0 pt-2.5 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none select-none"
            aria-hidden="true"
          >
            <div className="w-10 h-1 rounded-full bg-[#1A1D1D]" />
          </div>
        )}

        {hasHeader && (
          <div className="shrink-0 flex items-start justify-between gap-3 px-4 pt-3 pb-3 sm:px-5 sm:pt-4">
            {headerLeading && <div className="flex items-center shrink-0 -ml-2">{headerLeading}</div>}
            <div className="min-w-0 flex-1">
              {title && (
                <h2
                  id={titleId}
                  className="text-base sm:text-lg font-bold text-[#F5F7F6] tracking-tight leading-snug"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="text-sm text-[#94A3B8] mt-1">
                  {description}
                </p>
              )}
            </div>
            {headerAction && (
              <div className="flex items-center gap-2 shrink-0">
                {headerAction}
              </div>
            )}
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-11 h-11 shrink-0 -mr-1 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] flex items-center justify-center transition-colors cursor-pointer border border-[#1A1D1D]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div
          className={`flex-1 overflow-y-auto overscroll-contain -mx-px px-4 sm:px-5 ${
            hasHeader ? 'pb-2' : 'pt-1'
          } ${bodyClassName}`}
        >
          {children}
        </div>

        {footer && (
          <div
            className="shrink-0 border-t border-[#1A1D1D] px-4 py-3 sm:px-5 sm:py-4 pb-[max(0.75rem,var(--spacing-safe-b))] bg-[#0F1111] rounded-b-[20px]"
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

export default Sheet;
