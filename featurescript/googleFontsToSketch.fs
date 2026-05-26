FeatureScript 2960;
import(path : "onshape/std/geometry.fs", version : "2960.0");

/**
 * googleFontsToSketch — render glyph outlines, supplied as JSON, into a sketch.
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
 * Final placement = origin + (offsetX, offsetY), with rotation around
 * that point.
 */

// Signed offset bounds — only the first map entry carries [min, default, max].
export const TEXT_OFFSET_BOUNDS =
{
    (meter)      : [-500.0, 0.0, 500.0],
    (centimeter) : 0.0,
    (millimeter) : 0.0,
    (inch)       : 0.0,
    (foot)       : 0.0,
    (yard)       : 0.0
} as LengthBoundSpec;

annotation {
    "Feature Type Name" : "Google Fonts to Sketch",
    "Feature Type Description" : "Renders text from any Google Fonts family or your own uploaded .ttf/.otf file onto the chosen sketch plane as native curves. Em-height, position, and rotation stay editable as feature parameters; the text, font, weight, and layout are baked in when you click Insert (re-open the add-in's panel to change them).",
    "Icon" : "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"
}
export const googleFontsToSketch = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation {
            "Name" : "Sketch plane",
            "Description" : "Planar face, datum plane, or sketch plane the text will be placed onto. The origin point (if picked) is projected onto this plane.",
            "Filter" : GeometryType.PLANE
        }
        definition.sketchPlane is Query;

        annotation { "Group Name" : "Position", "Collapsed By Default" : false }
        {
            annotation {
                "Name" : "Origin",
                "Description" : "Optional anchor vertex / sketch point. If empty, the text starts at the sketch origin (0, 0). If picked, the point is projected onto the sketch plane and becomes the (0, 0) of the text.",
                "Filter" : EntityType.VERTEX,
                "MaxNumberOfPicks" : 1
            }
            definition.origin is Query;

            annotation {
                "Name" : "Offset X",
                "Description" : "Horizontal nudge from the origin point, in length units. Signed."
            }
            isLength(definition.offsetX, TEXT_OFFSET_BOUNDS);

            annotation {
                "Name" : "Offset Y",
                "Description" : "Vertical nudge from the origin point, in length units. Signed."
            }
            isLength(definition.offsetY, TEXT_OFFSET_BOUNDS);

            annotation {
                "Name" : "Rotation",
                "Description" : "Rotate the whole text around the (origin + offset) point."
            }
            isAngle(definition.rotation, ANGLE_360_ZERO_DEFAULT_BOUNDS);
        }

        annotation { "Group Name" : "Typography", "Collapsed By Default" : false }
        {
            annotation {
                "Name" : "Em-height",
                "Description" : "Overall size of the text — the height of one em (typically the cap-to-baseline distance plus a little)."
            }
            isLength(definition.scale, LENGTH_BOUNDS);
        }

        annotation { "Group Name" : "Advanced", "Collapsed By Default" : true }
        {
            annotation {
                "Name" : "Show raw curve data",
                "Description" : "Reveal the serialized JSON the add-in produced. Useful for debugging; never needs editing by hand."
            }
            definition.showRawData is boolean;

            if (definition.showRawData)
            {
                annotation { "Name" : "Curve data (JSON)", "UIHint" : UIHint.READ_ONLY }
                definition.curveData is string;
            }
        }
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

        // Resolve origin: sketch (0,0) by default; if a vertex is picked,
        // project it onto the sketch plane.
        var originPoint = vector(0 * meter, 0 * meter);
        if (size(evaluateQuery(context, definition.origin)) > 0)
        {
            var p3d = evVertexPoint(context, { "vertex" : definition.origin });
            var sketchPlaneObj = evPlane(context, { "face" : definition.sketchPlane });
            originPoint = worldToPlane3D(sketchPlaneObj, p3d);
        }
        // Apply user offset on top of the resolved origin.
        const ox = originPoint[0] + definition.offsetX;
        const oy = originPoint[1] + definition.offsetY;

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
