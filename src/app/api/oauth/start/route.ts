import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getEnv, redirectUriFromRequest } from "@/lib/env";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const env = getEnv();
  const session = await getSession();
  const state = randomBytes(16).toString("hex");
  session.oauthState = state;
  const returnTo = request.nextUrl.searchParams.get("returnTo");
  if (returnTo) session.oauthReturnTo = returnTo;
  await session.save();

  const redirectUri = redirectUriFromRequest(request);
  const authorizeUrl = new URL(`${env.ONSHAPE_OAUTH_URL}/oauth/authorize`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", env.ONSHAPE_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "OAuth2Read OAuth2Write");

  return NextResponse.redirect(authorizeUrl);
}
