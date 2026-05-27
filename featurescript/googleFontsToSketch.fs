FeatureScript 2960;
import(path : "onshape/std/geometry.fs", version : "2960.0");
import(path : "e72b0d6629740a2630f45f7e", version : "8b152f1c91ee99d27a0f046d");

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
            (meter) : [-500.0, 0.0, 500.0],
            (centimeter) : 0.0,
            (millimeter) : 0.0,
            (inch) : 0.0,
            (foot) : 0.0,
            (yard) : 0.0
        } as LengthBoundSpec;

annotation {
        "Feature Type Name" : "Google Fonts to Sketch",
        "Feature Type Description" : "Renders text from any Google Fonts family or your own uploaded .ttf/.otf file onto the chosen sketch plane as native curves. Em-height, position, and rotation stay editable as feature parameters; the text, font, weight, and layout are baked in when you click Insert (re-open the add-in's panel to change them).",
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
                        "Description" : "Overall size of the text - the height of one em (typically the cap-to-baseline distance plus a little)."
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
                        var x0 = s[1] * scale;
                        var y0 = s[2] * scale;
                        var x1 = s[3] * scale;
                        var y1 = s[4] * scale;
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
                        var x0 = s[1] * scale;
                        var y0 = s[2] * scale;
                        var x1 = s[3] * scale;
                        var y1 = s[4] * scale;
                        var x2 = s[5] * scale;
                        var y2 = s[6] * scale;
                        var x3 = s[7] * scale;
                        var y3 = s[8] * scale;
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
