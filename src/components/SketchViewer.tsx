"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CurveData,
  SEG_LINE,
  curvesBounds,
} from "@/lib/textToCurves";

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pick a grid step that yields ~15–25 visible lines for the current
 *  viewBox width. Snaps to 1/2/5 × 10^n so the grid feels CAD-like. */
function pickGridStep(viewBoxWidth: number): number {
  const target = viewBoxWidth / 20;
  const exp = Math.floor(Math.log10(target));
  const base = Math.pow(10, exp);
  const ratio = target / base;
  if (ratio < 2) return base;
  if (ratio < 5) return base * 2;
  return base * 5;
}

function boundsToViewBox(b: ReturnType<typeof curvesBounds>): ViewBox {
  // Flip Y because the viewer renders with Y-down SVG; curves are Y-up.
  const padFrac = 0.15;
  const w = Math.max(0.1, b.maxX - b.minX);
  const h = Math.max(0.1, b.maxY - b.minY);
  return {
    x: b.minX - w * padFrac,
    y: -b.maxY - h * padFrac,
    w: w * (1 + padFrac * 2),
    h: h * (1 + padFrac * 2),
  };
}

interface Props {
  curves: CurveData | null;
}

export function SketchViewer({ curves }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewBox, setViewBox] = useState<ViewBox | null>(null);
  const [showPoints, setShowPoints] = useState(true);
  const [filled, setFilled] = useState(false);
  const viewBoxRef = useRef<ViewBox | null>(null);
  viewBoxRef.current = viewBox;

  // Reset viewBox only when the text content actually changes (typing a
  // new word). Toggling Reduce or switching fonts re-emits curves with
  // the same text — in that case keep the user's current pan/zoom.
  const textKey = curves?.text ?? "__empty__";
  useEffect(() => {
    if (!curves) {
      setViewBox(null);
      return;
    }
    setViewBox(boundsToViewBox(curvesBounds(curves)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textKey]);

  // Native wheel handler (React onWheel is passive by default — we need
  // preventDefault so the page itself doesn't scroll while zooming).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const vb = viewBoxRef.current;
      if (!vb) return;
      const rect = el.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
      const cx = vb.x + mx * vb.w;
      const cy = vb.y + my * vb.h;
      const zoom = e.deltaY < 0 ? 1 / 1.15 : 1.15;
      const newW = vb.w * zoom;
      const newH = vb.h * zoom;
      setViewBox({
        x: cx - mx * newW,
        y: cy - my * newH,
        w: newW,
        h: newH,
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Pan via drag.
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startVb: ViewBox;
  } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!viewBoxRef.current) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startVb: viewBoxRef.current,
    };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const start = dragRef.current.startVb;
    const dx = ((e.clientX - dragRef.current.startX) / rect.width) * start.w;
    const dy = ((e.clientY - dragRef.current.startY) / rect.height) * start.h;
    setViewBox({
      x: start.x - dx,
      y: start.y - dy,
      w: start.w,
      h: start.h,
    });
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const fitToContent = useCallback(() => {
    if (!curves) return;
    setViewBox(boundsToViewBox(curvesBounds(curves)));
  }, [curves]);

  const zoomBy = useCallback((factor: number) => {
    const vb = viewBoxRef.current;
    if (!vb) return;
    const cx = vb.x + vb.w / 2;
    const cy = vb.y + vb.h / 2;
    const newW = vb.w * factor;
    const newH = vb.h * factor;
    setViewBox({
      x: cx - newW / 2,
      y: cy - newH / 2,
      w: newW,
      h: newH,
    });
  }, []);

  // Build SVG path data + collect anchor points for the dots.
  const { pathD, points, segCount, glyphCount } = useMemo(() => {
    if (!curves) {
      return { pathD: "", points: [] as [number, number][], segCount: 0, glyphCount: 0 };
    }
    const parts: string[] = [];
    const pts: [number, number][] = [];
    let segs = 0;
    for (const glyph of curves.glyphs) {
      for (const contour of glyph.contours) {
        if (contour.segments.length === 0) continue;
        const first = contour.segments[0];
        const fx = first[1];
        const fy = -first[2];
        parts.push(`M ${fx} ${fy}`);
        pts.push([fx, fy]);
        for (const s of contour.segments) {
          segs += 1;
          if (s[0] === SEG_LINE) {
            const ex = s[3];
            const ey = -s[4];
            parts.push(`L ${ex} ${ey}`);
            pts.push([ex, ey]);
          } else {
            parts.push(
              `C ${s[3]} ${-s[4]} ${s[5]} ${-s[6]} ${s[7]} ${-s[8]}`,
            );
            pts.push([s[7], -s[8]]);
          }
        }
        if (contour.closed) parts.push("Z");
      }
    }
    return {
      pathD: parts.join(" "),
      points: pts,
      segCount: segs,
      glyphCount: curves.glyphs.length,
    };
  }, [curves]);

  if (!curves || !viewBox) {
    return (
      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center rounded border border-gray-200 bg-white text-sm text-gray-400"
      >
        Pick a font and type some text.
      </div>
    );
  }

  const viewBoxStr = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;
  const gridStep = pickGridStep(viewBox.w);
  const curveStroke = viewBox.w / 400;
  const axisStroke = viewBox.w / 800;
  const gridStroke = viewBox.w / 1500;
  const pointR = viewBox.w / 350;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded border border-gray-200 bg-white"
      style={{
        cursor: dragRef.current ? "grabbing" : "grab",
        touchAction: "none",
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <svg
        viewBox={viewBoxStr}
        className="h-full w-full select-none"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern
            id="grid"
            width={gridStep}
            height={gridStep}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={gridStroke}
            />
          </pattern>
        </defs>
        {/* Extend the grid and axes far beyond the viewBox so that with
            any preserveAspectRatio padding (or when the user pans) the
            grid still covers the whole visible canvas — no white gutters. */}
        <rect
          x={viewBox.x - viewBox.w * 3}
          y={viewBox.y - viewBox.h * 3}
          width={viewBox.w * 7}
          height={viewBox.h * 7}
          fill="url(#grid)"
        />
        <line
          x1={viewBox.x - viewBox.w * 3}
          y1={0}
          x2={viewBox.x + viewBox.w * 4}
          y2={0}
          stroke="#cbd5e1"
          strokeWidth={axisStroke}
        />
        <line
          x1={0}
          y1={viewBox.y - viewBox.h * 3}
          x2={0}
          y2={viewBox.y + viewBox.h * 4}
          stroke="#cbd5e1"
          strokeWidth={axisStroke}
        />

        {/* Curves — fill mode shows the merged letterform (overlapping
            contours unified by winding rule, just like Onshape's region
            detector). Wireframe mode shows construction geometry with
            anchor points. */}
        {filled ? (
          <path
            d={pathD}
            fill="#1189e3"
            fillRule="nonzero"
            stroke="#1189e3"
            strokeWidth={curveStroke * 0.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : (
          <>
            <path
              d={pathD}
              fill="none"
              stroke="#1189e3"
              strokeWidth={curveStroke}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {showPoints &&
              points.map((p, i) => (
                <circle
                  key={i}
                  cx={p[0]}
                  cy={p[1]}
                  r={pointR}
                  fill="#1189e3"
                  stroke="#fff"
                  strokeWidth={pointR * 0.3}
                />
              ))}
          </>
        )}
      </svg>

      {/* Floating controls */}
      <div className="absolute right-2 top-2 flex items-center gap-1 rounded border border-gray-200 bg-white/95 p-1 text-xs shadow-sm">
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.4)}
          className="rounded px-2 py-1 hover:bg-gray-100"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1.4)}
          className="rounded px-2 py-1 hover:bg-gray-100"
          title="Zoom out"
        >
          −
        </button>
        <div className="mx-1 h-4 w-px bg-gray-200" />
        <button
          type="button"
          onClick={fitToContent}
          className="rounded px-2 py-1 hover:bg-gray-100"
          title="Fit to content"
        >
          Fit
        </button>
        <div className="mx-1 h-4 w-px bg-gray-200" />
        <label className="flex items-center gap-1 px-1 py-1">
          <input
            type="checkbox"
            checked={filled}
            onChange={(e) => setFilled(e.target.checked)}
          />
          <span>Filled</span>
        </label>
        {!filled && (
          <label className="flex items-center gap-1 px-1 py-1">
            <input
              type="checkbox"
              checked={showPoints}
              onChange={(e) => setShowPoints(e.target.checked)}
            />
            <span>Points</span>
          </label>
        )}
      </div>

      {/* Stats overlay */}
      <div className="absolute bottom-2 left-2 rounded bg-white/95 px-2 py-1 text-xs text-gray-600 shadow-sm">
        {glyphCount} glyphs · {segCount} segments · em ≈ 1.0
      </div>
    </div>
  );
}
