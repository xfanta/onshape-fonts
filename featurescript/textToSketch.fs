FeatureScript 2960;
import(path : "onshape/std/geometry.fs", version : "2960.0");

/**
 * textToSketch — render glyph outlines, supplied as JSON, into a sketch.
 *
 * JSON wire format v2 (produced by lib/textToCurves.ts):
 *   {
 *     "v": 2,
 *     "text": "...",
 *     "glyphs": [
 *       { "advance": <num>,
 *         "contours": [
 *           { "closed": <bool>,
 *             "segments": [
 *               [0, x0, y0, x1, y1],                          // line
 *               [1, x0, y0, x1, y1, x2, y2, x3, y3],          // cubic Bézier
 *               ...
 *             ]
 *           }
 *         ]
 *       }
 *     ]
 *   }
 *
 * Coordinates are em-normalized (1 unit = 1 em), Y-up, baseline = y = 0.
 * Multiply by `scale`, rotate around origin, place at origin point.
 */
annotation { "Feature Type Name" : "Text to Sketch" }
export const textToSketch = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Sketch plane", "Filter" : GeometryType.PLANE }
        definition.sketchPlane is Query;

        annotation { "Name" : "Origin", "Filter" : EntityType.VERTEX, "MaxNumberOfPicks" : 1 }
        definition.origin is Query;

        annotation { "Name" : "Em-height" }
        isLength(definition.scale, LENGTH_BOUNDS);

        annotation { "Name" : "Rotation" }
        isAngle(definition.rotation, ANGLE_360_ZERO_DEFAULT_BOUNDS);

        annotation { "Name" : "Curve data (JSON)", "UIHint" : UIHint.READ_ONLY }
        definition.curveData is string;
    }
    {
        if (definition.curveData == "")
            throw regenError("curveData is empty");
        if (size(evaluateQuery(context, definition.sketchPlane)) == 0)
            throw regenError("Pick a sketch plane", ["sketchPlane"]);

        var data = parseJson(definition.curveData);
        if (data.v != 2)
            throw regenError("Unsupported curveData version: " ~ toString(data.v));

        var sketch = newSketch(context, id + "sketch", {
            "sketchPlane" : definition.sketchPlane
        });

        const scale = definition.scale;
        const cosT = cos(definition.rotation);
        const sinT = sin(definition.rotation);

        // Origin point — sketch (0,0) by default; if the user picked a vertex,
        // project that 3D point onto the sketch plane to get a 2D offset.
        var originPoint = vector(0 * meter, 0 * meter);
        if (size(evaluateQuery(context, definition.origin)) > 0)
        {
            var p3d = evVertexPoint(context, { "vertex" : definition.origin });
            var sketchPlaneObj = evPlane(context, { "face" : definition.sketchPlane });
            originPoint = worldToPlane3D(sketchPlaneObj, p3d);
        }
        const ox = originPoint[0];
        const oy = originPoint[1];

        var totalSegs = 0;

        for (var gi = 0; gi < size(data.glyphs); gi += 1)
        {
            var glyph = data.glyphs[gi];
            for (var ci = 0; ci < size(glyph.contours); ci += 1)
            {
                var contour = glyph.contours[ci];
                for (var si = 0; si < size(contour.segments); si += 1)
                {
                    var s = contour.segments[si];
                    var segId = "g" ~ toString(gi) ~ "c" ~ toString(ci) ~ "s" ~ toString(si);

                    if (s[0] == 0)
                    {
                        // Line: [0, x0,y0, x1,y1]
                        var x0 = s[1] * scale; var y0 = s[2] * scale;
                        var x1 = s[3] * scale; var y1 = s[4] * scale;
                        var p0 = vector(x0 * cosT - y0 * sinT + ox, x0 * sinT + y0 * cosT + oy);
                        var p1 = vector(x1 * cosT - y1 * sinT + ox, x1 * sinT + y1 * cosT + oy);
                        skLineSegment(sketch, segId, {
                            "start" : p0,
                            "end" : p1
                        });
                    }
                    else
                    {
                        // Cubic Bézier: [1, x0,y0, x1,y1, x2,y2, x3,y3]
                        var x0 = s[1] * scale; var y0 = s[2] * scale;
                        var x1 = s[3] * scale; var y1 = s[4] * scale;
                        var x2 = s[5] * scale; var y2 = s[6] * scale;
                        var x3 = s[7] * scale; var y3 = s[8] * scale;
                        var p0 = vector(x0 * cosT - y0 * sinT + ox, x0 * sinT + y0 * cosT + oy);
                        var p1 = vector(x1 * cosT - y1 * sinT + ox, x1 * sinT + y1 * cosT + oy);
                        var p2 = vector(x2 * cosT - y2 * sinT + ox, x2 * sinT + y2 * cosT + oy);
                        var p3 = vector(x3 * cosT - y3 * sinT + ox, x3 * sinT + y3 * cosT + oy);

                        skFitSpline(sketch, segId, {
                            "points" : [p0, p3],
                            "startDerivative" : (p1 - p0) * 3,
                            "endDerivative" : (p3 - p2) * 3
                        });
                    }
                    totalSegs += 1;
                }
            }
        }

        if (totalSegs == 0)
            throw regenError("No segments to render");

        skSolve(sketch);
    });
