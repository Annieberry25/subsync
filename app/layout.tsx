import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import { ADSENSE_CLIENT, ADSENSE_LOADER_SRC } from "@/lib/config/adsense";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://subhalt.xyz";

/**
 * `viewportFit: "cover"` is what makes `env(safe-area-inset-*)` resolve to a
 * non-zero value, which the floating dock depends on to clear the iOS home
 * indicator and the notch. `maximumScale` / `userScalable` are deliberately left
 * unset — disabling pinch-zoom is an accessibility failure.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SubHalt - Subscription Manager",
    template: "%s | SubHalt",
  },
  description: "Track, manage, and optimize all your recurring subscriptions seamlessly.",
  applicationName: "SubHalt",
  /**
   * iOS ignores the manifest for the home screen and reads these instead, so
   * without them "Add to Home Screen" produces a tiny text-only shortcut.
   * Next serves `app/apple-icon.png` and `app/icon.svg` as the icon files
   * themselves, so only the declaration is needed here.
   */
  appleWebApp: {
    capable: true,
    title: "SubHalt",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    // A numeric keypad in the price/phone fields is a feature; forcing
    // telephone detection would break it.
    telephone: false,
  },
  keywords: [
    "subscription manager",
    "bill tracking",
    "recurring payments",
    "subscription tracker",
    "Nigeria subscriptions",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "SubHalt",
    title: "SubHalt - Subscription Manager",
    description: "Track, manage, and optimize all your recurring subscriptions seamlessly.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SubHalt - Subscription Manager",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SubHalt - Subscription Manager",
    description: "Track, manage, and optimize all your recurring subscriptions seamlessly.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  /**
   * AdSense's own alternative verification method: a meta tag naming the
   * publisher account. Google accepts either this or the loader script, so
   * having both means site verification does not hang on a single mechanism.
   *
   * The script tag is the one you asked for, but it depends on how Next chooses
   * to serialise a third-party script in the App Router, and getting that wrong
   * is invisible locally -- the URL still appears in the HTML, just not as a
   * script element, which is all the checker matches on. This tag is emitted
   * natively by Next's metadata pipeline, so it cannot be reshaped that way.
   */
  other: {
    'google-adsense-account': ADSENSE_CLIENT,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} h-full antialiased dark`}
    >
      <body
        data-build={process.env.NEXT_PUBLIC_BUILD_SHA}
        className="min-h-full bg-[#101215] text-white font-sans overscroll-y-none"
      >
        {/*
          The AdSense loader, site-wide, for account verification.

          This is a literal <script> element on purpose. It was previously
          rendered with next/script and strategy="beforeInteractive", which looks
          equivalent but is not: that emits a <link rel="preload"> in the head
          plus an inline bootstrap that calls window.next_s.push([...]), and the
          actual <script src> is only created at runtime by client-side JS. The
          served HTML therefore contained the adsbygoogle.js URL but no script
          element referencing it at all.

          AdSense verification fetches the page and pattern-matches the HTML. It
          does not run JavaScript, so it saw no loader script and rejected the
          site with "We couldn't verify your site" even though the URL was
          present. React hoists a plain <script async src> into <head> during SSR,
          which produces exactly the markup Google's snippet asks for.

          Combined with the google-adsense-account meta tag in `metadata.other`,
          which is the officially supported alternative verification method and is
          emitted natively, so verification no longer depends on either mechanism
          alone.

          This does not enable auto ads. That is a dashboard-side setting, and the
          loader places nothing until something pushes to window.adsbygoogle —
          which nothing does until an ad slot is configured. So no ad and no
          placeholder render in the meantime.

          Requires the matching script-src allowance in next.config.ts; the
          Content-Security-Policy there would otherwise block it.
        */}
        <script async src={ADSENSE_LOADER_SRC} crossOrigin="anonymous" />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

