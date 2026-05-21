import { parse as parseFont, Font, PathCommand } from "opentype.js";

/**
 * Path segment in our wire format. First element is a type tag:
 *   0 = line:  [0, x0, y0, x1, y1]
 *   1 = cubic: [1, x0, y0, x1, y1, x2, y2, x3, y3]
 *
 * A single typed array preserves the original drawing order, which matters
 * for SVG rendering (the line vs curve sequence) and for Onshape sketch
 * region detection (endpoints must topologically connect).
 */
export type Segment = number[];

export const SEG_LINE = 0;
export const SEG_CUBIC = 1;

export interface Contour {
  closed: boolean;
  segments: Segment[];
}

export interface GlyphCurves {
  char: string;
  advance: number;
  contours: Contour[];
}

export interface CurveData {
  v: 2;
  text: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  glyphs: GlyphCurves[];
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Distance from point (px,py) to the infinite line through (ax,ay)-(bx,by). */
function distToLine(
  ax: number, ay: number,
  bx: number, by: number,
  px: number, py: number,
): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = ((px - ax) * dx + (py - ay) * dy) / len2;
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Treat as line when control is within 0.5% of em-size off the chord. */
function isCollinearQuad(
  p0x: number, p0y: number,
  qx: number, qy: number,
  p3x: number, p3y: number,
): boolean {
  const tol = 0.005 * Math.max(Math.abs(p3x - p0x), Math.abs(p3y - p0y), 1);
  return distToLine(p0x, p0y, p3x, p3y, qx, qy) < tol;
}

function isCollinearCubic(
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  p3x: number, p3y: number,
): boolean {
  const tol = 0.005 * Math.max(Math.abs(p3x - p0x), Math.abs(p3y - p0y), 1);
  return (
    distToLine(p0x, p0y, p3x, p3y, p1x, p1y) < tol &&
    distToLine(p0x, p0y, p3x, p3y, p2x, p2y) < tol
  );
}

function commandsToContours(
  commands: PathCommand[],
  unitsPerEm: number,
  xOffsetUnits: number,
): Contour[] {
  const contours: Contour[] = [];
  let current: Contour | null = null;
  let startX = 0, startY = 0;
  let cx = 0, cy = 0;
  let firstSketchPoint: [number, number] | null = null;

  // OTF/CFF fonts (parsed by opentype.js) often omit the explicit Z command;
  // the contour is implicitly closed by the rendering engine. We need to
  // emit the closing line ourselves whenever a contour ends (new M or end
  // of stream) without arriving back at the start point.
  const implicitClose = () => {
    if (current && current.segments.length > 0 && firstSketchPoint) {
      if (cx !== startX || cy !== startY) {
        const a = xy(cx, cy);
        current.segments.push([
          SEG_LINE,
          a[0],
          a[1],
          firstSketchPoint[0],
          firstSketchPoint[1],
        ]);
      }
      current.closed = true;
    }
  };

  const ensure = (): Contour => {
    if (!current) {
      current = { closed: false, segments: [] };
      contours.push(current);
    }
    return current;
  };

  const xy = (x: number, y: number): [number, number] => [
    round6((x + xOffsetUnits) / unitsPerEm),
    round6(-y / unitsPerEm),
  ];

  for (const cmd of commands) {
    if (cmd.type === "M") {
      // Implicitly close the previous contour (OTF/CFF may not emit Z).
      implicitClose();
      current = { closed: false, segments: [] };
      contours.push(current);
      [startX, startY] = [cmd.x, cmd.y];
      [cx, cy] = [cmd.x, cmd.y];
      firstSketchPoint = null;
    } else if (cmd.type === "L") {
      const a = xy(cx, cy);
      const b = xy(cmd.x, cmd.y);
      ensure().segments.push([SEG_LINE, a[0], a[1], b[0], b[1]]);
      if (!firstSketchPoint) firstSketchPoint = a;
      [cx, cy] = [cmd.x, cmd.y];
    } else if (cmd.type === "Q") {
      const p0x = cx, p0y = cy;
      const qx = cmd.x1, qy = cmd.y1;
      const p3x = cmd.x, p3y = cmd.y;
      const a = xy(p0x, p0y);
      const d = xy(p3x, p3y);
      if (isCollinearQuad(p0x, p0y, qx, qy, p3x, p3y)) {
        // Degenerate quadratic (control on the line) — emit as line.
        ensure().segments.push([SEG_LINE, a[0], a[1], d[0], d[1]]);
      } else {
        const c1x = p0x + (2 * (qx - p0x)) / 3;
        const c1y = p0y + (2 * (qy - p0y)) / 3;
        const c2x = p3x + (2 * (qx - p3x)) / 3;
        const c2y = p3y + (2 * (qy - p3y)) / 3;
        const b1 = xy(c1x, c1y);
        const b2 = xy(c2x, c2y);
        ensure().segments.push([SEG_CUBIC, a[0], a[1], b1[0], b1[1], b2[0], b2[1], d[0], d[1]]);
      }
      if (!firstSketchPoint) firstSketchPoint = a;
      [cx, cy] = [p3x, p3y];
    } else if (cmd.type === "C") {
      const a = xy(cx, cy);
      const d = xy(cmd.x, cmd.y);
      if (isCollinearCubic(cx, cy, cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y)) {
        // Degenerate cubic (all controls colinear) — emit as line so we don't
        // hit skFitSpline edge cases (tangents near zero / collapsed Hermite).
        ensure().segments.push([SEG_LINE, a[0], a[1], d[0], d[1]]);
      } else {
        const b1 = xy(cmd.x1, cmd.y1);
        const b2 = xy(cmd.x2, cmd.y2);
        ensure().segments.push([SEG_CUBIC, a[0], a[1], b1[0], b1[1], b2[0], b2[1], d[0], d[1]]);
      }
      if (!firstSketchPoint) firstSketchPoint = a;
      [cx, cy] = [cmd.x, cmd.y];
    } else if (cmd.type === "Z") {
      implicitClose();
      [cx, cy] = [startX, startY];
      firstSketchPoint = null;
    }
  }
  // Final contour: implicitly close if the font omitted the trailing Z.
  implicitClose();

  return contours.filter((c) => c.segments.length > 0);
}

export function textToCurves(text: string, font: Font): CurveData {
  const unitsPerEm = font.unitsPerEm;
  const ascender = font.ascender;
  const descender = font.descender;

  const glyphs: GlyphCurves[] = [];
  let xCursor = 0;

  for (const char of Array.from(text)) {
    const glyph = font.charToGlyph(char);
    const path = glyph.getPath(0, 0, unitsPerEm);
    const advanceUnits = glyph.advanceWidth ?? 0;

    const contours = commandsToContours(
      path.commands as PathCommand[],
      unitsPerEm,
      xCursor,
    );

    glyphs.push({
      char,
      advance: round6(advanceUnits / unitsPerEm),
      contours,
    });

    xCursor += advanceUnits;
  }

  return {
    v: 2,
    text,
    unitsPerEm,
    ascender: round6(ascender / unitsPerEm),
    descender: round6(descender / unitsPerEm),
    glyphs,
  };
}

export async function loadFontFromBuffer(buffer: ArrayBuffer): Promise<Font> {
  return parseFont(buffer);
}

export function curvesToSvgPath(data: CurveData): string {
  const parts: string[] = [];
  for (const glyph of data.glyphs) {
    for (const contour of glyph.contours) {
      if (contour.segments.length === 0) continue;
      const first = contour.segments[0];
      parts.push(`M ${first[1]} ${first[2]}`);
      for (const s of contour.segments) {
        if (s[0] === SEG_LINE) {
          parts.push(`L ${s[3]} ${s[4]}`);
        } else {
          parts.push(`C ${s[3]} ${s[4]} ${s[5]} ${s[6]} ${s[7]} ${s[8]}`);
        }
      }
      if (contour.closed) parts.push("Z");
    }
  }
  return parts.join(" ");
}

export function curvesBounds(data: CurveData): {
  minX: number; minY: number; maxX: number; maxY: number;
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const glyph of data.glyphs) {
    for (const contour of glyph.contours) {
      for (const s of contour.segments) {
        const start = s[0] === SEG_LINE ? 1 : 1;
        for (let i = start; i < s.length; i += 2) {
          minX = Math.min(minX, s[i]);
          maxX = Math.max(maxX, s[i]);
          minY = Math.min(minY, s[i + 1]);
          maxY = Math.max(maxY, s[i + 1]);
        }
      }
    }
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}
