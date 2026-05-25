"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Font } from "opentype.js";
import { loadFontFromBuffer } from "@/lib/textToCurves";

export interface GoogleMeta {
  family: string;
  category: string;
  variants: string[];
  subsets: string[];
}

export type SelectedFont =
  | { kind: "google"; family: string; variant: string }
  | { kind: "uploaded"; key: string; family: string };

export interface ParsedVariant {
  weight: number;
  italic: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  "sans-serif": "Sans",
  serif: "Serif",
  display: "Display",
  handwriting: "Handwriting",
  monospace: "Mono",
};

// Representative font for each category, rendered in that font on the
// filter button so the user can read the category in its own style.
const CATEGORY_PREVIEW_FONT: Record<string, string> = {
  "sans-serif": "Roboto",
  serif: "Playfair Display",
  display: "Lobster",
  handwriting: "Pacifico",
  monospace: "Roboto Mono",
};

const COMMON_SUBSETS = [
  "latin",
  "latin-ext",
  "cyrillic",
  "cyrillic-ext",
  "greek",
  "greek-ext",
  "vietnamese",
  "hebrew",
  "arabic",
  "devanagari",
  "thai",
  "japanese",
  "korean",
  "chinese-simplified",
  "chinese-traditional",
];

const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

export function parseVariant(v: string): ParsedVariant {
  if (v === "regular") return { weight: 400, italic: false };
  if (v === "italic") return { weight: 400, italic: true };
  const italic = v.endsWith("italic");
  const wStr = italic ? v.slice(0, -"italic".length) : v;
  const w = parseInt(wStr, 10);
  return { weight: Number.isFinite(w) ? w : 400, italic };
}

export function buildVariant(weight: number, italic: boolean): string {
  if (weight === 400) return italic ? "italic" : "regular";
  return `${weight}${italic ? "italic" : ""}`;
}

interface UploadedEntry {
  key: string;
  family: string;
  font: Font;
  buffer: ArrayBuffer;
}

interface FontPickerProps {
  text: string;
  onTextChange: (t: string) => void;
  selected: SelectedFont | null;
  onSelectedChange: (s: SelectedFont | null) => void;
  onFontLoaded: (f: Font | null) => void;
  inIframe?: boolean;
}

/** Inject a single <link rel=stylesheet> to Google Fonts CSS so the
 * category preview fonts render in their own face. Side-effect, idempotent. */
