"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Font } from "opentype.js";
import { CurveData, textToCurves } from "@/lib/textToCurves";
import { FontPicker, SelectedFont } from "@/components/FontPicker";
import { SketchViewer } from "@/components/SketchViewer";

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
    <div className="min-h-screen bg-white text-gray-900">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-10">
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
      </main>

      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md p-[5px]"
            style={{
              background: "linear-gradient(135deg, #F48635 0%, #ed3338 100%)",
            }}
            aria-hidden
          >
            <svg viewBox="0 0 640 640" className="h-full w-full" fill="#fff">
              <path d="M200 64C213.3 64 224 74.7 224 88L224 144L360 144C373.3 144 384 154.7 384 168C384 181.3 373.3 192 360 192L343.8 192L327.3 230.4C308.7 273.9 282.1 313.2 249.4 346.4C263.3 355.6 278 363.8 293.4 370.8L354.3 398.7L426.1 238.2C430 229.6 438.5 224 448 224C457.5 224 466 229.6 469.9 238.2L605.9 542.2C611.3 554.3 605.9 568.5 593.8 573.9C581.7 579.3 567.5 573.9 562.1 561.8L532.7 496L363.4 496L334 561.8C328.6 573.9 314.4 579.3 302.3 573.9C290.2 568.5 284.8 554.3 290.2 542.2L334.8 442.5L273.5 414.4C252 404.5 231.6 392.7 212.6 379.2C195.1 392.8 176.3 404.9 156.4 415.3L99.1 445.3C87.4 451.5 72.9 446.9 66.7 435.2C60.5 423.5 65.1 409 76.8 402.8L134 372.8C148 365.5 161.4 357.1 174.1 348C146.6 322.4 123 292.8 104.1 260C97.5 248.5 101.4 233.8 112.9 227.2C124.4 220.6 139.1 224.5 145.7 236C163.1 266.3 185.2 293.5 211.1 316.7C241.6 286.9 266.2 251.2 283.3 211.4L291.6 192L56 192C42.7 192 32 181.3 32 168C32 154.7 42.8 144 56 144L176 144L176 88C176 74.7 186.7 64 200 64zM511.2 448L448 306.8L384.8 448L511.2 448z" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Google Fonts <span className="opacity-60">for Onshape</span>
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-gray-600">
          <Link href="/" className="hover:text-gray-900">
            Home
          </Link>
          <a
            className="hover:text-gray-900"
            href="https://github.com/xfanta/onshape-fonts"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a
            href="https://cad.onshape.com/appstore/apps/Utilities/6a0f2d2039092b5cfc0f712a"
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
            style={{
              background: "linear-gradient(135deg, #F48635 0%, #ed3338 100%)",
            }}
          >
            Add to Onshape
          </a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-200">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-gray-500">
        <span>© 2026 · Free &amp; open source</span>
        <div className="flex gap-5">
          <Link href="/privacy" className="hover:text-gray-900">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-gray-900">
            Terms
          </Link>
          <a
            href="https://github.com/xfanta/onshape-fonts/issues"
            target="_blank"
            rel="noreferrer"
            className="hover:text-gray-900"
          >
            Support
          </a>
        </div>
      </div>
    </footer>
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

