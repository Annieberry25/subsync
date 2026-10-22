import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.subhalt.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "",
    "/features",
    "/how-it-works",
    "/about",
    "/help",
    "/privacy",
    "/terms",
    /*
     * Public routes only.
     *
     * Every other page the app serves sits behind the session guard and answers
     * 307 → /login for anyone who is not signed in — Googlebot included. Listing
     * them advertised twelve URLs that could only ever redirect, which Search
     * Console reports as redirect errors and spends crawl budget on pages that
     * cannot be indexed no matter how often they are fetched.
     *
     * Worth revisiting separately: /plans is an in-app checkout screen, so
     * nothing publicly indexable states what the plans cost. That is a content
     * decision, not a sitemap one.
     */
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
