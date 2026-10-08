import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ServiceIcon } from '@/components/ui/service-icon';

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe('ServiceIcon', () => {
  it('renders a real logo image for a known provider when no logo.dev token is configured', () => {
    // Regression: the component previously returned a monogram unconditionally
    // without NEXT_PUBLIC_LOGO_DEV_TOKEN, so every provider rendered generated
    // letters. No-key sources must be attempted instead.
    render(<ServiceIcon name="Spotify" />);

    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    expect(img.src).toMatch(/^https:\/\//);
    expect(img.src).not.toContain('img.logo.dev');
    expect(screen.queryByText('SP')).not.toBeInTheDocument();
  });

  it('prefers logo.dev when a token is present', () => {
    process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN = 'test-token';
    render(<ServiceIcon name="Netflix" />);

    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.src).toContain('img.logo.dev/netflix.com');
    expect(img.src).toContain('token=test-token');
  });

  it('falls back to initials only after every logo source has failed', () => {
    render(<ServiceIcon name="Spotify" />);

    // Two no-key sources are tried; each error advances to the next one.
    // React reuses the same <img> node, so snapshot the src before firing.
    const firstSrc = (screen.getByRole('img') as HTMLImageElement).src;
    expect(firstSrc).toContain('duckduckgo.com');

    fireEvent.error(screen.getByRole('img'));
    const secondSrc = (screen.getByRole('img') as HTMLImageElement).src;
    expect(secondSrc).not.toBe(firstSrc);
    expect(secondSrc).toContain('google.com');

    fireEvent.error(screen.getByRole('img'));

    // Exhausted: the monogram is the honest last resort.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('SP')).toBeInTheDocument();
  });

  it('resets the source chain when the resolved domain changes', () => {
    const { rerender } = render(<ServiceIcon name="Spotify" />);

    fireEvent.error(screen.getByRole('img'));
    const secondSrc = (screen.getByRole('img') as HTMLImageElement).src;
    expect(secondSrc).toContain('google.com');

    rerender(<ServiceIcon name="Netflix" />);
    // Back to the first source for the new domain.
    expect((screen.getByRole('img') as HTMLImageElement).src).toContain('duckduckgo.com');
    expect((screen.getByRole('img') as HTMLImageElement).src).toContain('netflix.com');
  });

  it('renders the SubHalt brand mark instead of fetching a third-party logo', () => {
    const { container } = render(<ServiceIcon name="SubHalt" />);

    // The real artwork comes from public/, never a logo CDN: the row the
    // customer just paid for has to look like the product they bought.
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toContain('logo_icon');
    expect(img.getAttribute('src')).not.toMatch(/^https:\/\//);

    // The wrapper carries the accessible name and the caller's box.
    const wrapper = screen.getByRole('img', { name: 'SubHalt' });
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.className).toContain('w-10 h-10');
  });
});
