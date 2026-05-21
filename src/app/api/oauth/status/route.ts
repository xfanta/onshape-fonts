import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getTokenStore } from "@/lib/tokenStore";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ authenticated: false });
  const record = await getTokenStore().get(session.userId);
  return NextResponse.json({
    authenticated: !!record,
    userId: session.userId,
  });
}
