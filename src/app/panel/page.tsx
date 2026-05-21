"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import type { Font } from "opentype.js";
import {
  CurveData,
  curvesBounds,
  curvesToSvgPath,
  loadFontFromBuffer,
  textToCurves,
} from "@/lib/textToCurves";

interface OnshapeContext {
  documentId: string;
  workspaceId: string | null;
  workspaceOrVersion: "w" | "v" | "m" | null;
  workspaceOrVersionId: string | null;
  elementId: string;
  userId: string | null;
  server: string | null;
  companyId: string | null;
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
    workspaceId:
      workspaceOrVersion === "w" ? workspaceOrVersionId : null,
    userId: params.get("userId"),
    server: params.get("server"),
    companyId: params.get("companyId"),
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
  const [text, setText] = useState("Hello");
  const [scaleMm, setScaleMm] = useState(10);
  const [browserFonts, setBrowserFonts] = useState<FontData[]>([]);
  const [uploadedFonts, setUploadedFonts] = useState<
    { key: string; family: string }[]
  >([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [font, setFont] = useState<Font | null>(null);
  const [curves, setCurves] = useState<CurveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [insertResult, setInsertResult] = useState<string | null>(null);
  const [fontApiSupported, setFontApiSupported] = useState<boolean | null>(
    null,
  );
  const fontCacheRef = useRef<Map<string, Font>>(new Map());

  const refreshAuth = useCallback(async () => {
    setAuthChecking(true);
    try {
      const res = await fetch("/api/oauth/status", { cache: "no-store" });
      const json = await res.json();
      setAuthenticated(!!json.authenticated);
    } catch {
      setAuthenticated(false);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    setFontApiSupported(typeof navigator !== "undefined" && !!navigator.fonts);
    refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data && typeof e.data === "object" && e.data.type === "onshape-oauth-success") {
        refreshAuth();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [refreshAuth]);

  const onLogin = useCallback(() => {
    const w = 600, h = 700;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    window.open(
      "/api/oauth/start",
      "onshape-oauth",
      `width=${w},height=${h},left=${left},top=${top}`,
    );
  }, []);

  const enumerateBrowserFonts = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.fonts) {
        throw new Error("Local Font Access API není dostupné.");
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
      const f = await loadFontFromBuffer(buffer);
      const family = f.names.fontFamily?.en ?? file.name;
      const key = `uploaded:${file.name}:${file.size}`;
      fontCacheRef.current.set(key, f);
      setUploadedFonts((prev) => {
        if (prev.some((p) => p.key === key)) return prev;
        return [...prev, { key, family }];
      });
      setSelectedKey(key);
    } catch (e) {
      setError(`Selhalo načtení fontu: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  useEffect(() => {
    if (!selectedKey) {
      setFont(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const cached = fontCacheRef.current.get(selectedKey);
        if (cached) {
          if (!cancelled) setFont(cached);
          return;
        }
        if (selectedKey.startsWith("browser:")) {
          const ps = selectedKey.slice("browser:".length);
          const meta = browserFonts.find((b) => b.postscriptName === ps);
          if (!meta) throw new Error("Font není v seznamu.");
          const blob = await meta.blob();
          const buffer = await blob.arrayBuffer();
          const f = await loadFontFromBuffer(buffer);
          fontCacheRef.current.set(selectedKey, f);
          if (!cancelled) setFont(f);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedKey, browserFonts]);

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
      setError("Onshape kontext není workspace — vlož v read-write workspace.");
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
          name: `Text "${text.slice(0, 40)}"`,
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
      setInsertResult("Vloženo. Otevři dialog feature v Onshape a vyber rovinu.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [curves, onshape, scaleMm, text]);

  if (!onshape) {
    return (
      <main className="p-4 text-sm">
        <p className="mb-2 font-medium">Tato stránka se otevírá uvnitř Onshape jako Element Panel.</p>
        <p className="text-gray-600">
          Pokud testuješ standalone, použij <a className="underline" href="/preview">/preview</a>.
        </p>
      </main>
    );
  }

  if (onshape.workspaceOrVersion !== "w") {
    return (
      <main className="p-4 text-sm">
        <p className="font-medium">Tento dokument je otevřený jako version/microversion, ne workspace.</p>
        <p className="mt-2 text-gray-600">
          Pro vložení feature otevři dokument v editovatelném workspace.
        </p>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col gap-3 bg-white p-3 text-sm text-gray-900">
      {authenticated === false && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <p className="mb-2 font-medium">Připojení k Onshape</p>
          <button
            type="button"
            onClick={onLogin}
            disabled={authChecking}
            className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Přihlásit přes OAuth
          </button>
        </div>
      )}

      {authenticated && (
        <>
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Text</span>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
              placeholder="Napiš text..."
            />
          </label>

          <div>
            <span className="text-xs font-medium text-gray-700">Font</span>
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
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
            <div className="mt-1 flex flex-wrap gap-2">
              {fontApiSupported && (
                <button
                  type="button"
                  onClick={enumerateBrowserFonts}
                  className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
                >
                  Načíst systémové fonty
                </button>
              )}
              <label className="cursor-pointer rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">
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
          </div>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">Em-height (mm)</span>
            <input
              type="number"
              min={0.1}
              step={0.5}
              value={scaleMm}
              onChange={(e) => setScaleMm(Number(e.target.value) || 0)}
              className="mt-1 w-32 rounded border border-gray-300 px-2 py-1.5"
            />
          </label>

          <div className="aspect-square w-full max-w-xs rounded border border-gray-200 bg-white p-2">
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
                  />
                </g>
              </svg>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-400">
                {font ? "Napiš text..." : "Vyber font."}
              </div>
            )}
          </div>

          {curves && (
            <div
              className={`text-xs ${
                payloadWarn ? "text-amber-700" : "text-gray-500"
              }`}
            >
              {curves.glyphs.length} glyfů ·{" "}
              {curves.glyphs.reduce(
                (s, g) =>
                  s + g.contours.reduce((cs, c) => cs + c.segs.length, 0),
                0,
              )}{" "}
              segmentů · {payloadKB} KB
              {payloadWarn && " (velký payload — zvaž zkrátit text)"}
            </div>
          )}

          <button
            type="button"
            onClick={onInsert}
            disabled={busy || !curves}
            className="mt-auto rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Vkládám..." : "Vložit do Part Studia"}
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
    <Suspense fallback={<main className="p-4 text-sm">Načítám…</main>}>
      <PanelInner />
    </Suspense>
  );
}
