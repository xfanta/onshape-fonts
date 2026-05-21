"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Font } from "opentype.js";
import {
  CurveData,
  curvesBounds,
  curvesToSvgPath,
  loadFontFromBuffer,
  textToCurves,
} from "@/lib/textToCurves";

type FontSource =
  | { kind: "browser"; postscriptName: string; family: string; fullName: string }
  | { kind: "uploaded"; family: string; key: string }
  | { kind: "google"; family: string; variant: string };

interface LoadedFont {
  source: FontSource;
  font: Font;
}

interface GoogleFontMeta {
  family: string;
  category: string;
  variants: string[];
}

function DebugDump({ font, text }: { font: Font; text: string }) {
  const [copied, setCopied] = useState(false);
  const dump = useMemo(() => {
    if (!text) return "";
    return Array.from(text)
      .map((ch) => {
        const g = font.charToGlyph(ch);
        const p = g.getPath(0, 0, font.unitsPerEm);
        const cmds = (p.commands as unknown[])
          .map((c) =>
            typeof c === "object" && c !== null ? JSON.stringify(c) : String(c),
          )
          .join("\n  ");
        return `--- "${ch}" (unicode ${ch.charCodeAt(0)}) — glyph ${g.index}, advance ${g.advanceWidth} ---\n  ${cmds}`;
      })
      .join("\n\n");
  }, [font, text]);

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(dump);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-gray-800"
        >
          {copied ? "✓ Copied" : "Copy to clipboard"}
        </button>
        <span className="text-xs text-gray-500">
          {dump.length.toLocaleString()} znaků
        </span>
      </div>
      <pre className="max-h-96 overflow-auto rounded bg-gray-50 p-3 text-xs">
        {dump || "—"}
      </pre>
    </>
  );
}

