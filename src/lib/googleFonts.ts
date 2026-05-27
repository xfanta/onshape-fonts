import { kv } from "@vercel/kv";
import { getGoogleEnv } from "./env";

export interface GoogleFontFamily {
  family: string;
  category: string;
  variants: string[];
  subsets: string[];
  files: Record<string, string>;
}

interface CacheEntry<T> {
  value: T;
  expires: number;
}

// 3-tier cache for the family list:
//   1) in-memory (fastest, lambda-local, lost on cold start)
//   2) Vercel KV (persistent across cold starts, globally shared)
//   3) Google Fonts API (the source of truth — only on miss in 1+2)
// 24 h TTL is fine: Google adds ~one font per month, and the worst
// case of a 24 h delay before a new face shows up is acceptable.
const FAMILIES_TTL_MS = 24 * 60 * 60 * 1000;
const FAMILIES_TTL_SECONDS = 24 * 60 * 60;
const KV_FAMILIES_KEY = "gf:families:v1";

let familiesCache: CacheEntry<GoogleFontFamily[]> | null = null;

export function isGoogleFontsEnabled(): boolean {
  return !!getGoogleEnv().GOOGLE_FONTS_API_KEY;
}

export async function listGoogleFamilies(): Promise<GoogleFontFamily[]> {
  const key = getGoogleEnv().GOOGLE_FONTS_API_KEY;
  if (!key) throw new Error("GOOGLE_FONTS_API_KEY not set");

  // Tier 1: in-memory.
  if (familiesCache && familiesCache.expires > Date.now()) {
    return familiesCache.value;
  }

  // Tier 2: Vercel KV. Survives cold starts; first hit on a new region
  // pays one ~10 ms KV round-trip instead of a Google API call.
  try {
    const cached = await kv.get<GoogleFontFamily[]>(KV_FAMILIES_KEY);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      familiesCache = {
        value: cached,
        expires: Date.now() + FAMILIES_TTL_MS,
      };
      return cached;
    }
  } catch (e) {
    // KV unavailable (local dev without KV_REST_API_URL, network blip,
    // etc.) is non-fatal — we fall through to Google.
    console.warn("[googleFonts] KV read failed, falling back to API:", e);
  }

  // Tier 3: Google Fonts API.
  const url = new URL("https://www.googleapis.com/webfonts/v1/webfonts");
  url.searchParams.set("key", key);
  url.searchParams.set("sort", "popularity");
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Google Fonts API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { items: GoogleFontFamily[] };
  const items: GoogleFontFamily[] = json.items.map((it) => ({
    family: it.family,
    category: it.category,
    variants: it.variants,
    subsets: it.subsets ?? [],
    files: it.files,
  }));

  // Populate tier 1 and tier 2.
  familiesCache = { value: items, expires: Date.now() + FAMILIES_TTL_MS };
  try {
    await kv.set(KV_FAMILIES_KEY, items, { ex: FAMILIES_TTL_SECONDS });
  } catch (e) {
    console.warn("[googleFonts] KV write failed (non-fatal):", e);
  }

  return items;
}

export function pickFileUrl(
  fam: GoogleFontFamily,
  variant: string,
): string | null {
  if (fam.files[variant]) return upgradeToHttps(fam.files[variant]);
  if (fam.files.regular) return upgradeToHttps(fam.files.regular);
  const first = Object.values(fam.files)[0];
  return first ? upgradeToHttps(first) : null;
}

function upgradeToHttps(u: string): string {
  return u.startsWith("http://") ? `https://${u.slice("http://".length)}` : u;
}

export async function fetchFontFile(url: string): Promise<{
  buffer: ArrayBuffer;
  contentType: string;
}> {
  if (!url.startsWith("https://fonts.gstatic.com/")) {
    throw new Error(`Refusing to fetch non-gstatic URL: ${url}`);
  }
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Font fetch ${res.status}`);
  const buffer = await res.arrayBuffer();
  return {
    buffer,
    contentType: res.headers.get("content-type") ?? "font/ttf",
  };
}
