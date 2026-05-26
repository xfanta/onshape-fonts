"use client";

import { useEffect, useState } from "react";
import { CurveData } from "@/lib/textToCurves";
import { mergeCurveContoursWithPaper } from "@/lib/mergeContoursPaper";

interface Props {
  curves: CurveData | null;
  onResult: (merged: CurveData | null) => void;
}

export default function MergeToggle({ curves, onResult }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<"idle" | "computing" | "ok" | "error">(
    "idle",
  );
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [before, setBefore] = useState(0);
  const [after, setAfter] = useState(0);

  useEffect(() => {
    if (!curves || !enabled) {
      onResult(null);
      setStatus("idle");
      setErrMsg(null);
      return;
    }
    let cancelled = false;
    const beforeCount = curves.glyphs.reduce(
      (n, g) => n + g.contours.length,
      0,
    );
    setBefore(beforeCount);
    setStatus("computing");
    setErrMsg(null);
    mergeCurveContoursWithPaper(curves)
      .then((r) => {
        if (cancelled) return;
        const afterCount = r.glyphs.reduce((n, g) => n + g.contours.length, 0);
        setAfter(afterCount);
        setStatus("ok");
        onResult(r);
      })
      .catch((e) => {
        if (cancelled) return;
        setErrMsg(e instanceof Error ? e.message : String(e));
        setStatus("error");
        onResult(null);
      });
    return () => {
      cancelled = true;
    };
  }, [curves, enabled, onResult]);

  return (
    <div className="rounded border border-gray-200 p-2 text-xs text-gray-700">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">Reduce overlapping contours per letter</span>
          <span className="block text-[11px] font-normal text-gray-500">
            Best-effort cleanup of self-overlapping glyph outlines.
            Inner holes (o, p, q, b) are kept, but tangent contacts
            (e crossbar, some serifs) may remain.
          </span>
        </span>
      </label>
      {enabled && (
        <div className="mt-1 ml-6 text-[11px] text-gray-500">
          {status === "computing" && "computing with paper.js…"}
          {status === "ok" && (
            <>
              {before} contours → {after}
            </>
          )}
          {status === "error" && (
            <span className="text-red-700">
              paper.js failed: {errMsg ?? "unknown error"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
