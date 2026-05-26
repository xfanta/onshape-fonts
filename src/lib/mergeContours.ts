import polygonClipping from "polygon-clipping";
import type { MultiPolygon, Pair, Polygon, Ring } from "polygon-clipping";
import {
  Contour,
  CurveData,
  GlyphCurves,
  SEG_CUBIC,
  SEG_LINE,
  Segment,
} from "./textToCurves";

/** Cubic Bézier samples per segment. Higher = smoother polyline but more
 *  sketch entities in Onshape. 10 is a reasonable balance for typical
 *  letter sizes. */
const CUBIC_SUBDIVISIONS = 10;

function sampleCubic(
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  p3x: number, p3y: number,
  out: Pair[],
) {
  // Skip t=0 (added by caller as previous endpoint), include t=1.
  for (let i = 1; i <= CUBIC_SUBDIVISIONS; i++) {
    const t = i / CUBIC_SUBDIVISIONS;
    const mt = 1 - t;
    const x =
      mt * mt * mt * p0x +
      3 * mt * mt * t * p1x +
      3 * mt * t * t * p2x +
      t * t * t * p3x;
    const y =
      mt * mt * mt * p0y +
      3 * mt * mt * t * p1y +
      3 * mt * t * t * p2y +
      t * t * t * p3y;
    out.push([x, y]);
  }
}

function contourToRing(contour: Contour): Ring | null {
  if (contour.segments.length === 0) return null;
  const ring: Pair[] = [];
  const first = contour.segments[0];
  ring.push([first[1], first[2]]);
  for (const s of contour.segments) {
    if (s[0] === SEG_LINE) {
      ring.push([s[3], s[4]]);
    } else {
      sampleCubic(s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], ring);
    }
  }
  // polygon-clipping requires closed rings (first == last)
  const head = ring[0];
  const tail = ring[ring.length - 1];
  if (head[0] !== tail[0] || head[1] !== tail[1]) {
    ring.push([head[0], head[1]]);
  }
  if (ring.length < 4) return null;
  return ring;
}

function ringToSegments(ring: Pair[]): Segment[] {
  const segs: Segment[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    segs.push([SEG_LINE, ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1]]);
  }
  return segs;
}

/** Boolean-union the overlapping closed subpaths of a single glyph so
 *  each region in the resulting sketch is one connected area + holes.
 *  Bézier segments are sampled into polyline approximations. */
export function mergeGlyphContours(glyph: GlyphCurves): GlyphCurves {
  if (glyph.contours.length <= 1) return glyph;
  const polygons: Polygon[] = [];
  for (const contour of glyph.contours) {
    const ring = contourToRing(contour);
    if (ring) polygons.push([ring]);
  }
  if (polygons.length === 0) return glyph;

  // Stack-union all polygons. polygon-clipping handles holes and
  // returns a MultiPolygon (array of polygons, each = outer + holes).
  let result: MultiPolygon = [polygons[0]];
  for (let i = 1; i < polygons.length; i++) {
    result = polygonClipping.union(result, [polygons[i]]);
  }

  const newContours: Contour[] = [];
  for (const polygon of result) {
    for (const ring of polygon) {
      const segs = ringToSegments(ring);
      if (segs.length > 0) {
        newContours.push({ closed: true, segments: segs });
      }
    }
  }
  return { ...glyph, contours: newContours };
}

export function mergeCurveContours(curves: CurveData): CurveData {
  return {
    ...curves,
    glyphs: curves.glyphs.map(mergeGlyphContours),
  };
}
