import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://subhalt.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SubHalt - Subscription Manager",
    template: "%s | SubHalt",
  },
  description: "Track, manage, and optimize all your recurring subscriptions seamlessly.",
  applicationName: "SubHalt",
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
      <body className="min-h-full bg-[#101215] text-white font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

