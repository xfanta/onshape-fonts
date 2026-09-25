// The footer every xfanta product site shares — the other apps, grouped.
// Written once, in apps-web (src/lib/family.ts + apps.ts), and served as
// https://apps.xfanta.com/family.json. This site reads it at build time and
// once a day after (ISR), so a newly listed app shows up here without a
// change to this repo. This file and components/FamilyFooter.tsx are the same
// in every product site; copy changes to all of them.

export type Localized = { en: string } & Partial<Record<string, string>>;

export interface FamilyGlyph {
  viewBox: string;
  mode: "stroke" | "fill";
  paths: string[];
  strokeWidth?: number;
  /** An icon of the app's own, drawn instead of the glyph (full URL). */
  image?: string;
}

export interface Family {
  version: 1;
  heading: Localized;
  hub: { url: string; label: Localized };
  categories: {
    id: string;
    label: Localized;
    apps: { id: string; name: string; url: string; blurb: Localized; glyph: FamilyGlyph }[];
  }[];
}

// The query is part of the fetch cache's key. Vercel keeps that cache across
// deployments, so a redeploy alone can serve yesterday's list for up to a
// day; bumping `v` makes the next build fetch it fresh.
export const FAMILY_URL = "https://apps.xfanta.com/family.json?v=2";

/** Null when apps.xfanta.com cannot be reached — the page then renders
 *  without the block rather than failing, and the next daily revalidation
 *  tries again. */
export async function getFamily(): Promise<Family | null> {
  try {
    const res = await fetch(FAMILY_URL, { next: { revalidate: 86_400 } });
    if (!res.ok) return null;
    const data = (await res.json()) as Family;
    return data?.version === 1 && Array.isArray(data.categories) ? data : null;
  } catch {
    return null;
  }
}

export const pick = (text: Localized, locale: string) => text[locale] ?? text.en;