export default function PreviewPage() {
  const [text, setText] = useState("Hello");
  const [browserFonts, setBrowserFonts] = useState<FontData[]>([]);
  const [uploadedFonts, setUploadedFonts] = useState<
    { key: string; family: string; buffer: ArrayBuffer }[]
  >([]);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  const [googleFamilies, setGoogleFamilies] = useState<GoogleFontMeta[]>([]);
  const [googleQuery, setGoogleQuery] = useState("");
  const [googleVariant, setGoogleVariant] = useState("regular");
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [loaded, setLoaded] = useState<LoadedFont | null>(null);
  const [curves, setCurves] = useState<CurveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontApiSupported, setFontApiSupported] = useState<boolean | null>(null);
  const fontCacheRef = useRef<Map<string, Font>>(new Map());

  useEffect(() => {
    setFontApiSupported(
      typeof window !== "undefined" && typeof window.queryLocalFonts === "function",
    );
    (async () => {
      try {
        const res = await fetch("/api/google-fonts/list");
        const json = await res.json();
        setGoogleEnabled(!!json.enabled);
        if (json.enabled && Array.isArray(json.families)) {
          setGoogleFamilies(json.families);
        }
      } catch {
        setGoogleEnabled(false);
      }
    })();
  }, []);

  const googleFiltered = useMemo(() => {
    if (!googleQuery.trim()) return googleFamilies.slice(0, 50);
    const q = googleQuery.toLowerCase();
    return googleFamilies.filter((f) => f.family.toLowerCase().includes(q)).slice(0, 50);
  }, [googleFamilies, googleQuery]);

  const selectedGoogleFamily = useMemo(() => {
    if (!selectedKey.startsWith("google:")) return null;
    return selectedKey.slice("google:".length).split("::")[0];
  }, [selectedKey]);

  const googleVariants = useMemo(() => {
    if (!selectedGoogleFamily) return [];
    return googleFamilies.find((f) => f.family === selectedGoogleFamily)?.variants ?? [];
  }, [googleFamilies, selectedGoogleFamily]);

  const enumerateBrowserFonts = useCallback(async () => {
    setError(null);
    try {
      if (typeof window.queryLocalFonts !== "function") {
        throw new Error("Local Font Access API není v tomto prohlížeči dostupné.");
      }
      const fonts = await window.queryLocalFonts();
      const seen = new Set<string>();
      const deduped = fonts.filter((f) => {
        if (seen.has(f.postscriptName)) return false;
        seen.add(f.postscriptName);
        return true;
      });
      deduped.sort((a, b) => a.fullName.localeCompare(b.fullName));
      setBrowserFonts(deduped);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const onUpload = useCallback(async (file: File) => {
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const font = await loadFontFromBuffer(buffer);
      const family = font.names.fontFamily?.en ?? file.name;
      const key = `uploaded:${file.name}:${file.size}`;
      fontCacheRef.current.set(key, font);
      setUploadedFonts((prev) => {
        if (prev.some((p) => p.key === key)) return prev;
        return [...prev, { key, family, buffer }];
      });
      setSelectedKey(key);
    } catch (e) {
      setError(`Selhalo načtení fontu: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const fontOptions = useMemo(() => {
    const opts: { key: string; label: string; group: string }[] = [];
    for (const f of uploadedFonts) {
      opts.push({ key: f.key, label: f.family, group: "Uploaded" });
    }
    for (const f of browserFonts) {
      opts.push({
        key: `browser:${f.postscriptName}`,
        label: f.fullName,
        group: "Browser",
      });
    }
    return opts;
  }, [browserFonts, uploadedFonts]);

  useEffect(() => {
    if (!selectedKey) {
      setLoaded(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const cached = fontCacheRef.current.get(selectedKey);
        if (cached) {
          if (!cancelled) {
            const upl = uploadedFonts.find((u) => u.key === selectedKey);
            if (upl) {
              setLoaded({
                source: { kind: "uploaded", family: upl.family, key: upl.key },
                font: cached,
              });
            } else if (selectedKey.startsWith("google:")) {
              const [family, variant] = selectedKey.slice("google:".length).split("::");
              setLoaded({
                source: { kind: "google", family, variant: variant ?? "regular" },
                font: cached,
              });
            } else {
              const ps = selectedKey.slice("browser:".length);
              const meta = browserFonts.find((b) => b.postscriptName === ps);
              setLoaded({
                source: {
                  kind: "browser",
                  postscriptName: ps,
                  family: meta?.family ?? ps,
                  fullName: meta?.fullName ?? ps,
                },
                font: cached,
              });
            }
          }
          return;
        }
        if (selectedKey.startsWith("browser:")) {
          const ps = selectedKey.slice("browser:".length);
          const meta = browserFonts.find((b) => b.postscriptName === ps);
          if (!meta) throw new Error("Font není v seznamu.");
          const blob = await meta.blob();
          const buffer = await blob.arrayBuffer();
          const font = await loadFontFromBuffer(buffer);
          fontCacheRef.current.set(selectedKey, font);
          if (!cancelled) {
            setLoaded({
              source: {
                kind: "browser",
                postscriptName: ps,
                family: meta.family,
                fullName: meta.fullName,
              },
              font,
            });
          }
        } else if (selectedKey.startsWith("google:")) {
          const [family, variant] = selectedKey.slice("google:".length).split("::");
          const res = await fetch(
            `/api/google-fonts/file?family=${encodeURIComponent(family)}&variant=${encodeURIComponent(variant ?? "regular")}`,
          );
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Google font fetch ${res.status}: ${txt}`);
          }
          const buffer = await res.arrayBuffer();
          const font = await loadFontFromBuffer(buffer);
          fontCacheRef.current.set(selectedKey, font);
          if (!cancelled) {
            setLoaded({
              source: {
                kind: "google",
                family,
                variant: variant ?? "regular",
              },
              font,
            });
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedKey, browserFonts, uploadedFonts]);

  useEffect(() => {
    if (!loaded || !text) {
      setCurves(null);
      return;
    }
    try {
      setError(null);
      setCurves(textToCurves(text, loaded.font));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [loaded, text]);

  const svg = useMemo(() => {
    if (!curves) return null;
    const b = curvesBounds(curves);
    const pad = 0.05;
    const w = Math.max(0.01, b.maxX - b.minX) + pad * 2;
    const h = Math.max(0.01, b.maxY - b.minY) + pad * 2;
    return {
      viewBox: `${b.minX - pad} ${-b.maxY - pad} ${w} ${h}`,
      path: curvesToSvgPath(curves),
    };
  }, [curves]);

  const downloadJson = useCallback(() => {
    if (!curves) return;
    const blob = new Blob([JSON.stringify(curves, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `curves-${curves.text.replace(/[^\w]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [curves]);

  const copyJson = useCallback(async () => {
    if (!curves) return;
    await navigator.clipboard.writeText(JSON.stringify(curves));
  }, [curves]);

  const payloadKB = curves
    ? (new Blob([JSON.stringify(curves)]).size / 1024).toFixed(1)
    : "0";

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Text → křivky (preview)</h1>
        <p className="text-sm text-gray-600">
          Fáze A: standalone preview pro ověření opentype.js → cubic Bézier
          pipeline a generování fixture JSONů pro FeatureScript.
        </p>
      </header>

      <section className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium">Text</span>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              placeholder="Napiš text..."
            />
          </label>

          <div>
            <span className="text-sm font-medium">Font</span>
            <div className="mt-1 flex gap-2">
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="flex-1 rounded border border-gray-300 px-3 py-2"
              >
                <option value="">— vyber font —</option>
                {uploadedFonts.length > 0 && (
                  <optgroup label="Uploaded">
                    {uploadedFonts.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.family}
                      </option>
                    ))}
                  </optgroup>
                )}
                {browserFonts.length > 0 && (
                  <optgroup label="Browser">
                    {browserFonts.map((f) => (
                      <option
                        key={f.postscriptName}
                        value={`browser:${f.postscriptName}`}
                      >
                        {f.fullName}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {fontApiSupported && (
                <button
                  type="button"
                  onClick={enumerateBrowserFonts}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                >
                  Načíst systémové fonty
                </button>
              )}
              <label className="cursor-pointer rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
                Nahrát .ttf/.otf
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
            </div>
            {fontApiSupported === false && (
              <p className="mt-2 text-xs text-gray-600">
                Local Font Access API není podporované — použij upload .ttf/.otf.
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Dostupných fontů: {fontOptions.length}
            </p>
          </div>

          {googleEnabled && (
            <div className="rounded border border-gray-200 p-3">
              <span className="text-sm font-medium">Google Fonts</span>
              <input
                type="text"
                list="google-families"
                value={googleQuery}
                onChange={(e) => setGoogleQuery(e.target.value)}
                placeholder={`Hledat (${googleFamilies.length} fontů)...`}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <datalist id="google-families">
                {googleFiltered.map((f) => (
                  <option key={f.family} value={f.family} />
                ))}
              </datalist>
              {googleQuery && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const exact = googleFamilies.find((f) => f.family === googleQuery);
                      if (!exact) {
                        setError(`Google font "${googleQuery}" neexistuje.`);
                        return;
                      }
                      const v = exact.variants.includes("regular")
                        ? "regular"
                        : exact.variants[0] ?? "regular";
                      setGoogleVariant(v);
                      setSelectedKey(`google:${exact.family}::${v}`);
                    }}
                    className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                  >
                    Použít
                  </button>
                  {selectedGoogleFamily && googleVariants.length > 0 && (
                    <select
                      value={googleVariant}
                      onChange={(e) => {
                        const v = e.target.value;
                        setGoogleVariant(v);
                        setSelectedKey(`google:${selectedGoogleFamily}::${v}`);
                      }}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      {googleVariants.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}
          {googleEnabled === false && (
            <p className="text-xs text-gray-500">
              Google Fonts: nakonfiguruj <code>GOOGLE_FONTS_API_KEY</code> v <code>.env.local</code>.
            </p>
          )}

          {error && (
            <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="aspect-square rounded border border-gray-200 bg-white p-4">
            {svg ? (
              <svg
                viewBox={svg.viewBox}
                className="h-full w-full"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g transform="scale(1 -1)">
                  <path
                    d={svg.path}
                    fill="black"
                    fillRule="evenodd"
                    stroke="none"
                  />
                </g>
              </svg>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                {loaded ? "Napiš text…" : "Vyber nebo nahraj font."}
              </div>
            )}
          </div>
          {curves && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span>{curves.glyphs.length} glyfů</span>
              <span>·</span>
              <span>
                {curves.glyphs.reduce(
                  (s, g) =>
                    s +
                    g.contours.reduce((cs, c) => cs + c.segments.length, 0),
                  0,
                )}{" "}
                segmentů
              </span>
              <span>·</span>
              <span>{payloadKB} KB JSON</span>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!curves}
            onClick={copyJson}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            Copy JSON
          </button>
          <button
            type="button"
            disabled={!curves}
            onClick={downloadJson}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Download .json
          </button>
        </div>
        <details>
          <summary className="cursor-pointer text-sm text-gray-700">
            Náhled JSONu
          </summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded bg-gray-50 p-3 text-xs">
            {curves ? JSON.stringify(curves, null, 2) : "—"}
          </pre>
        </details>
        <details>
          <summary className="cursor-pointer text-sm text-gray-700">
            Debug: raw opentype.js path commands per glyph
          </summary>
          {loaded && (
            <div className="mt-2">
              <DebugDump font={loaded.font} text={text} />
            </div>
          )}
        </details>
      </section>
    </main>
  );
}
