FeatureScript 2570;
import(path : "onshape/std/geometry.fs", version : "2570.0");

/**
 * textToSketch — render glyph outlines, supplied as JSON of cubic Bézier
 * segments, into a sketch on the chosen plane. Em-height = `scale`.
 *
 * Expected JSON shape (produced by lib/textToCurves.ts):
 *   {
 *     "v": 1,
 *     "text": "...",
 *     "glyphs": [
 *       { "advance": <num>,
 *         "contours": [
 *           { "closed": <bool>,
 *             "segs": [[x0,y0, x1,y1, x2,y2, x3,y3], ...] }
 *         ]
 *       }
 *     ]
 *   }
 *
 * Each segment is a cubic Bézier with control points P0..P3 in CAD coords
 * (Y-up, baseline = y = 0). Coordinates are normalized so 1 unit = 1 em.
 * They get multiplied by `scale` (a length) to produce sketch coordinates.
 */
annotation { "Feature Type Name" : "Text to Sketch" }
export const textToSketch = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Sketch plane", "Filter" : GeometryType.PLANE }
        definition.sketchPlane is Query;

        annotation { "Name" : "Em-height" }
        isLength(definition.scale, LENGTH_BOUNDS);

        annotation { "Name" : "Curve data (JSON)" }
        definition.curveData is string;
    }
    {
        if (definition.curveData == "")
            throw regenError("curveData is empty");

        var data = parseJson(definition.curveData);
        if (data.v != 1)
            throw regenError("Unsupported curveData version: " ~ toString(data.v));

        var sketch = newSketchOnPlane(context, id + "sketch", {
            "sketchPlane" : definition.sketchPlane
        });

        const scale = definition.scale;
        var totalSegs = 0;

        for (var gi = 0; gi < size(data.glyphs); gi += 1)
        {
            var glyph = data.glyphs[gi];
            for (var ci = 0; ci < size(glyph.contours); ci += 1)
            {
                var contour = glyph.contours[ci];
                for (var si = 0; si < size(contour.segs); si += 1)
                {
                    var s = contour.segs[si];
                    var p0 = vector(s[0], s[1]) * scale;
                    var p1 = vector(s[2], s[3]) * scale;
                    var p2 = vector(s[4], s[5]) * scale;
                    var p3 = vector(s[6], s[7]) * scale;

                    // Cubic Bézier B(t)  with B'(0) = 3*(P1-P0), B'(1) = 3*(P3-P2)
                    // is exactly the Hermite cubic that skFitSpline produces
                    // when given endpoints + matching tangent magnitudes.
                    var segId = "g" ~ toString(gi) ~ "c" ~ toString(ci) ~ "s" ~ toString(si);
                    skFitSpline(sketch, segId, {
                        "points" : [p0, p3],
                        "startDerivative" : (p1 - p0) * 3,
                        "endDerivative" : (p3 - p2) * 3
                    });
                    totalSegs += 1;
                }
            }
        }

        if (totalSegs == 0)
            throw regenError("No segments to render");

        skSolve(sketch);
    });
