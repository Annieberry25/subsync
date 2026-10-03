import type { MetadataRoute } from "next";
import { BILL_PAYMENT_ENABLED } from "@/lib/config/feature-flags";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://subhalt.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "",
    "/plans",
    "/help",
    "/settings",
    "/profile",
    "/export",
    ...(BILL_PAYMENT_ENABLED ? ["/bills"] : []),
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
