"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Font } from "opentype.js";
import { loadFontFromBuffer, type TextAlign } from "@/lib/textToCurves";

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
  letterSpacing: number;
  onLetterSpacingChange: (v: number) => void;
  lineHeight: number;
  onLineHeightChange: (v: number) => void;
  align: TextAlign;
  onAlignChange: (v: TextAlign) => void;
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
  letterSpacing,
  onLetterSpacingChange,
  lineHeight,
  onLineHeightChange,
  align,
  onAlignChange,
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

  // Preload ALL variants of the selected Google family via the standard
  // Google Fonts CSS API so weight/style preview buttons can render in
  // their own actual style.
  useEffect(() => {
    if (selected?.kind !== "google") return;
    const meta = families.find((f) => f.family === selected.family);
    if (!meta) return;
    // Build ital,wght@... axis spec from the variants the font publishes.
    const axes = meta.variants
      .map((v) => parseVariant(v))
      .map((p) => `${p.italic ? 1 : 0},${p.weight}`)
      .sort()
      .join(";");
    const familyEnc = encodeURIComponent(meta.family).replace(/%20/g, "+");
    const href = `https://fonts.googleapis.com/css2?family=${familyEnc}:ital,wght@${axes}&display=swap`;
    const id = `gf-family-${meta.family.replace(/[^\w]/g, "-")}`;
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
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
                        className={`w-full px-2 py-1.5 text-left text-sm hover:bg-[#1189e3]/10 ${
                          isSelected ? "bg-[#1189e3]/20 font-medium" : ""
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
                  fontFamily={`"${selected.family}", sans-serif`}
                  fontWeight={currentParsed.weight}
                  fontStyle="normal"
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
                  fontFamily={`"${selected.family}", sans-serif`}
                  fontWeight={currentParsed.weight}
                  fontStyle="italic"
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
                    fontFamily={`"${selected.family}", sans-serif`}
                    fontWeight={w}
                    fontStyle={currentParsed.italic ? "italic" : "normal"}
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

        <UploadDropZone onFile={onUpload} />

        {uploaded.length > 0 && (
          <div className="flex flex-wrap gap-2">
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
        )}
      </section>

      {/* === Text + preview === */}
      <section>
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Text</span>
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="The quick brown fox"
            rows={Math.min(6, Math.max(1, text.split("\n").length))}
            className="mt-1 w-full resize-y rounded border border-gray-300 px-2 py-1.5 text-sm leading-snug"
          />
        </label>

        <div className="mt-2">
          <span className="text-xs font-medium text-gray-700">Align</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {(["left", "center", "right", "justify"] as TextAlign[]).map((a) => (
              <FilterBtn
                key={a}
                active={align === a}
                onClick={() => onAlignChange(a)}
              >
                <AlignIcon kind={a} />
              </FilterBtn>
            ))}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-700">
              Letter spacing (em)
            </span>
            <input
              type="number"
              step={0.01}
              value={letterSpacing}
              onChange={(e) =>
                onLetterSpacingChange(Number(e.target.value) || 0)
              }
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">
              Line height (em)
            </span>
            <input
              type="number"
              step={0.1}
              min={0.5}
              value={lineHeight}
              onChange={(e) =>
                onLineHeightChange(Number(e.target.value) || 1.2)
              }
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        {isUploaded ? (
          <div className="mt-1 min-h-12 rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-xs italic text-gray-500">
            Preview not available for local fonts.
          </div>
        ) : (
          <div
            className="mt-1 min-h-12 whitespace-pre-wrap rounded border border-gray-200 bg-white p-3 text-2xl"
            style={{
              ...previewStyle,
              letterSpacing: `${letterSpacing}em`,
              lineHeight: lineHeight,
              textAlign: align,
            }}
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

function UploadDropZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      const ok = /\.(ttf|otf)$/i.test(file.name);
      if (!ok) return;
      onFile(file);
    },
    [onFile],
  );

  return (
    <label
      htmlFor="font-dropzone-input"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        acceptFile(f);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-6 text-center text-xs transition-colors ${
        dragging
          ? "border-[#1189e3] bg-[#1189e3]/5 text-[#1189e3]"
          : "border-gray-300 bg-gray-50 text-gray-500 hover:border-gray-400 hover:bg-gray-100"
      }`}
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 4v12" />
        <path d="M8 8l4-4 4 4" />
        <path d="M4 20h16" />
      </svg>
      <span className="font-medium">
        Drop a .ttf or .otf here
      </span>
      <span className="text-[11px] opacity-70">or click to browse</span>
      <input
        id="font-dropzone-input"
        ref={inputRef}
        type="file"
        accept=".ttf,.otf"
        className="hidden"
        onChange={(e) => {
          acceptFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function AlignIcon({ kind }: { kind: TextAlign }) {
  // Four horizontal lines representing each alignment. Lengths chosen to
  // visually communicate left/right/center/justify.
  const lines: Record<TextAlign, [number, number, number][]> = {
    // [y, x1, x2]
    left: [
      [3, 1, 13],
      [6, 1, 9],
      [9, 1, 13],
      [12, 1, 7],
    ],
    right: [
      [3, 1, 13],
      [6, 5, 13],
      [9, 1, 13],
      [12, 7, 13],
    ],
    center: [
      [3, 1, 13],
      [6, 3, 11],
      [9, 1, 13],
      [12, 4, 10],
    ],
    justify: [
      [3, 1, 13],
      [6, 1, 13],
      [9, 1, 13],
      [12, 1, 13],
    ],
  };
  return (
    <svg viewBox="0 0 14 15" width="14" height="15" aria-label={kind}>
      {lines[kind].map(([y, x1, x2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y}
          x2={x2}
          y2={y}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function FilterBtn({
  active,
  disabled,
  onClick,
  children,
  fontFamily,
  fontWeight,
  fontStyle,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
}) {
  const style: React.CSSProperties = {};
  if (fontFamily) style.fontFamily = fontFamily;
  if (fontWeight) style.fontWeight = fontWeight;
  if (fontStyle) style.fontStyle = fontStyle;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={Object.keys(style).length > 0 ? style : undefined}
      className={`rounded border px-2 py-1 text-xs transition-colors ${
        active
          ? "border-[#1189e3] bg-[#1189e3] text-white"
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {children}
    </button>
  );
}
