import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { onshapeFetch, resolvePublishedFsRef } from "@/lib/onshape";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const env = getEnv();
  const onshapeUserId = request.nextUrl.searchParams.get("userId");
  const session = await getSession();
  const userId = onshapeUserId ?? session.userId;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const elements = await onshapeFetch<
      {
        id: string;
        name: string;
        elementType: string;
        microversionId: string;
      }[]
    >(
      userId,
      `/api/v9/documents/d/${env.ONSHAPE_FS_DOCUMENT_ID}/v/${env.ONSHAPE_FS_VERSION_ID}/elements`,
    );
    const resolved = await resolvePublishedFsRef(userId);
    return NextResponse.json({
      envHint: {
        documentId: env.ONSHAPE_FS_DOCUMENT_ID,
        versionId: env.ONSHAPE_FS_VERSION_ID,
        elementId: env.ONSHAPE_FS_ELEMENT_ID,
        featureName: env.ONSHAPE_FS_FEATURE_NAME,
      },
      elementsAtVersion: elements.map((e) => ({
        id: e.id,
        name: e.name,
        elementType: e.elementType,
        microversionId: e.microversionId,
      })),
      resolvedNamespace: `e${resolved.fsElementId}::m${resolved.microversionId}`,
      resolved,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
