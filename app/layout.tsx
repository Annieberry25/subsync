import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

/**
 * Google AdSense loader, inlined rather than imported from lib/config/adsense.
 *
 * It has to live here so this file deploys on its own. The shared constant is
 * part of a larger change to that module which is not going out with this
 * commit, and importing a symbol that does not exist in the deployed revision
 * fails the build outright — which would ship nothing at all.
 *
 * Keep it in sync with ADSENSE_CLIENT in lib/config/adsense.ts when that change
 * does land.
 */
const ADSENSE_CLIENT = "ca-pub-4851652738657758";
const ADSENSE_LOADER_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

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

          `beforeInteractive` is required rather than the default
          `afterInteractive`: verification crawlers read the server-rendered HTML
          and look for this exact script, so it has to be in the document Next
          sends rather than appended after hydration. Next only honours the
          strategy from the root layout, which is where this sits.

          This does not enable auto ads. That is a dashboard setting, and the
          loader places nothing until something pushes to `window.adsbygoogle`
          — which nothing does until an ad slot is configured. So the site shows
          no ad and no placeholder in the meantime.

          Requires the matching `script-src` allowance in next.config.ts; the
          Content-Security-Policy there would otherwise block it.
        */}
        <Script
          async
          src={ADSENSE_LOADER_SRC}
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

