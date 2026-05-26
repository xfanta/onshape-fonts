"use client";

import { useEffect, useState } from "react";
import { CurveData } from "@/lib/textToCurves";
import { mergeCurveContoursWithPaper } from "@/lib/mergeContoursPaper";

interface Props {
  curves: CurveData | null;
  onResult: (merged: CurveData | null) => void;
}

/** Toggle + paper.js merge worker. Lives in its own file so it can be
 *  loaded via next/dynamic with ssr:false — paper.js statically pulls
 *  in jsdom in one of its conditional branches, which breaks Next.js's
 *  client-component SSR pass. Keeping the import on the client only
 *  avoids that. */
export default function MergeToggle({ curves, onResult }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!curves || !enabled) {
      onResult(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    mergeCurveContoursWithPaper(curves)
      .then((r) => {
        if (!cancelled) onResult(r);
      })
      .catch(() => {
        if (!cancelled) onResult(null);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [curves, enabled, onResult]);

  return (
    <label className="flex items-start gap-2 rounded border border-gray-200 p-2 text-xs text-gray-700">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => setEnabled(e.target.checked)}
        className="mt-0.5"
      />
      <span className="font-medium">
        Merge overlapping contours per letter
        {busy && (
          <span className="ml-2 text-[11px] font-normal text-gray-500">
            computing…
          </span>
        )}
      </span>
    </label>
  );
}
