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

const FAMILIES_TTL_MS = 24 * 60 * 60 * 1000;
let familiesCache: CacheEntry<GoogleFontFamily[]> | null = null;

export function isGoogleFontsEnabled(): boolean {
  return !!getGoogleEnv().GOOGLE_FONTS_API_KEY;
}

export async function listGoogleFamilies(): Promise<GoogleFontFamily[]> {
  const key = getGoogleEnv().GOOGLE_FONTS_API_KEY;
  if (!key) throw new Error("GOOGLE_FONTS_API_KEY not set");
  if (familiesCache && familiesCache.expires > Date.now()) {
    return familiesCache.value;
  }
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
  familiesCache = { value: items, expires: Date.now() + FAMILIES_TTL_MS };
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
