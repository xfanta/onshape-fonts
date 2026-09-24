import type { MetadataRoute } from "next";

const SITE = "https://onshape-fonts.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const at = new Date("2026-09-24");
  return [
    { url: SITE, lastModified: at, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE}/preview`, lastModified: at, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/privacy`, lastModified: at, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/terms`, lastModified: at, changeFrequency: "yearly", priority: 0.2 },
  ];
}
