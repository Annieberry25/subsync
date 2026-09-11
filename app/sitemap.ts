import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://subhalt.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "",
    "/login",
    "/signup",
    "/plans",
    "/help",
    "/settings",
    "/profile",
    "/export",
    "/bills",
    "/history",
    "/history/all",
    "/history/archive",
    "/history/deleted",
    "/history/restored",
    "/renewals",
    "/inbox",
    "/subscriptions",
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
