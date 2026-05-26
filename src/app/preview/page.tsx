"use client";

import { useCallback, useEffect, useState } from "react";
import type { Font } from "opentype.js";
import { CurveData, textToCurves } from "@/lib/textToCurves";
import { FontPicker, SelectedFont } from "@/components/FontPicker";
import { SketchViewer } from "@/components/SketchViewer";
import { SiteShell } from "@/components/SiteShell";

export default function PreviewPage() {
  const [text, setText] = useState("The quick brown fox");
  const [selected, setSelected] = useState<SelectedFont | null>(null);
  const [font, setFont] = useState<Font | null>(null);
  const [curves, setCurves] = useState<CurveData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!font || !text) {
      setCurves(null);
      return;
    }
    try {
      setError(null);
      setCurves(textToCurves(text, font));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [font, text]);

  const payloadKB = curves
    ? (new Blob([JSON.stringify(curves)]).size / 1024).toFixed(1)
    : "0";

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

  return (
    <SiteShell>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Try in browser
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Standalone playground for the text → sketch geometry
            pipeline. Pick a font, type, and inspect the curves Onshape
            would receive.
          </p>
        </section>

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          {/* Left: font picker */}
          <FontPickerCard
            text={text}
            setText={setText}
            selected={selected}
            setSelected={setSelected}
            setFont={setFont}
          />

          {/* Right: interactive sketch + export */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-gray-700">
              Sketch preview
              <span className="ml-2 text-xs font-normal text-gray-400">
                drag to pan · scroll to zoom
              </span>
            </h2>
            <div className="aspect-[4/3] w-full">
              <SketchViewer curves={curves} />
            </div>

            {curves && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <span>{payloadKB} KB JSON · v{curves.v} wire format</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyJson}
                    className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50"
                  >
                    Copy JSON
                  </button>
                  <button
                    type="button"
                    onClick={downloadJson}
                    className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50"
                  >
                    Download .json
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

// The FontPicker forwards the loaded opentype.js Font upward. We wrap it
// in a small card so it sits nicely next to the SketchViewer column.
function FontPickerCard({
  text,
  setText,
  selected,
  setSelected,
  setFont,
}: {
  text: string;
  setText: (t: string) => void;
  selected: SelectedFont | null;
  setSelected: (s: SelectedFont | null) => void;
  setFont: (f: Font | null) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <FontPicker
        text={text}
        onTextChange={setText}
        selected={selected}
        onSelectedChange={setSelected}
        onFontLoaded={setFont}
      />
    </div>
  );
}

