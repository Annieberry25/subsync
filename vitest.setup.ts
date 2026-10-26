import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import React from 'react';

/*
 * The suite drives real forms with user-event, which types character by
 * character and waits for React between each one. The default five-second
 * budget is enough on an idle machine and not enough on a loaded one, where a
 * form test that types a provider name can sit waiting for a re-render while
 * the machine is busy with the rest of the suite.
 */
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

/*
 * jsdom does not implement scrolling. The subscriptions page highlights a row
 * and scrolls it into view from inside a timer that fires after its test has
 * finished, so without a stub the call lands as an unhandled error — and on a
 * page whose deep links all carry the highlight param, that is every second
 * suite touching it.
 */
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

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
