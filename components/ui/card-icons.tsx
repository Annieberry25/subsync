'use client';

import React from 'react';

export function MastercardIcon({ className = "w-8 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="24" rx="4" fill="#141718" stroke="#272A2C" strokeWidth="1" />
      <circle cx="14" cy="12" r="6.5" fill="#EB001B" />
      <circle cx="22" cy="12" r="6.5" fill="#F79E1B" fillOpacity="0.9" />
    </svg>
  );
}

export function VisaIcon({ className = "w-8 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="24" rx="4" fill="#141718" stroke="#272A2C" strokeWidth="1" />
      <path d="M13.8 16.5L15.6 7.5H18L16.2 16.5H13.8ZM22.5 7.7C22 7.5 21.3 7.3 20.4 7.3C18.2 7.3 16.7 8.4 16.7 10C16.7 11.2 17.8 11.8 18.6 12.2C19.4 12.6 19.7 12.9 19.7 13.3C19.7 13.9 19 14.2 18.2 14.2C17.3 14.2 16.7 14 16.1 13.7L15.6 15.8C16.3 16.1 17.3 16.3 18.3 16.3C20.7 16.3 22.2 15.2 22.2 13.5C22.2 11.4 19.3 11.2 19.3 10.3C19.3 10 19.6 9.6 20.4 9.6C21 9.6 21.7 9.7 22.1 9.9L22.5 7.7ZM27 16.5H29.1L27.3 7.5H25.4C24.9 7.5 24.5 7.8 24.3 8.2L20.8 16.5H23.3L23.8 15.1H26.7L27 16.5ZM24.5 13.2L25.6 10.1L26.3 13.2H24.5ZM12.2 7.5L9.9 13.6L9.6 12.2C9.2 10.7 7.8 8.9 6.2 8.1L8.3 16.5H10.8L14.7 7.5H12.2Z" fill="#1B449C" />
    </svg>
  );
}

export function CardIcon({ brand, className = "w-8 h-5" }: { brand: string; className?: string }) {
  const b = brand.toLowerCase();
  if (b.includes('visa')) return <VisaIcon className={className} />;
  return <MastercardIcon className={className} />;
}
