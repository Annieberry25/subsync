'use client';

import React from 'react';

interface SubHaltAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function SubHaltAvatar({ size = 'md', className = '' }: SubHaltAvatarProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-9 h-9',
    xl: 'w-11 h-11',
  }[size];

  const svgSizes = {
    sm: 20,
    md: 28,
    lg: 36,
    xl: 44,
  }[size];

  return (
    <div
      className={`relative rounded-xl bg-[#091512] border border-[#14B8A6]/40 flex items-center justify-center shrink-0 shadow-sm overflow-hidden ${sizeClasses} ${className}`}
      title="SubHalt AI Assistant"
      aria-label="SubHalt AI Assistant Avatar"
    >
      <svg
        width={svgSizes}
        height={svgSizes}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full p-1"
      >
        {/* Subtle background glow */}
        <circle cx="16" cy="16" r="14" fill="#14B8A6" fillOpacity="0.08" />

        {/* Outer subtle ring */}
        <circle cx="16" cy="16" r="13.5" stroke="#14B8A6" strokeWidth="1.2" strokeOpacity="0.35" />
        
        {/* Friendly abstract assistant head/shield shape */}
        <path
          d="M16 6.5C11.5 6.5 8.5 8.8 8.5 13.5V17.5C8.5 21.8 11.8 25 16 25.5C20.2 25 23.5 21.8 23.5 17.5V13.5C23.5 8.8 20.5 6.5 16 6.5Z"
          fill="#14B8A6"
          fillOpacity="0.18"
          stroke="#14B8A6"
          strokeWidth="1.4"
        />
        
        {/* Friendly glowing eyes (Two abstract horizontal pills) */}
        <rect x="12" y="13.5" width="2.5" height="2" rx="1" fill="#14B8A6" />
        <rect x="17.5" y="13.5" width="2.5" height="2" rx="1" fill="#14B8A6" />
        
        {/* SubHalt pulse spark mouth/smile indicator */}
        <path
          d="M13.5 19C14.5 20 17.5 20 18.5 19"
          stroke="#14B8A6"
          strokeWidth="1.4"
          strokeLinecap="round"
        />

        {/* Top small spark antenna dot */}
        <circle cx="16" cy="9" r="1" fill="#F5F7F6" />
      </svg>
    </div>
  );
}
