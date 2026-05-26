"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { Font } from "opentype.js";
import { CurveData, TextAlign, textToCurves } from "@/lib/textToCurves";
import { FontPicker, SelectedFont } from "@/components/FontPicker";
import { SketchViewer } from "@/components/SketchViewer";

// Lazy-load the paper.js-powered merge toggle (same reason as /preview).
const MergeToggle = dynamic(() => import("../preview/MergeToggle"), {
  ssr: false,
});

interface OnshapeContext {
  documentId: string;
  workspaceId: string | null;
  workspaceOrVersion: "w" | "v" | "m" | null;
  workspaceOrVersionId: string | null;
  elementId: string;
  userId: string | null;
}

function readOnshapeContext(params: URLSearchParams): OnshapeContext | null {
  const documentId = params.get("documentId");
  const elementId = params.get("elementId");
  if (!documentId || !elementId) return null;
  const workspaceOrVersion = params.get("workspaceOrVersion") as
    | "w"
    | "v"
    | "m"
    | null;
  const workspaceOrVersionId = params.get("workspaceOrVersionId");
  return {
    documentId,
    elementId,
    workspaceOrVersion,
    workspaceOrVersionId,
    workspaceId: workspaceOrVersion === "w" ? workspaceOrVersionId : null,
    userId: params.get("userId"),
  };
}

