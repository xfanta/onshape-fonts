FeatureScript 2960;
import(path : "onshape/std/geometry.fs", version : "2960.0");

/**
 * textToSketch — render glyph outlines, supplied as JSON of cubic Bézier
 * segments, into a sketch on the chosen plane.
 *
 * Editable parameters:
 *   - sketchPlane: where to put the text
 *   - scale (Em-height): overall size; geometry scales proportionally
 *   - translateX, translateY: offset within the sketch plane
 *   - rotation: rotation around the sketch origin (deg)
 *   - curveData: serialized glyph outlines (set by the panel app)
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
 */
annotation { "Feature Type Name" : "Text to Sketch" }
export const textToSketch = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Sketch plane", "Filter" : GeometryType.PLANE }
        definition.sketchPlane is Query;

        annotation { "Name" : "Em-height" }
        isLength(definition.scale, LENGTH_BOUNDS);

        annotation { "Name" : "Translate X" }
        isLength(definition.translateX, ZERO_INCLUSIVE_OFFSET_BOUNDS);

        annotation { "Name" : "Translate Y" }
        isLength(definition.translateY, ZERO_INCLUSIVE_OFFSET_BOUNDS);

        annotation { "Name" : "Rotation" }
        isAngle(definition.rotation, ANGLE_360_ZERO_DEFAULT_BOUNDS);

        annotation { "Name" : "Curve data (JSON)", "UIHint" : UIHint.READ_ONLY }
        definition.curveData is string;
    }
    {
        if (definition.curveData == "")
            throw regenError("curveData is empty");
        if (size(evaluateQuery(context, definition.sketchPlane)) == 0)
            throw regenError("Vyber sketch plane", ["sketchPlane"]);

        var data = parseJson(definition.curveData);
        if (data.v != 1)
            throw regenError("Unsupported curveData version: " ~ toString(data.v));

        var sketch = newSketch(context, id + "sketch", {
            "sketchPlane" : definition.sketchPlane
        });

        const scale = definition.scale;
        const tx = definition.translateX;
        const ty = definition.translateY;
        const cosT = cos(definition.rotation);
        const sinT = sin(definition.rotation);
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

                    // Inline transform: rotate em-normalized point then translate.
                    var x0 = s[0] * scale; var y0 = s[1] * scale;
                    var x1 = s[2] * scale; var y1 = s[3] * scale;
                    var x2 = s[4] * scale; var y2 = s[5] * scale;
                    var x3 = s[6] * scale; var y3 = s[7] * scale;
                    var p0 = vector(x0 * cosT - y0 * sinT + tx, x0 * sinT + y0 * cosT + ty);
                    var p1 = vector(x1 * cosT - y1 * sinT + tx, x1 * sinT + y1 * cosT + ty);
                    var p2 = vector(x2 * cosT - y2 * sinT + tx, x2 * sinT + y2 * cosT + ty);
                    var p3 = vector(x3 * cosT - y3 * sinT + tx, x3 * sinT + y3 * cosT + ty);

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
