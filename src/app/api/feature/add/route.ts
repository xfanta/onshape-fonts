import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OnshapeApiError, addTextToSketchFeature } from "@/lib/onshape";
import { getSession } from "@/lib/session";

const bodySchema = z.object({
  documentId: z.string().min(1),
  workspaceId: z.string().min(1),
  elementId: z.string().min(1),
  curveJson: z.string().min(1),
  scaleExpression: z.string().min(1),
  name: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await addTextToSketchFeature(
      session.userId,
      {
        documentId: parsed.data.documentId,
        workspaceId: parsed.data.workspaceId,
        elementId: parsed.data.elementId,
      },
      {
        curveJson: parsed.data.curveJson,
        scaleExpression: parsed.data.scaleExpression,
        name: parsed.data.name,
      },
    );
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    if (e instanceof OnshapeApiError) {
      return NextResponse.json(
        { error: "Onshape API error", status: e.status, body: e.body },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