function PanelInner() {
  const searchParams = useSearchParams();
  const onshape = useMemo(
    () => readOnshapeContext(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [authChecking, setAuthChecking] = useState(false);
  const [text, setText] = useState("The quick brown fox");
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [lineHeight, setLineHeight] = useState(1.2);
  const [align, setAlign] = useState<TextAlign>("left");
  const [selected, setSelected] = useState<SelectedFont | null>(null);
  const [font, setFont] = useState<Font | null>(null);
  const [curves, setCurves] = useState<CurveData | null>(null);
  const [mergedCurves, setMergedCurves] = useState<CurveData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayCurves = mergedCurves ?? curves;
  const [busy, setBusy] = useState(false);
  const [insertResult, setInsertResult] = useState<string | null>(null);
  const [inIframe, setInIframe] = useState(false);

  const refreshAuth = useCallback(async () => {
    setAuthChecking(true);
    try {
      const url = new URL("/api/oauth/status", window.location.origin);
      const uid = onshape?.userId;
      if (uid) url.searchParams.set("userId", uid);
      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = await res.json();
      setAuthenticated(!!json.authenticated);
    } catch {
      setAuthenticated(false);
    } finally {
      setAuthChecking(false);
    }
  }, [onshape?.userId]);

  useEffect(() => {
    setInIframe(typeof window !== "undefined" && window.parent !== window);
    refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (
        e.data &&
        typeof e.data === "object" &&
        e.data.type === "onshape-oauth-success"
      ) {
        refreshAuth();
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [refreshAuth]);

  const onLogin = useCallback(() => {
    const w = 600,
      h = 700;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    window.open(
      "/api/oauth/start",
      "onshape-oauth",
      `width=${w},height=${h},left=${left},top=${top}`,
    );
  }, []);

  // Convert text to sketch curves whenever font or text changes.
  useEffect(() => {
    if (!font || !text) {
      setCurves(null);
      return;
    }
    try {
      setError(null);
      setCurves(
        textToCurves(text, font, { letterSpacing, lineHeight, align }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [font, text, letterSpacing, lineHeight, align]);

  const payloadBytes = displayCurves ? new Blob([JSON.stringify(displayCurves)]).size : 0;
  const payloadKB = (payloadBytes / 1024).toFixed(1);
  const payloadWarn = payloadBytes > 80 * 1024;

  const onInsert = useCallback(async () => {
    if (!displayCurves || !onshape) return;
    if (!onshape.workspaceId) {
      setError("Open the document in an editable workspace, not a version.");
      return;
    }
    setBusy(true);
    setError(null);
    setInsertResult(null);
    try {
      const res = await fetch("/api/feature/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: onshape.documentId,
          workspaceId: onshape.workspaceId,
          elementId: onshape.elementId,
          curveJson: JSON.stringify(displayCurves),
          name: `Text "${text.slice(0, 40)}"`,
          onshapeUserId: onshape.userId ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error
            ? `${json.error}${json.body ? `: ${JSON.stringify(json.body)}` : ""}`
            : `HTTP ${res.status}`,
        );
      }
      setInsertResult("Inserted. Pick a sketch plane in Onshape.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [displayCurves, onshape, text]);

  if (!onshape) {
    return (
      <main className="bg-white p-4 text-sm text-gray-900">
        <p className="mb-2 font-medium">
          This page is intended to open inside Onshape as an Element Panel.
        </p>
        <p className="text-gray-600">
          For a standalone preview use{" "}
          <a className="underline" href="/preview">
            /preview
          </a>
          .
        </p>
      </main>
    );
  }

  if (onshape.workspaceOrVersion !== "w") {
    return (
      <main className="bg-white p-4 text-sm text-gray-900">
        <p className="font-medium">
          Document is opened as a version/microversion, not a workspace.
        </p>
        <p className="mt-2 text-gray-600">
          Switch to an editable workspace to insert features.
        </p>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col gap-4 overflow-auto bg-white p-3 text-sm text-gray-900">
      {authenticated === false && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <p className="mb-2 font-medium">Onshape connection</p>
          <button
            type="button"
            onClick={onLogin}
            disabled={authChecking}
            className="rounded bg-[#1189e3] px-3 py-1.5 text-white hover:bg-[#0d7ac9] disabled:opacity-50"
          >
            Sign in via OAuth
          </button>
        </div>
      )}

      {authenticated && (
        <>
          <PanelLogo />

          <FontPicker
            text={text}
            onTextChange={setText}
            letterSpacing={letterSpacing}
            onLetterSpacingChange={setLetterSpacing}
            lineHeight={lineHeight}
            onLineHeightChange={setLineHeight}
            align={align}
            onAlignChange={setAlign}
            selected={selected}
            onSelectedChange={setSelected}
            onFontLoaded={setFont}
            inIframe={inIframe}
          />

          <div>
            <h2 className="mb-1 text-xs font-medium text-gray-700">
              Sketch preview
              <span className="ml-2 text-[11px] font-normal text-gray-400">
                drag · scroll
              </span>
            </h2>
            <div className="aspect-[3/1] w-full">
              <SketchViewer curves={displayCurves} />
            </div>
          </div>

          <MergeToggle curves={curves} onResult={setMergedCurves} />

          {displayCurves && (
            <p
              className={`text-xs ${payloadWarn ? "text-amber-700" : "text-gray-500"}`}
            >
              {displayCurves.glyphs.length} glyphs ·{" "}
              {displayCurves.glyphs.reduce(
                (s, g) =>
                  s + g.contours.reduce((cs, c) => cs + c.segments.length, 0),
                0,
              )}{" "}
              segments · {payloadKB} KB
              {payloadWarn && " — large payload, consider shorter text"}
            </p>
          )}

          <button
            type="button"
            onClick={onInsert}
            disabled={busy || !displayCurves}
            className="rounded bg-[#1189e3] px-4 py-2 text-white hover:bg-[#0d7ac9] disabled:opacity-50"
          >
            {busy ? "Inserting..." : "Insert into Part Studio"}
          </button>

          {insertResult && (
            <div className="rounded bg-green-50 p-2 text-xs text-green-800">
              {insertResult}
            </div>
          )}
        </>
      )}

      {error && (
        <div className="rounded bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}
    </main>
  );
}

export default function PanelPage() {
  return (
    <Suspense fallback={<main className="p-4 text-sm">Loading…</main>}>
      <PanelInner />
    </Suspense>
  );
}

/** Brand mark + wordmark in the iframe panel. target="_blank" because
 *  the panel itself lives in an Onshape iframe — we don't want to
 *  navigate it away. */
function PanelLogo() {
  return (
    <a
      href="/"
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 self-start"
      aria-label="Open Google Fonts for Onshape homepage in a new tab"
    >
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
      <span className="text-sm font-semibold tracking-tight text-gray-900">
        Google Fonts{" "}
        <span className="text-gray-500">for Onshape</span>
      </span>
    </a>
  );
}
