import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandWordmark, BrandMark } from '@/components/ui/brand-logo';

const nextImageMock = vi.hoisted(() => ({ srcs: [] as string[] }));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...rest }: { src: string; alt: string } & Record<string, unknown>) => {
    nextImageMock.srcs.push(src);
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...rest} />;
  },
}));

describe('BrandWordmark', () => {
  it('sources the dark variant from the public dark-background logo', () => {
    render(<BrandWordmark />);

    const img = screen.getByAltText('SubHalt');
    expect(img).toHaveAttribute('src', expect.stringContaining('logo_black_bg'));
  });

  it('sources the light variant from the public light-background logo', () => {
    render(<BrandWordmark variant="light" />);

    expect(screen.getByAltText('SubHalt')).toHaveAttribute(
      'src',
      expect.stringContaining('logo_white_bg')
    );
  });

  it('reads from public/ rather than a derived brand folder', () => {
    render(<BrandWordmark />);
    render(<BrandMark />);

    for (const src of nextImageMock.srcs) {
      expect(src).not.toContain('/brand/');
    }
  });

  it('crops the transparent 2000px canvas down to the artwork bounds', () => {
    render(<BrandWordmark height={30} />);

    const wrapper = screen.getByAltText('SubHalt').parentElement as HTMLElement;

    // Wordmark artwork is 1103x303 inside a 2000x2000 canvas, so the visible
    // box matches the artwork's aspect.
    expect(wrapper.className).toContain('overflow-hidden');
    expect(wrapper.style.height).toBe('30px');
    expect(wrapper.style.width).toBe(`${(30 * 1103) / 303}px`);

    const img = screen.getByAltText('SubHalt');
    const scale = 30 / 303;
    expect(img.style.height).toBe(`${2000 * scale}px`);
    expect(img.style.width).toBe(`${2000 * scale}px`);
  });

  it('offsets by the artwork origin, not the canvas centre', () => {
    render(<BrandWordmark height={30} />);

    /* The wordmark artwork sits at x=359, y=819 in the 2000px square — its
       centre is 90px left of the canvas centre. A -50%/-50% centring transform
       would therefore push the logo left and clip it against the wrapper's
       overflow-hidden edge, so the offset must come from the artwork origin. */
    const img = screen.getByAltText('SubHalt');
    const scale = 30 / 303;
    expect(img.style.left).toBe(`${-359 * scale}px`);
    expect(img.style.top).toBe(`${-819 * scale}px`);
    expect(img.className).not.toContain('-translate-x-1/2');
    expect(img.className).not.toContain('-translate-y-1/2');
  });

  it('places the mark artwork origin exactly too', () => {
    render(<BrandMark size={32} />);

    const img = screen.getByAltText('SubHalt');
    const scale = 32 / 432;
    expect(img.style.left).toBe(`${-790 * scale}px`);
    expect(img.style.top).toBe(`${-784 * scale}px`);
  });

  it('keeps the accessible name on every brand surface', () => {
    render(<BrandWordmark />);
    render(<BrandMark />);

    expect(screen.getAllByAltText('SubHalt')).toHaveLength(2);
  });
});

describe('BrandMark', () => {
  it('sources the mark from the public icon logo', () => {
    render(<BrandMark />);

    expect(screen.getByAltText('SubHalt')).toHaveAttribute(
      'src',
      expect.stringContaining('logo_icon')
    );
  });

  it('renders a square box sized to the prop', () => {
    render(<BrandMark size={32} />);

    const wrapper = screen.getByAltText('SubHalt').parentElement as HTMLElement;
    expect(wrapper.style.width).toBe('32px');
    expect(wrapper.style.height).toBe('32px');
    expect(wrapper.className).toContain('shrink-0');
  });

  it('scales the inner image by the mark artwork ratio (420x432)', () => {
    render(<BrandMark size={32} />);

    const img = screen.getByAltText('SubHalt');
    expect(img.style.height).toBe(`${(32 * 2000) / 432}px`);
    expect(img.style.width).toBe(`${(32 * 2000) / 432}px`);
  });
});
