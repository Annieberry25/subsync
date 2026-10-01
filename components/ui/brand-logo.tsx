'use client';

import Image from 'next/image';

/**
 * Single source of truth for SubHalt brand imagery. Every surface references the
 * artwork in public/ directly — /logo_icon.png, /logo_black_bg.png,
 * /logo_white_bg.png — so there is only ever one copy to replace.
 *
 * ## Why the crop wrapper exists
 *
 * All three source files are 2000x2000 canvases with the artwork surrounded by
 * transparent padding. The mark occupies only ~21% of its canvas width, so
 * rendering the file straight into a 32px slot would draw ~7px of artwork
 * inside a mostly-empty box, and the wordmark would arrive with the same huge
 * margin around it.
 *
 * Rather than keep trimmed copies, each variant crops in place: the wrapper is
 * the visible box sized to the artwork, and the image inside is scaled so that
 * the artwork's own bounding box lands exactly on the wrapper.
 *
 * The offsets are not decorative. The mark is centred in its canvas, but the
 * wordmark is NOT — its artwork sits at x=359, y=819 in the 2000px square, so
 * its centre is 90px left of and 30px above the canvas centre. Centring the
 * <img> on the wrapper (`-translate-x-1/2 -translate-y-1/2`) therefore pushed
 * the wordmark left and clipped it against the wrapper's overflow-hidden edge.
 * Each variant below now offsets by the artwork's real origin instead.
 */

/**
 * Artwork bounding box inside the 2000x2000 source canvases, as
 * { x, y, width, height } measured from the top-left of the canvas.
 *
 * If the source files are re-exported with different padding these need
 * re-measuring — the crop maths is derived directly from them.
 */
const ART = {
  mark: { x: 790, y: 784, width: 420, height: 432 },
  wordmark: { x: 359, y: 819, width: 1103, height: 303 },
} as const;

const CANVAS = 2000;

type ArtBox = (typeof ART)[keyof typeof ART];

/**
 * Wrapper + image pair that shows exactly `box` scaled to the requested height
 * (for a wordmark) or edge length (for the square mark).
 */
function CroppedLogo({
  src,
  box,
  height,
  width,
  alt,
  className,
  innerClassName,
  priority,
}: {
  src: string;
  box: ArtBox;
  /** Rendered height of the artwork in px. */
  height: number;
  /** Rendered width of the artwork in px. */
  width: number;
  alt: string;
  className: string;
  innerClassName: string;
  priority?: boolean;
}) {
  // Source pixels -> CSS pixels.
  const scale = height / box.height;
  const rendered = CANVAS * scale;

  return (
    <span
      className={`relative inline-block overflow-hidden align-middle ${className}`}
      style={{ height: `${height}px`, width: `${width}px` }}
    >
      <Image
        src={src}
        alt={alt}
        width={CANVAS}
        height={CANVAS}
        priority={priority}
        unoptimized
        className={`absolute max-w-none ${innerClassName}`}
        // Place the artwork's top-left corner on the wrapper's top-left corner.
        // No centring transform: the artwork is not centred in its canvas.
        style={{
          height: `${rendered}px`,
          width: `${rendered}px`,
          left: `${-box.x * scale}px`,
          top: `${-box.y * scale}px`,
        }}
      />
    </span>
  );
}

const SOURCES = {
  mark: '/logo_icon.png',
  wordmarkOnDark: '/logo_black_bg.png',
  wordmarkOnLight: '/logo_white_bg.png',
} as const;

export type BrandWordmarkVariant = 'dark' | 'light';

interface BrandWordmarkProps {
  /**
   * Surface the wordmark sits on. The wordmark bakes its own colours in, so it
   * cannot adapt via CSS: 'dark' is white "Sub" + teal "Halt" for the app's
   * dark shell, 'light' is near-black "Sub" + teal "Halt" for white surfaces.
   */
  variant?: BrandWordmarkVariant;
  /** Rendered height in px. Width follows the artwork's 1103x303 ratio. */
  height?: number;
  className?: string;
  priority?: boolean;
}

export function BrandWordmark({
  variant = 'dark',
  height = 24,
  className = '',
  priority = false,
}: BrandWordmarkProps) {
  const box = ART.wordmark;

  return (
    <CroppedLogo
      src={variant === 'dark' ? SOURCES.wordmarkOnDark : SOURCES.wordmarkOnLight}
      box={box}
      height={height}
      width={(height * box.width) / box.height}
      alt="SubHalt"
      className={className}
      innerClassName="shrink-0"
      priority={priority}
    />
  );
}

interface BrandMarkProps {
  /** Rendered edge length in px. */
  size?: number;
  className?: string;
  priority?: boolean;
}

/** The circular mark on its own, for collapsed rails and square icon slots. */
export function BrandMark({ size = 32, className = '', priority = false }: BrandMarkProps) {
  return (
    <CroppedLogo
      src={SOURCES.mark}
      box={ART.mark}
      height={size}
      width={size}
      alt="SubHalt"
      className={`shrink-0 ${className}`}
      innerClassName="shrink-0"
      priority={priority}
    />
  );
}

export default BrandWordmark;
