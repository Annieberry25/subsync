'use client';

import { useState, useRef, useEffect } from 'react';
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
}

export function CustomSelect({
  options,
  value,
  onChange,
  ariaLabel = 'Select option',
  className = '',
  minWidth = 'min-w-[110px]',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* Custom SelectTrigger Pill with Intentional Minimum Width & Generous Spacing */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        className={`flex items-center justify-between gap-3.5 px-4.5 py-2.5 min-h-[40px] rounded-2xl bg-env-button-sec hover:bg-env-button-sec-hover border border-env-main text-xs font-extrabold text-env-heading transition-all shadow-sm cursor-pointer group ${minWidth} ${className}`}
      >
        <span className="truncate capitalize tracking-wide pr-1">{selectedOption.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-env-muted group-hover:text-env-heading transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-env-accent' : ''
          }`}
        />
      </button>

      {/* Custom Glass Dropdown Popup */}
      {isOpen && (
        <div className="absolute left-0 mt-2 min-w-full w-max max-w-[260px] glass-panel p-1.5 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 border border-env-main">
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
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer capitalize ${
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
        </div>
      )}
    </div>
  );
}
