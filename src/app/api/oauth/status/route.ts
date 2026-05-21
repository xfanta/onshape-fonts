import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getTokenStore } from "@/lib/tokenStore";

export async function GET(request: NextRequest) {
  // Prefer userId from query (iframe panel passes Onshape's userId), fall
  // back to session cookie (works for standalone /preview-style flows).
  const fromQuery = request.nextUrl.searchParams.get("userId");
  const session = await getSession();
  const userId = fromQuery ?? session.userId;
  if (!userId) return NextResponse.json({ authenticated: false });
  const record = await getTokenStore().get(userId);
  return NextResponse.json({
    authenticated: !!record,
    userId,
  });
}
