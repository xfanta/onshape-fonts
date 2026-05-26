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
import { CurveData, TextAlign, textToCurves } from "@/lib/textToCurves";
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
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [lineHeight, setLineHeight] = useState(1.2);
  const [align, setAlign] = useState<TextAlign>("left");
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
      setCurves(
        textToCurves(text, font, { letterSpacing, lineHeight, align }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [font, text, letterSpacing, lineHeight, align]);

  const payloadBytes = curves ? new Blob([JSON.stringify(curves)]).size : 0;
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
  }, [curves, onshape, text]);

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

          {curves && (
            <p
              className={`text-xs ${payloadWarn ? "text-amber-700" : "text-gray-500"}`}
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

          <button
            type="button"
            onClick={onInsert}
            disabled={busy || !curves}
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
