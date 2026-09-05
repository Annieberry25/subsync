'use client';

import React from 'react';

interface SubHaltAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  avatarUrl?: string;
}

/**
 * SubHalt Assistant Avatar Character
 * An original, friendly, anime/cartoon-inspired human character representing SubHalt Assistant.
 * Designed with SubHalt brand identity: Teal Green (#14B8A6) and Dark Neutral tone.
 */
export function SubHaltAvatar({ size = 'md', className = '', avatarUrl }: SubHaltAvatarProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-9 h-9',
    xl: 'w-11 h-11',
    '2xl': 'w-16 h-16',
  }[size];

  const svgSizes = {
    sm: 20,
    md: 28,
    lg: 36,
    xl: 44,
    '2xl': 64,
  }[size];

  if (avatarUrl) {
    return (
      <div
        className={`relative rounded-xl bg-[#091512] border border-[#14B8A6]/40 flex items-center justify-center shrink-0 shadow-sm overflow-hidden ${sizeClasses} ${className}`}
        title="SubHalt Assistant"
        aria-label="SubHalt Assistant Avatar"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="SubHalt Assistant" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-xl bg-gradient-to-b from-[#0F1E1B] to-[#080D0C] border border-[#14B8A6]/40 flex items-center justify-center shrink-0 shadow-md overflow-hidden ${sizeClasses} ${className}`}
      title="SubHalt Assistant"
      aria-label="SubHalt Assistant Avatar"
    >
      <svg
        width={svgSizes}
        height={svgSizes}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="hairGrad" x1="16" y1="8" x2="48" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14B8A6" />
            <stop offset="60%" stopColor="#0F766E" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
          <linearGradient id="skinGrad" x1="32" y1="20" x2="32" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>
          <linearGradient id="jacketGrad" x1="16" y1="44" x2="48" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <radialGradient id="bgGlow" cx="32" cy="32" r="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#14B8A6" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Glow */}
        <circle cx="32" cy="32" r="30" fill="url(#bgGlow)" />

        {/* Dark Jacket / Neck Line */}
        <path
          d="M12 60C12 50 20 44 32 44C44 44 52 50 52 60V64H12V60Z"
          fill="url(#jacketGrad)"
        />
        {/* Teal Jacket Collar Accents */}
        <path d="M22 45L32 54L42 45" stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round" />

        {/* Neck */}
        <rect x="28" y="38" width="8" height="8" rx="2" fill="#E2E8F0" />

        {/* Human Face Shape */}
        <path
          d="M20 22C20 15 25 14 32 14C39 14 44 15 44 22V30C44 37 39 42 32 42C25 42 20 37 20 30V22Z"
          fill="url(#skinGrad)"
        />

        {/* Anime Hair - Layer Back */}
        <path
          d="M16 26C14 20 17 10 32 8C47 10 50 20 48 26C45 16 39 12 32 12C25 12 19 16 16 26Z"
          fill="#0F766E"
        />

        {/* Anime Hair - Bangs Front & Sides */}
        <path
          d="M17 21C21 21 24 16 27 20C30 15 35 15 38 19C41 16 45 20 47 22C45 15 39 9 32 9C25 9 19 14 17 21Z"
          fill="url(#hairGrad)"
        />

        {/* Expressive Anime Eyes (Teal Iris & Dark Pupil) */}
        {/* Left Eye */}
        <ellipse cx="26" cy="27" rx="3" ry="3.5" fill="#0F172A" />
        <ellipse cx="26" cy="27" rx="2" ry="2.5" fill="#14B8A6" />
        <circle cx="25.2" cy="26" r="0.8" fill="#FFFFFF" />

        {/* Right Eye */}
        <ellipse cx="38" cy="27" rx="3" ry="3.5" fill="#0F172A" />
        <ellipse cx="38" cy="27" rx="2" ry="2.5" fill="#14B8A6" />
        <circle cx="37.2" cy="26" r="0.8" fill="#FFFFFF" />

        {/* Soft Eyebrows */}
        <path d="M23 21.5C25 20.5 28 21 28 21.5" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M36 21.5C36 21 39 20.5 41 21.5" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" />

        {/* Friendly Smile */}
        <path
          d="M28.5 35C30 36.5 34 36.5 35.5 35"
          stroke="#0F172A"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        {/* Smart Teal Earpiece / Assistant Hairpin */}
        <rect x="44" y="25" width="3" height="7" rx="1.5" fill="#14B8A6" />
        <circle cx="45.5" cy="28.5" r="1" fill="#FFFFFF" />
      </svg>
    </div>
  );
}
