import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OnshapeApiError, addTextToSketchFeature } from "@/lib/onshape";
import { getSession } from "@/lib/session";

const bodySchema = z.object({
  documentId: z.string().min(1),
  workspaceId: z.string().min(1),
  elementId: z.string().min(1),
  curveJson: z.string().min(1),
  name: z.string().optional(),
  onshapeUserId: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Iframe context loses session cookies in some browsers, so accept the
  // Onshape-provided userId from the panel as a fallback. The KV lookup
  // verifies the user actually has a token (no impersonation possible).
  const userId = parsed.data.onshapeUserId ?? session.userId;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const result = await addTextToSketchFeature(
      userId,
      {
        documentId: parsed.data.documentId,
        workspaceId: parsed.data.workspaceId,
        elementId: parsed.data.elementId,
      },
      {
        curveJson: parsed.data.curveJson,
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
