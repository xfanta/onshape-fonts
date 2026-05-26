import {
  CurveData,
  SEG_CUBIC,
  SEG_LINE,
  curvesBounds,
} from "./textToCurves";

/** ----------------------------------------------------------------------
 *  SVG export — a single <svg> with each glyph contour as a closed path,
 *  fill-rule="nonzero" so overlapping subpaths union correctly. Output
 *  is in CAD orientation (Y-up); the SVG flips Y in a wrapping group so
 *  the file looks right in browsers.
 *
 *  Scale: 1 em = scaleMm millimeters. SVG width/height in mm so DTP /
 *  illustration tools open it at the intended physical size.
 *  ---------------------------------------------------------------------- */
export function curvesToStandaloneSvg(
  curves: CurveData,
  scaleMm = 25,
): string {
  const b = curvesBounds(curves);
  const margin = 0.05;
  const w = (b.maxX - b.minX + margin * 2) * scaleMm;
  const h = (b.maxY - b.minY + margin * 2) * scaleMm;
  const tx = (-b.minX + margin) * scaleMm;
  const ty = (-b.minY + margin) * scaleMm; // we negate Y inside the group

  const pathParts: string[] = [];
  for (const glyph of curves.glyphs) {
    for (const contour of glyph.contours) {
      if (contour.segments.length === 0) continue;
      const first = contour.segments[0];
      const fx = first[1] * scaleMm;
      const fy = first[2] * scaleMm;
      pathParts.push(`M ${round(fx)} ${round(fy)}`);
      for (const s of contour.segments) {
        if (s[0] === SEG_LINE) {
          pathParts.push(`L ${round(s[3] * scaleMm)} ${round(s[4] * scaleMm)}`);
        } else {
          pathParts.push(
            `C ${round(s[3] * scaleMm)} ${round(s[4] * scaleMm)} ${round(s[5] * scaleMm)} ${round(s[6] * scaleMm)} ${round(s[7] * scaleMm)} ${round(s[8] * scaleMm)}`,
          );
        }
      }
      if (contour.closed) pathParts.push("Z");
    }
  }
  const d = pathParts.join(" ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" version="1.1"
     width="${round(w)}mm" height="${round(h)}mm"
     viewBox="0 0 ${round(w)} ${round(h)}">
  <g transform="translate(${round(tx)} ${round(h - ty)}) scale(1 -1)">
    <path d="${d}" fill="#000" fill-rule="nonzero" />
  </g>
</svg>
`;
}

/** ----------------------------------------------------------------------
 *  DXF export — minimal R12 ASCII DXF with one LWPOLYLINE per contour.
 *  Béziers are sampled into line segments because LWPOLYLINE only carries
 *  straight segments; importers handle that universally. Y-up CAD orient.
 *  Units = millimeters via $INSUNITS = 4.
 *  ---------------------------------------------------------------------- */
const CUBIC_SAMPLES_DXF = 16;

function sampleCubicDxf(
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  p3x: number, p3y: number,
  out: [number, number][],
) {
  for (let i = 1; i <= CUBIC_SAMPLES_DXF; i++) {
    const t = i / CUBIC_SAMPLES_DXF;
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

export function curvesToDxf(curves: CurveData, scaleMm = 25): string {
  const lines: string[] = [];
  const push = (code: number, value: string | number) => {
    lines.push(String(code), String(value));
  };

  // Header
  push(0, "SECTION");
  push(2, "HEADER");
  push(9, "$INSUNITS");
  push(70, 4); // millimeters
  push(0, "ENDSEC");

  // Entities
  push(0, "SECTION");
  push(2, "ENTITIES");

  for (const glyph of curves.glyphs) {
    for (const contour of glyph.contours) {
      if (contour.segments.length === 0) continue;
      const verts: [number, number][] = [];
      const first = contour.segments[0];
      verts.push([first[1] * scaleMm, first[2] * scaleMm]);
      for (const s of contour.segments) {
        if (s[0] === SEG_LINE) {
          verts.push([s[3] * scaleMm, s[4] * scaleMm]);
        } else {
          sampleCubicDxf(
            s[1] * scaleMm, s[2] * scaleMm,
            s[3] * scaleMm, s[4] * scaleMm,
            s[5] * scaleMm, s[6] * scaleMm,
            s[7] * scaleMm, s[8] * scaleMm,
            verts,
          );
        }
      }
      // Drop the trailing duplicate when contour closes back on itself
      if (
        contour.closed &&
        verts.length > 1 &&
        Math.abs(verts[verts.length - 1][0] - verts[0][0]) < 1e-9 &&
        Math.abs(verts[verts.length - 1][1] - verts[0][1]) < 1e-9
      ) {
        verts.pop();
      }
      if (verts.length < 2) continue;

      push(0, "LWPOLYLINE");
      push(8, "0"); // layer
      push(90, verts.length); // vertex count
      push(70, contour.closed ? 1 : 0); // closed flag
      for (const v of verts) {
        push(10, round(v[0]));
        push(20, round(v[1]));
      }
    }
  }

  push(0, "ENDSEC");
  push(0, "EOF");
  return lines.join("\n") + "\n";
}

function round(n: number): number {
  return Math.round(n * 1e3) / 1e3;
}
