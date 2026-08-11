'use client';

import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
  ariaLabel?: string;
  className?: string;
  minWidth?: string;
  alignRight?: boolean;
  variant?: 'default' | 'borderless';
}

const emptySubscribe = () => () => {};

export function CustomSelect({
  options,
  value,
  onChange,
  ariaLabel = 'Select option',
  className = '',
  minWidth = 'min-w-[110px]',
  alignRight = false,
  variant = 'default',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; minWidth: number }>({ top: 0, left: 0, minWidth: 0 });

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = Math.max(rect.width, 210);

    let leftPos = rect.left;
    if (alignRight) {
      leftPos = rect.right - dropdownWidth;
    }
    leftPos = Math.max(12, Math.min(window.innerWidth - dropdownWidth - 12, leftPos));

    setMenuPos({
      top: rect.bottom + 6,
      left: leftPos,
      minWidth: dropdownWidth,
    });
  }, [alignRight]);

  useEffect(() => {
    if (!isOpen) return;

    const initialWindowY = window.scrollY;
    const initialWindowX = window.scrollX;

    function handleScroll(e: Event) {
      const target = e.target as Element | null;
      if (target && target.closest && target.closest('[data-custom-select-popover]')) {
        return;
      }

      const dy = Math.abs(window.scrollY - initialWindowY);
      const dx = Math.abs(window.scrollX - initialWindowX);

      const isScrollableElement = target && target !== (document as unknown) && target !== (window as unknown) && 'scrollTop' in target;

      if (dy > 4 || dx > 4 || isScrollableElement) {
        setIsOpen(false);
      }
    }

    function handleResize() {
      setIsOpen(false);
    }

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        const targetEl = target as Element;
        if (!targetEl.closest('[data-custom-select-popover]')) {
          setIsOpen(false);
        }
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const portalMenu = isOpen && mounted
    ? createPortal(
        <div
          data-custom-select-popover="true"
          style={{
            position: 'fixed',
            top: `${menuPos.top}px`,
            left: `${menuPos.left}px`,
            minWidth: `${menuPos.minWidth}px`,
          }}
          className={`p-1.5 rounded-2xl bg-[#0F1111] border border-[#1A1D1D] z-50 animate-in fade-in duration-100 max-w-[280px] ${
            alignRight ? 'origin-top-right' : 'origin-top-left'
          }`}
        >
          <div className="py-1 space-y-0.5 max-h-60 overflow-y-auto no-scrollbar">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-5 py-2.5 min-h-[40px] rounded-xl text-xs font-medium transition-colors text-left cursor-pointer capitalize ${
                    isSelected
                      ? 'bg-[#14B8A6] text-[#091512] font-semibold'
                      : 'text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D]'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 ml-3 text-[#091512] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )
    : null;

  const isBorderless = variant === 'borderless';

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${!isBorderless && minWidth.includes('w-full') ? 'w-full' : ''}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        className={
          isBorderless
            ? `flex items-center gap-1.5 py-1 text-sm font-medium text-[#F5F7F6] hover:text-[#F5F7F6]/80 transition-colors cursor-pointer group outline-none focus:outline-none bg-transparent border-none ${className}`
            : `flex items-center justify-between gap-3 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] border border-[#1A1D1D] text-xs font-medium text-[#F5F7F6] transition-colors cursor-pointer group ${minWidth} ${className}`
        }
      >
        <span className="truncate tracking-wide pr-0.5">{selectedOption.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#F5F7F6] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-[#14B8A6]' : ''
          }`}
        />
      </button>

      {portalMenu}
    </div>
  );
}
