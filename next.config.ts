import type { NextConfig } from "next";
import { execSync } from "node:child_process";

/**
 * Resolves a short commit SHA identifying the exact source this build came
 * from, inlined into the client bundle at build time.
 *
 * On Vercel `VERCEL_GIT_COMMIT_SHA` is injected automatically. Elsewhere (local
 * `dev`, a detached CI checkout) we fall back to asking git directly, and
 * finally to a literal so a missing git binary can never fail the build.
 */
function resolveBuildSha(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel.slice(0, 7);

  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_BUILD_SHA: resolveBuildSha(),
  },
  // pdfjs-dist ships a worker and WASM-backed decoders that must stay outside
  // the server bundle for the legacy build to resolve at runtime.
  serverExternalPackages: ['pdfjs-dist'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.logo.dev',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    // Matches lib/config/adsense.ts: the loader is only emitted (and only needs
    // network access) once an actual ad slot id has been configured. With no
    // slot the script-src allowance stays out of the header so the CSP no
    // longer whitelists a third-party host the app never loads.
    const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() || 'ca-pub-4851652738657758';
    const adsEnabled = Boolean(adsenseClient && process.env.NEXT_PUBLIC_ADSENSE_AD_SLOT?.trim());

    const scriptSources = ["'self'", "'unsafe-inline'"];
    // 'unsafe-eval' is only required by Next's dev-mode client runtime; the
    // production build does not use eval, so shipping the allowance production
    // weakens the CSP for no functional gain.
    if (process.env.NODE_ENV !== 'production') scriptSources.push("'unsafe-eval'");
    if (adsEnabled) scriptSources.push('https://pagead2.googlesyndication.com');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // pagead2.googlesyndication.com serves the AdSense loader declared
              // in app/layout.tsx, but it is only whitelisted (and only loaded)
              // once an ad slot id exists. Serving actual ad units later will
              // additionally need frame-src for googleads.g.doubleclick.net and
              // connect-src for the same host.
              `script-src ${scriptSources.join(' ')}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' https://img.logo.dev https://*.googleusercontent.com data: blob:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "connect-src 'self' https://open.er-api.com https://*.supabase.co wss://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
