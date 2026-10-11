import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://subhalt.xyz";

/**
 * Served at /robots.txt, exactly:
 *
 *   User-agent: *
 *   Allow: /
 *
 *   Sitemap: https://subhalt.xyz/sitemap.xml
 *
 * Deliberately no `Disallow` rules. Every signed-out request to a protected
 * page is redirected to `/login`, so disallowing `/login` made Search Console
 * report the site as "Blocked by robots.txt" — the crawler followed the
 * redirect and landed on a blocked URL. Robots rules are also not a security
 * boundary: the data is protected by auth and Row Level Security, not by
 * asking crawlers to stay away.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
