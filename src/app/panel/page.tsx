"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import type { Font } from "opentype.js";
import {
  CurveData,
  curvesBounds,
  curvesToSvgPath,
  textToCurves,
} from "@/lib/textToCurves";
import { FontPicker, SelectedFont } from "@/components/FontPicker";

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
  const [scaleMm, setScaleMm] = useState(10);
  const [translateXmm, setTranslateXmm] = useState(0);
  const [translateYmm, setTranslateYmm] = useState(0);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [selected, setSelected] = useState<SelectedFont | null>(null);
  const [font, setFont] = useState<Font | null>(null);
  const [curves, setCurves] = useState<CurveData | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      setCurves(textToCurves(text, font));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [font, text]);

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

  const payloadBytes = curves
    ? new Blob([JSON.stringify(curves)]).size
    : 0;
  const payloadKB = (payloadBytes / 1024).toFixed(1);
  const payloadWarn = payloadBytes > 80 * 1024;

  const onInsert = useCallback(async () => {
    if (!curves || !onshape) return;
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
          curveJson: JSON.stringify(curves),
          scaleExpression: `${scaleMm} mm`,
          translateXExpression: `${translateXmm} mm`,
          translateYExpression: `${translateYmm} mm`,
          rotationExpression: `${rotationDeg} deg`,
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
  }, [curves, onshape, scaleMm, translateXmm, translateYmm, rotationDeg, text]);

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
      <header>
        <h1 className="text-base font-semibold">Google Fonts</h1>
        <p className="text-xs text-gray-500">
          Pick a font, insert text as native sketch geometry.
        </p>
      </header>

      {authenticated === false && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <p className="mb-2 font-medium">Onshape connection</p>
          <button
            type="button"
            onClick={onLogin}
            disabled={authChecking}
            className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Sign in via OAuth
          </button>
        </div>
      )}

      {authenticated && (
        <>
          <FontPicker
            text={text}
            onTextChange={setText}
            selected={selected}
            onSelectedChange={setSelected}
            onFontLoaded={setFont}
            inIframe={inIframe}
          />

          {/* Onshape insert controls */}
          <fieldset className="rounded border border-gray-200 p-3">
            <legend className="px-1 text-xs font-medium text-gray-700">
              Onshape parameters
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-gray-600">Em-height (mm)</span>
                <input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={scaleMm}
                  onChange={(e) => setScaleMm(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-600">Rotation (°)</span>
                <input
                  type="number"
                  step={5}
                  value={rotationDeg}
                  onChange={(e) => setRotationDeg(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-600">Translate X (mm)</span>
                <input
                  type="number"
                  step={1}
                  value={translateXmm}
                  onChange={(e) => setTranslateXmm(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-600">Translate Y (mm)</span>
                <input
                  type="number"
                  step={1}
                  value={translateYmm}
                  onChange={(e) => setTranslateYmm(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
                />
              </label>
            </div>
          </fieldset>

          {/* Sketch preview (actual curve geometry) */}
          {svg && (
            <div>
              <span className="text-xs font-medium text-gray-700">
                Sketch preview
              </span>
              <div className="mt-1 aspect-[3/1] max-h-32 w-full rounded border border-gray-200 bg-white p-2">
                <svg
                  viewBox={svg.viewBox}
                  className="h-full w-full"
                  xmlns="http://www.w3.org/2000/svg"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <g transform="scale(1 -1)">
                    <path d={svg.path} fill="black" fillRule="evenodd" />
                  </g>
                </svg>
              </div>
              {curves && (
                <p
                  className={`mt-1 text-xs ${payloadWarn ? "text-amber-700" : "text-gray-500"}`}
                >
                  {curves.glyphs.length} glyphs ·{" "}
                  {curves.glyphs.reduce(
                    (s, g) =>
                      s + g.contours.reduce((cs, c) => cs + c.segments.length, 0),
                    0,
                  )}{" "}
                  segments · {payloadKB} KB
                  {payloadWarn && " — large payload, consider shorter text"}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onInsert}
            disabled={busy || !curves}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
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
