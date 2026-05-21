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
  const [translateXmm, setTranslateXmm] = useState(0);
  const [translateYmm, setTranslateYmm] = useState(0);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [browserFonts, setBrowserFonts] = useState<FontData[]>([]);
  const [uploadedFonts, setUploadedFonts] = useState<
    { key: string; family: string }[]
  >([]);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  const [googleFamilies, setGoogleFamilies] = useState<
    { family: string; category: string; variants: string[] }[]
  >([]);
  const [googleQuery, setGoogleQuery] = useState("");
  const [googleVariant, setGoogleVariant] = useState("regular");
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [font, setFont] = useState<Font | null>(null);
  const [curves, setCurves] = useState<CurveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [insertResult, setInsertResult] = useState<string | null>(null);
  const [fontApiSupported, setFontApiSupported] = useState<boolean | null>(
    null,
  );
  const [inIframe, setInIframe] = useState(false);
  const fontCacheRef = useRef<Map<string, Font>>(new Map());

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
    const isIframe = typeof window !== "undefined" && window.parent !== window;
    setInIframe(isIframe);
    // queryLocalFonts is blocked by Onshape's iframe Permissions-Policy
    // (no allow="local-fonts" attribute), so hide the button there.
    setFontApiSupported(
      !isIframe &&
        typeof window !== "undefined" &&
        typeof window.queryLocalFonts === "function",
    );
    refreshAuth();
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
  }, [refreshAuth]);

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
      if (typeof window.queryLocalFonts !== "function") {
        throw new Error("Local Font Access API není dostupné.");
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
        } else if (selectedKey.startsWith("google:")) {
          const [family, variant] = selectedKey.slice("google:".length).split("::");
          const res = await fetch(
            `/api/google-fonts/file?family=${encodeURIComponent(family)}&variant=${encodeURIComponent(variant ?? "regular")}`,
          );
          if (!res.ok) throw new Error(`Google font fetch ${res.status}: ${await res.text()}`);
          const buffer = await res.arrayBuffer();
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
      setInsertResult("Vloženo. Otevři dialog feature v Onshape a vyber rovinu.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [curves, onshape, scaleMm, translateXmm, translateYmm, rotationDeg, text]);

  if (!onshape) {
    const rawParams = Array.from(searchParams.entries());
    return <DebugView rawParams={rawParams} />;
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
            {inIframe && (
              <p className="mt-1 text-xs text-gray-500">
                Systémové fonty nejdou číst uvnitř Onshape (browser blokuje).
                Použij Upload nebo Google Fonts.
              </p>
            )}
          </div>

          {googleEnabled && (
            <div className="rounded border border-gray-200 p-2">
              <span className="text-xs font-medium text-gray-700">Google Fonts</span>
              <input
                type="text"
                list="google-families-panel"
                value={googleQuery}
                onChange={(e) => setGoogleQuery(e.target.value)}
                placeholder={`Hledat (${googleFamilies.length})...`}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
              />
              <datalist id="google-families-panel">
                {googleFiltered.map((f) => (
                  <option key={f.family} value={f.family} />
                ))}
              </datalist>
              {googleQuery && (
                <div className="mt-1 flex gap-2">
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
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
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
                      className="rounded border border-gray-300 px-1 py-1 text-xs"
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

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Em-height (mm)</span>
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
              <span className="text-xs font-medium text-gray-700">Rotation (°)</span>
              <input
                type="number"
                step={5}
                value={rotationDeg}
                onChange={(e) => setRotationDeg(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Translate X (mm)</span>
              <input
                type="number"
                step={1}
                value={translateXmm}
                onChange={(e) => setTranslateXmm(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Translate Y (mm)</span>
              <input
                type="number"
                step={1}
                value={translateYmm}
                onChange={(e) => setTranslateYmm(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
              />
            </label>
          </div>

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

function DebugView({ rawParams }: { rawParams: [string, string][] }) {
  const [messages, setMessages] = useState<
    { ts: number; origin: string; data: unknown }[]
  >([]);
  const [probeStatus, setProbeStatus] = useState<string>("");

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      setMessages((prev) => [
        ...prev,
        { ts: Date.now(), origin: e.origin, data: e.data },
      ]);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const probe = useCallback(() => {
    const tries = [
      { documentMessage: true, messageName: "iframeReady" },
      { documentMessage: true, messageName: "subscribeMessage", messageType: "documentMessage" },
      { documentMessage: true, messageName: "subscribeMessage", messageType: "selectionMessage" },
      { documentMessage: true, messageName: "getDocumentInfo" },
      { documentMessage: true, messageName: "queryDocumentInfo" },
      { messageName: "iframeReady" },
    ];
    let sent = 0;
    for (const m of tries) {
      try {
        window.parent.postMessage(m, "*");
        sent += 1;
      } catch {
        /* ignore */
      }
    }
    setProbeStatus(`Posláno ${sent} probe zpráv → čekám na odpovědi…`);
  }, []);

  return (
    <main className="bg-white p-4 text-sm text-gray-900">
      <p className="mb-2 font-medium">Tato stránka se otevírá uvnitř Onshape jako Element Panel.</p>
      <p className="text-gray-600">
        Pokud testuješ standalone, použij <a className="underline" href="/preview">/preview</a>.
      </p>
      <div className="mt-4 rounded bg-gray-100 p-3 text-xs">
        <p className="mb-1 font-medium">Debug — query parametry, které panel viděl:</p>
        {rawParams.length === 0 ? (
          <p className="text-gray-500">žádné parametry v URL</p>
        ) : (
          <ul className="font-mono">
            {rawParams.map(([k, v]) => (
              <li key={k}>
                <strong>{k}</strong> = {v}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={probe}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
        >
          Probe Onshape postMessage
        </button>
        <button
          type="button"
          onClick={() => setMessages([])}
          className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50"
        >
          Clear
        </button>
      </div>
      {probeStatus && <p className="mt-2 text-xs text-gray-600">{probeStatus}</p>}
      <div className="mt-3 rounded bg-gray-50 p-3 text-xs">
        <p className="mb-1 font-medium">Zprávy přijaté z parent okna ({messages.length}):</p>
        {messages.length === 0 ? (
          <p className="text-gray-500">žádné zatím — klikni Probe</p>
        ) : (
          <ul className="space-y-2 font-mono">
            {messages.map((m, i) => (
              <li key={i} className="break-all">
                <span className="text-gray-500">[{m.origin}]</span>{" "}
                {typeof m.data === "object"
                  ? JSON.stringify(m.data)
                  : String(m.data)}
              </li>
            ))}
          </ul>
        )}
      </div>
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
