import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import React from 'react';

afterEach(() => {
  cleanup();
});

vi.mock('next/font/google', () => ({
  Space_Grotesk: () => ({ variable: '--font-space-grotesk' }),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, src, alt, ...rest } = props as {
      fill?: boolean;
      src: string;
      alt: string;
    };
    // `unoptimized` is a Next.js-only prop; forwarding it makes React warn.
    delete (rest as Record<string, unknown>).unoptimized;
    const style = fill
      ? { ...(rest.style as object), position: 'absolute', inset: 0, width: '100%', height: '100%' }
      : rest.style;
    return React.createElement('img', { src, alt, ...rest, style });
  },
}));
