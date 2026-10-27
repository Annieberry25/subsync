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
  /*
   * ...and the worker's files must still be traced into the deployment.
   *
   * `serverExternalPackages` only stops Next.js from bundling pdf.js; it does not
   * copy anything into the output. pdf.js reads a document by spinning up
   * `pdf.worker.mjs` through a dynamic import, so on Vercel the request failed
   * with `Setting up fake worker failed: Cannot find module
   * '/var/task/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'` and every
   * PDF upload was rejected. Nothing was wrong with the files people uploaded.
   *
   * The whole legacy build directory is traced rather than just the worker, because
   * the decoders sit beside it and are loaded the same way.
   */
  outputFileTracingIncludes: {
    '/*': ['./node_modules/pdfjs-dist/legacy/build/**/*'],
  },
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
    const scriptSources = ["'self'", "'unsafe-inline'"];
    // 'unsafe-eval' is only required by Next's dev-mode client runtime; the
    // production build does not use eval, so shipping the allowance production
    // weakens the CSP for no functional gain.
    if (process.env.NODE_ENV !== 'production') scriptSources.push("'unsafe-eval'");

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // `camera=(self)` is what lets the receipt scanner open the camera:
          // `camera=()` denies `getUserMedia` outright, so the snap-a-receipt
          // button would fail on every device.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
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
