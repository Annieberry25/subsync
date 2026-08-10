import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SubSync - Subscription Manager",
  description: "Track, manage, and optimize all your recurring subscriptions seamlessly.",
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

