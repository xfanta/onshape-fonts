/**
 * Paper.js-based boolean union of overlapping glyph subpaths.
 *
 * Why paper.js: properly handles outer-vs-hole classification via
 * containment, resolves self-intersections, and outputs cubic Bézier
 * curves (no polyline approximation). Trade-off: ~280 KB gzipped.
 * Dynamically imported the first time merge is requested so /preview
 * pays the cost only when the user opts in.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// paper.js TS types treat resolveCrossings/reorient as optional in some
// versions and use the global `paper` namespace for instance types.
// We type defensively with the namespace + fall back to any where needed.
import type paperModule from "paper";
import {
  CurveData,
  Contour,
  GlyphCurves,
  SEG_CUBIC,
  SEG_LINE,
  Segment,
} from "./textToCurves";

type Paper = typeof paperModule;
type PaperItem = paper.Item;
type PaperPath = paper.Path;

let paperReadyPromise: Promise<Paper> | null = null;

export function getPaper(): Promise<Paper> {
  if (paperReadyPromise) return paperReadyPromise;
  // paper-core is the canvas-less build — works in any browser and
  // dodges paper.js's optional jsdom dependency that breaks SSR bundling.
  paperReadyPromise = import("paper/dist/paper-core").then((mod) => {
    // paper.js exports the PaperScope at both the default and as the
    // namespace itself depending on bundler. Pick whichever has .Path.
    const candidate = mod as unknown as Paper & { default?: Paper };
    const paper: Paper = candidate.Path ? candidate : (candidate.default as Paper);
    paper.setup(new paper.Size(1, 1));
    return paper;
  });
  return paperReadyPromise;
}

export async function mergeCurveContoursWithPaper(
  curves: CurveData,
): Promise<CurveData> {
  const paper = await getPaper();
  const newGlyphs = curves.glyphs.map((g) => mergeGlyph(g, paper));
  return { ...curves, glyphs: newGlyphs };
}

function mergeGlyph(glyph: GlyphCurves, paper: Paper): GlyphCurves {
  if (glyph.contours.length <= 1) return glyph;

  const paths: PaperPath[] = [];
  for (const contour of glyph.contours) {
    if (contour.segments.length === 0) continue;
    const path = new paper.Path();
    const first = contour.segments[0];
    path.moveTo(new paper.Point(first[1], first[2]));
    for (const s of contour.segments) {
      if (s[0] === SEG_LINE) {
        path.lineTo(new paper.Point(s[3], s[4]));
      } else {
        path.cubicCurveTo(
          new paper.Point(s[3], s[4]),
          new paper.Point(s[5], s[6]),
          new paper.Point(s[7], s[8]),
        );
      }
    }
    if (contour.closed) path.closed = true;
    paths.push(path);
  }
  if (paths.length === 0) return glyph;

  let newContours: Contour[];
  try {
    const compound = new paper.CompoundPath({ children: paths }) as paper.CompoundPath & {
      resolveCrossings(): paper.PathItem;
      reorient(nonZero?: boolean, clockwise?: boolean): paper.PathItem;
    };
    // Untangle self-overlaps, then orient outer/holes for non-zero fill.
    compound.resolveCrossings();
    compound.reorient(true, true);
    newContours = collectContours(compound, paper);
    compound.remove();
  } catch {
    // Anything weird → leave glyph as-is rather than corrupting it.
    paths.forEach((p) => p.remove());
    return glyph;
  }

  if (newContours.length === 0) return glyph;
  return { ...glyph, contours: newContours };
}

function collectContours(root: PaperItem, paper: Paper): Contour[] {
  const out: Contour[] = [];
  const visit = (it: PaperItem) => {
    if (it instanceof paper.Path) {
      const segs = pathToSegments(it);
      if (segs.length > 0) {
        out.push({ closed: it.closed, segments: segs });
      }
    } else if (it.children) {
      for (const child of it.children) visit(child);
    }
  };
  visit(root);
  return out;
}

function pathToSegments(path: PaperPath): Segment[] {
  const ps = path.segments;
  if (ps.length < 2) return [];
  const segs: Segment[] = [];
  const last = path.closed ? ps.length : ps.length - 1;
  for (let i = 0; i < last; i++) {
    const a = ps[i];
    const b = ps[(i + 1) % ps.length];
    const ho = a.handleOut;
    const hi = b.handleIn;
    const p0x = a.point.x;
    const p0y = a.point.y;
    const p3x = b.point.x;
    const p3y = b.point.y;
    const isLine =
      Math.abs(ho.x) < 1e-9 &&
      Math.abs(ho.y) < 1e-9 &&
      Math.abs(hi.x) < 1e-9 &&
      Math.abs(hi.y) < 1e-9;
    if (isLine) {
      segs.push([SEG_LINE, p0x, p0y, p3x, p3y]);
    } else {
      segs.push([
        SEG_CUBIC,
        p0x, p0y,
        p0x + ho.x, p0y + ho.y,
        p3x + hi.x, p3y + hi.y,
        p3x, p3y,
      ]);
    }
  }
  return segs;
}
