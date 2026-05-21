import { NextRequest, NextResponse } from "next/server";
import { onshapeFetch } from "@/lib/onshape";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const documentId = params.get("documentId");
  const workspaceId = params.get("workspaceId");
  const elementId = params.get("elementId");
  const onshapeUserId = params.get("userId");
  if (!documentId || !workspaceId || !elementId) {
    return NextResponse.json(
      { error: "documentId, workspaceId, elementId required" },
      { status: 400 },
    );
  }
  const session = await getSession();
  const userId = onshapeUserId ?? session.userId;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const result = await onshapeFetch(
      userId,
      `/api/v9/partstudios/d/${documentId}/w/${workspaceId}/e/${elementId}/features`,
    );
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
