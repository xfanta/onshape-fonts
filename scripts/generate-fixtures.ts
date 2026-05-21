import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "opentype.js";
import { textToCurves, curvesBounds } from "../src/lib/textToCurves";

interface Sample {
  text: string;
  outFile: string;
  fontPath: string;
}

const samples: Sample[] = [
  {
    text: "Hello",
    fontPath: "/System/Library/Fonts/Supplemental/Arial.ttf",
    outFile: "arial-hello.json",
  },
  {
    text: "O",
    fontPath: "/System/Library/Fonts/Supplemental/Arial.ttf",
    outFile: "arial-O.json",
  },
  {
    text: "AB",
    fontPath: "/System/Library/Fonts/Supplemental/Arial.ttf",
    outFile: "arial-AB.json",
  },
  {
    text: "Onshape",
    fontPath: "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
    outFile: "times-onshape.json",
  },
];

const fixturesDir = resolve(__dirname, "..", "fixtures");

for (const s of samples) {
  try {
    const buffer = readFileSync(s.fontPath);
    const font = parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    const curves = textToCurves(s.text, font);
    const b = curvesBounds(curves);
    const json = JSON.stringify(curves);
    writeFileSync(resolve(fixturesDir, s.outFile), JSON.stringify(curves, null, 2));
    const segCount = curves.glyphs.reduce(
      (n, g) => n + g.contours.reduce((m, c) => m + c.segments.length, 0),
      0,
    );
    const contourCount = curves.glyphs.reduce((n, g) => n + g.contours.length, 0);
    console.log(
      `${s.outFile.padEnd(30)} ${s.text.padEnd(10)} ${curves.glyphs.length} glyphs, ${contourCount} contours, ${segCount} segs, bounds (${b.minX.toFixed(2)},${b.minY.toFixed(2)})→(${b.maxX.toFixed(2)},${b.maxY.toFixed(2)}), ${(json.length / 1024).toFixed(1)} KB`,
    );
  } catch (e) {
    console.error(`FAIL ${s.outFile}: ${e instanceof Error ? e.message : e}`);
  }
}
