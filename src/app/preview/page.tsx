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
  | { kind: "uploaded"; family: string; key: string };

interface LoadedFont {
  source: FontSource;
  font: Font;
}

export default function PreviewPage() {
  const [text, setText] = useState("Hello");
  const [browserFonts, setBrowserFonts] = useState<FontData[]>([]);
  const [uploadedFonts, setUploadedFonts] = useState<
    { key: string; family: string; buffer: ArrayBuffer }[]
  >([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [loaded, setLoaded] = useState<LoadedFont | null>(null);
  const [curves, setCurves] = useState<CurveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontApiSupported, setFontApiSupported] = useState<boolean | null>(null);
  const fontCacheRef = useRef<Map<string, Font>>(new Map());

  useEffect(() => {
    setFontApiSupported(typeof navigator !== "undefined" && !!navigator.fonts);
  }, []);

  const enumerateBrowserFonts = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.fonts) {
        throw new Error("Local Font Access API není v tomto prohlížeči dostupné.");
      }
      const fonts = await navigator.fonts.query();
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
                    g.contours.reduce((cs, c) => cs + c.segs.length, 0),
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
      </section>
    </main>
  );
}
