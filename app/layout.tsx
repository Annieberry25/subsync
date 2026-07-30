import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('subsync-theme');var r=document.documentElement;if(s==='ivory'){r.classList.remove('dark');r.classList.add('light','theme-ivory');}else if(s==='sand'){r.classList.remove('dark');r.classList.add('light','theme-sand');}else{r.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full bg-env-main text-env-body">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
