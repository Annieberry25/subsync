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
    // Clamp inside viewport
    leftPos = Math.max(12, Math.min(window.innerWidth - dropdownWidth - 12, leftPos));

    setMenuPos({
      top: rect.bottom + 6,
      left: leftPos,
      minWidth: dropdownWidth,
    });
  }, [alignRight]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Close dropdown on outside click
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

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
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
          className="glass-popover p-1.5 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 border border-env-main max-w-[280px]"
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
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 min-h-[40px] rounded-xl text-xs font-semibold transition-all text-left cursor-pointer capitalize ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-env-body hover:text-env-heading hover:bg-env-button-sec'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 ml-3 text-white shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${minWidth.includes('w-full') ? 'w-full' : ''}`}>
      {/* Custom SelectTrigger Pill */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        className={`flex items-center justify-between gap-3 px-4 py-2.5 min-h-[44px] rounded-2xl bg-env-input hover:bg-env-button-sec-hover border border-env-main text-xs font-extrabold text-env-heading transition-all shadow-sm cursor-pointer group ${minWidth} ${className}`}
      >
        <span className="truncate capitalize tracking-wide pr-1">{selectedOption.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-env-muted group-hover:text-env-heading transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-env-accent' : ''
          }`}
        />
      </button>

      {portalMenu}
    </div>
  );
}
