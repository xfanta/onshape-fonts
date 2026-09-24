import type { MetadataRoute } from "next";

// Allow-all with the sitemap, and the answer-engine crawlers named so the
// intent is unambiguous to them too — the family's launch checklist. The
// Onshape panel (/panel, loaded inside Onshape) and the API are no pages.
export default function robots(): MetadataRoute.Robots {
  const disallow = ["/panel", "/api/"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...["GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Claude-Web", "Google-Extended", "Applebot-Extended"].map(
        (userAgent) => ({ userAgent, allow: "/", disallow }),
      ),
    ],
    sitemap: "https://onshape-fonts.vercel.app/sitemap.xml",
    host: "https://onshape-fonts.vercel.app",
  };
}
