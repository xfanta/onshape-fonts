import { parse as parseFont, Font, PathCommand } from "opentype.js";

export type CubicSeg = [
  number, number,
  number, number,
  number, number,
  number, number,
];

export interface Contour {
  closed: boolean;
  segs: CubicSeg[];
}

export interface GlyphCurves {
  char: string;
  advance: number;
  contours: Contour[];
}

export interface CurveData {
  v: 1;
  text: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  glyphs: GlyphCurves[];
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function commandsToContours(
  commands: PathCommand[],
  unitsPerEm: number,
  xOffsetUnits: number,
): Contour[] {
  const contours: Contour[] = [];
  let current: Contour | null = null;
  let startX = 0, startY = 0;
  let cx = 0, cy = 0;

  const push = (seg: CubicSeg) => {
    if (!current) {
      current = { closed: false, segs: [] };
      contours.push(current);
    }
    current.segs.push(seg);
  };

  const xy = (x: number, y: number): [number, number] => [
    round6((x + xOffsetUnits) / unitsPerEm),
    round6(-y / unitsPerEm),
  ];

  for (const cmd of commands) {
    if (cmd.type === "M") {
      current = { closed: false, segs: [] };
      contours.push(current);
      [startX, startY] = [cmd.x, cmd.y];
      [cx, cy] = [cmd.x, cmd.y];
    } else if (cmd.type === "L") {
      const p0x = cx, p0y = cy;
      const p3x = cmd.x, p3y = cmd.y;
      const c1x = p0x + (p3x - p0x) / 3;
      const c1y = p0y + (p3y - p0y) / 3;
      const c2x = p0x + (2 * (p3x - p0x)) / 3;
      const c2y = p0y + (2 * (p3y - p0y)) / 3;
      const [a, b] = xy(p0x, p0y);
      const [c, d] = xy(c1x, c1y);
      const [e, f] = xy(c2x, c2y);
      const [g, h] = xy(p3x, p3y);
      push([a, b, c, d, e, f, g, h]);
      [cx, cy] = [p3x, p3y];
    } else if (cmd.type === "Q") {
      const p0x = cx, p0y = cy;
      const qx = cmd.x1, qy = cmd.y1;
      const p3x = cmd.x, p3y = cmd.y;
      const c1x = p0x + (2 * (qx - p0x)) / 3;
      const c1y = p0y + (2 * (qy - p0y)) / 3;
      const c2x = p3x + (2 * (qx - p3x)) / 3;
      const c2y = p3y + (2 * (qy - p3y)) / 3;
      const [a, b] = xy(p0x, p0y);
      const [c, d] = xy(c1x, c1y);
      const [e, f] = xy(c2x, c2y);
      const [g, h] = xy(p3x, p3y);
      push([a, b, c, d, e, f, g, h]);
      [cx, cy] = [p3x, p3y];
    } else if (cmd.type === "C") {
      const [a, b] = xy(cx, cy);
      const [c, d] = xy(cmd.x1, cmd.y1);
      const [e, f] = xy(cmd.x2, cmd.y2);
      const [g, h] = xy(cmd.x, cmd.y);
      push([a, b, c, d, e, f, g, h]);
      [cx, cy] = [cmd.x, cmd.y];
    } else if (cmd.type === "Z") {
      if (current && current.segs.length > 0) {
        if (cx !== startX || cy !== startY) {
          const p0x = cx, p0y = cy;
          const p3x = startX, p3y = startY;
          const c1x = p0x + (p3x - p0x) / 3;
          const c1y = p0y + (p3y - p0y) / 3;
          const c2x = p0x + (2 * (p3x - p0x)) / 3;
          const c2y = p0y + (2 * (p3y - p0y)) / 3;
          const [a, b] = xy(p0x, p0y);
          const [c, d] = xy(c1x, c1y);
          const [e, f] = xy(c2x, c2y);
          const [g, h] = xy(p3x, p3y);
          push([a, b, c, d, e, f, g, h]);
        }
        const last = current.segs[current.segs.length - 1];
        const first = current.segs[0];
        last[6] = first[0];
        last[7] = first[1];
        current.closed = true;
      }
      [cx, cy] = [startX, startY];
    }
  }

  return contours.filter((c) => c.segs.length > 0);
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
    v: 1,
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
      if (contour.segs.length === 0) continue;
      const [x0, y0] = contour.segs[0];
      parts.push(`M ${x0} ${y0}`);
      for (const s of contour.segs) {
        parts.push(`C ${s[2]} ${s[3]} ${s[4]} ${s[5]} ${s[6]} ${s[7]}`);
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
      for (const s of contour.segs) {
        for (let i = 0; i < 8; i += 2) {
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