function useCategoryPreviewFonts() {
  useEffect(() => {
    const id = "category-preview-fonts";
    if (document.getElementById(id)) return;
    const families = Array.from(new Set(Object.values(CATEGORY_PREVIEW_FONT)))
      .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}`)
      .join("&");
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    document.head.appendChild(link);
  }, []);
}

export function FontPicker({
  text,
  onTextChange,
  selected,
  onSelectedChange,
  onFontLoaded,
  inIframe = false,
}: FontPickerProps) {
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  const [families, setFamilies] = useState<GoogleMeta[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [subsetFilter, setSubsetFilter] = useState<string>("latin");
  const [uploaded, setUploaded] = useState<UploadedEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fontCacheRef = useRef<Map<string, Font>>(new Map());

  useCategoryPreviewFonts();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/google-fonts/list");
        const json = await res.json();
        setGoogleEnabled(!!json.enabled);
        if (json.enabled && Array.isArray(json.families)) {
          setFamilies(json.families);
        }
      } catch {
        setGoogleEnabled(false);
      }
    })();
  }, []);

  // Categories actually present in the loaded list.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const f of families) set.add(f.category);
    return Array.from(set);
  }, [families]);

  // Subsets actually present, sorted: known/common first, rest alphabetical.
  const subsets = useMemo(() => {
    const set = new Set<string>();
    for (const f of families) for (const s of f.subsets) set.add(s);
    const known = COMMON_SUBSETS.filter((s) => set.has(s));
    const rest = Array.from(set)
      .filter((s) => !known.includes(s))
      .sort();
    return [...known, ...rest];
  }, [families]);

  // Filter by category + subset only (NOT search) — used for the available count.
  const filteredByFacets = useMemo(() => {
    return families
      .filter((f) =>
        categoryFilter === "all" ? true : f.category === categoryFilter,
      )
      .filter((f) => f.subsets.includes(subsetFilter));
  }, [families, categoryFilter, subsetFilter]);

  // Final filtered list including search query (used for the dropdown).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return filteredByFacets
      .filter((f) => (q ? f.family.toLowerCase().includes(q) : true))
      .slice(0, 100);
  }, [filteredByFacets, search]);

  const selectedGoogleMeta: GoogleMeta | null = useMemo(() => {
    if (selected?.kind !== "google") return null;
    return families.find((f) => f.family === selected.family) ?? null;
  }, [families, selected]);

  const availableWeights = useMemo(() => {
    if (!selectedGoogleMeta) return new Set<number>();
    const s = new Set<number>();
    for (const v of selectedGoogleMeta.variants) s.add(parseVariant(v).weight);
    return s;
  }, [selectedGoogleMeta]);

  const availableItalicForWeight = useCallback(
    (w: number): boolean => {
      if (!selectedGoogleMeta) return false;
      return selectedGoogleMeta.variants.some((v) => {
        const p = parseVariant(v);
        return p.weight === w && p.italic;
      });
    },
    [selectedGoogleMeta],
  );

  const currentParsed = useMemo(() => {
    if (selected?.kind !== "google") return null;
    return parseVariant(selected.variant);
  }, [selected]);

  // Load FontFace into the document so the preview renders natively.
  useEffect(() => {
    if (selected?.kind !== "google") return;
    const meta = families.find((f) => f.family === selected.family);
    if (!meta) return;
    const url = `/api/google-fonts/file?family=${encodeURIComponent(
      selected.family,
    )}&variant=${encodeURIComponent(selected.variant)}`;
    const parsed = parseVariant(selected.variant);
    const fontFace = new FontFace(selected.family, `url(${url})`, {
      weight: String(parsed.weight),
      style: parsed.italic ? "italic" : "normal",
    });
    let cancelled = false;
    fontFace
      .load()
      .then((ff) => {
        if (cancelled) return;
        document.fonts.add(ff);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      try {
        document.fonts.delete(fontFace);
      } catch {
        /* ignore */
      }
    };
  }, [families, selected]);

  // Load opentype.js Font object whenever selection changes — that's what
  // textToCurves needs to convert to sketch geometry.
  useEffect(() => {
    if (!selected) {
      onFontLoaded(null);
      return;
    }
    const cacheKey =
      selected.kind === "google"
        ? `google:${selected.family}::${selected.variant}`
        : selected.key;
    const cached = fontCacheRef.current.get(cacheKey);
    if (cached) {
      onFontLoaded(cached);
      return;
    }
    let cancelled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        let font: Font;
        if (selected.kind === "google") {
          const res = await fetch(
            `/api/google-fonts/file?family=${encodeURIComponent(selected.family)}&variant=${encodeURIComponent(selected.variant)}`,
          );
          if (!res.ok) throw new Error(`Google font fetch ${res.status}`);
          const buffer = await res.arrayBuffer();
          font = await loadFontFromBuffer(buffer);
        } else {
          const entry = uploaded.find((u) => u.key === selected.key);
          if (!entry) throw new Error("Uploaded font no longer available");
          font = entry.font;
        }
        if (cancelled) return;
        fontCacheRef.current.set(cacheKey, font);
        onFontLoaded(font);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          onFontLoaded(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, uploaded, onFontLoaded]);

  const onUpload = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const buffer = await file.arrayBuffer();
        const font = await loadFontFromBuffer(buffer);
        const family = font.names.fontFamily?.en ?? file.name;
        const key = `uploaded:${file.name}:${file.size}`;
        setUploaded((prev) =>
          prev.some((p) => p.key === key)
            ? prev
            : [...prev, { key, family, font, buffer }],
        );
        onSelectedChange({ kind: "uploaded", key, family });
      } catch (e) {
        setError(`Upload failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [onSelectedChange],
  );

  const previewStyle = useMemo(() => {
    if (selected?.kind === "google" && currentParsed) {
      return {
        fontFamily: `"${selected.family}", sans-serif`,
        fontWeight: currentParsed.weight,
        fontStyle: currentParsed.italic ? ("italic" as const) : ("normal" as const),
      };
    }
    if (selected?.kind === "uploaded") {
      return { fontFamily: `"${selected.family}", sans-serif` };
    }
    return undefined;
  }, [selected, currentParsed]);

  const pickGoogle = useCallback(
    (family: string) => {
      const meta = families.find((f) => f.family === family);
      if (!meta) return;
      const v = meta.variants.includes("regular")
        ? "regular"
        : meta.variants[0];
      onSelectedChange({ kind: "google", family, variant: v });
      setSearch("");
    },
    [families, onSelectedChange],
  );

  const isUploaded = selected?.kind === "uploaded";

  return (
    <div className="space-y-6">
      {/* === Google Fonts section === */}
      <section className="space-y-3">
        <header>
          <h1 className="text-base font-semibold">Google Fonts</h1>
          <p className="text-xs text-gray-500">
            {googleEnabled === false
              ? "Disabled — set GOOGLE_FONTS_API_KEY."
              : `Browse ${families.length} fonts, filter by category and subset.`}
          </p>
        </header>

        {googleEnabled === false && (
          <div className="rounded bg-amber-50 p-2 text-xs text-amber-900">
            Google Fonts unavailable (set <code>GOOGLE_FONTS_API_KEY</code>).
          </div>
        )}

        <label className="block">
          <span className="text-xs font-medium text-gray-700">Search font</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              googleEnabled
                ? `Search ${filteredByFacets.length} fonts...`
                : "Google Fonts disabled"
            }
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            disabled={!googleEnabled}
          />
        </label>

        {googleEnabled && categories.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-700">Category</span>
            <div className="mt-1 flex flex-wrap gap-1">
              <FilterBtn
                active={categoryFilter === "all"}
                onClick={() => setCategoryFilter("all")}
              >
                All
              </FilterBtn>
              {categories.map((c) => (
                <FilterBtn
                  key={c}
                  active={categoryFilter === c}
                  onClick={() => setCategoryFilter(c)}
                  fontFamily={
                    CATEGORY_PREVIEW_FONT[c]
                      ? `"${CATEGORY_PREVIEW_FONT[c]}", ${c === "monospace" ? "monospace" : c === "serif" ? "serif" : "sans-serif"}`
                      : undefined
                  }
                >
                  {CATEGORY_LABELS[c] ?? c}
                </FilterBtn>
              ))}
            </div>
          </div>
        )}

        {googleEnabled && subsets.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-700">Subset</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {subsets.slice(0, 10).map((s) => (
                <FilterBtn
                  key={s}
                  active={subsetFilter === s}
                  onClick={() => setSubsetFilter(s)}
                >
                  {s}
                </FilterBtn>
              ))}
            </div>
          </div>
        )}

        {googleEnabled && (
          <div className="max-h-48 overflow-auto rounded border border-gray-200">
            {filtered.length === 0 ? (
              <div className="p-2 text-xs text-gray-500">No fonts match</div>
            ) : (
              <ul>
                {filtered.map((f) => {
                  const isSelected =
                    selected?.kind === "google" && selected.family === f.family;
                  return (
                    <li key={f.family}>
                      <button
                        type="button"
                        onClick={() => pickGoogle(f.family)}
                        className={`w-full px-2 py-1.5 text-left text-sm hover:bg-blue-50 ${
                          isSelected ? "bg-blue-100 font-medium" : ""
                        }`}
                      >
                        {f.family}{" "}
                        <span className="text-xs text-gray-400">
                          ({CATEGORY_LABELS[f.category] ?? f.category})
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {selected?.kind === "google" && currentParsed && (
          <>
            <div>
              <span className="text-xs font-medium text-gray-700">Style</span>
              <div className="mt-1 flex flex-wrap gap-1">
                <FilterBtn
                  active={!currentParsed.italic}
                  onClick={() =>
                    onSelectedChange({
                      ...selected,
                      variant: buildVariant(currentParsed.weight, false),
                    })
                  }
                >
                  Regular
                </FilterBtn>
                <FilterBtn
                  active={currentParsed.italic}
                  disabled={!availableItalicForWeight(currentParsed.weight)}
                  onClick={() =>
                    onSelectedChange({
                      ...selected,
                      variant: buildVariant(currentParsed.weight, true),
                    })
                  }
                >
                  Italic
                </FilterBtn>
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-700">Weight</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {WEIGHTS.map((w) => (
                  <FilterBtn
                    key={w}
                    active={currentParsed.weight === w}
                    disabled={!availableWeights.has(w)}
                    onClick={() =>
                      onSelectedChange({
                        ...selected,
                        variant: buildVariant(w, currentParsed.italic),
                      })
                    }
                  >
                    {w}
                  </FilterBtn>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {/* === Upload custom font section === */}
      <section className="space-y-3">
        <header>
          <h1 className="text-base font-semibold">Upload custom font</h1>
          <p className="text-xs text-gray-500">
            Use a .ttf/.otf file from your computer.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50">
            Choose file
            <input
              type="file"
              accept=".ttf,.otf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
          </label>
          {uploaded.map((u) => (
            <FilterBtn
              key={u.key}
              active={selected?.kind === "uploaded" && selected.key === u.key}
              onClick={() =>
                onSelectedChange({
                  kind: "uploaded",
                  key: u.key,
                  family: u.family,
                })
              }
            >
              {u.family}
            </FilterBtn>
          ))}
        </div>
        {inIframe && (
          <p className="text-xs text-gray-500">
            System fonts can&apos;t be read inside Onshape (browser blocks).
          </p>
        )}
      </section>

      {/* === Text + preview === */}
      <section>
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Text</span>
          <input
            type="text"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="The quick brown fox"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        {isUploaded ? (
          <div className="mt-1 min-h-12 rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-xs italic text-gray-500">
            Preview not available for local fonts.
          </div>
        ) : (
          <div
            className="mt-1 min-h-12 rounded border border-gray-200 bg-white p-3 text-2xl leading-tight"
            style={previewStyle}
          >
            {text || "The quick brown fox"}
          </div>
        )}
        {loading && <p className="mt-1 text-xs text-gray-500">Loading font...</p>}
      </section>

      {error && (
        <div className="rounded bg-red-50 p-2 text-xs text-red-800">{error}</div>
      )}
    </div>
  );
}

function FilterBtn({
  active,
  disabled,
  onClick,
  children,
  fontFamily,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  fontFamily?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={fontFamily ? { fontFamily } : undefined}
      className={`rounded border px-2 py-1 text-xs transition-colors ${
        active
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {children}
    </button>
  );
}
