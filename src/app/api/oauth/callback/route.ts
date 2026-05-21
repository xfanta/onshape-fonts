import { NextRequest, NextResponse } from "next/server";
import { redirectUriFromRequest } from "@/lib/env";
import {
  exchangeAuthorizationCode,
  getSessionInfo,
} from "@/lib/onshape";
import { getSession } from "@/lib/session";
import { getTokenStore } from "@/lib/tokenStore";

export async function GET(request: NextRequest) {
  const session = await getSession();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return new NextResponse(`OAuth error: ${error}`, { status: 400 });
  }
  if (!code || !state) {
    return new NextResponse("Missing code or state", { status: 400 });
  }
  if (!session.oauthState || session.oauthState !== state) {
    return new NextResponse("Invalid OAuth state", { status: 400 });
  }

  const redirectUri = redirectUriFromRequest(request);
  const tokens = await exchangeAuthorizationCode(code, redirectUri);

  const tempUserId = `temp:${state}`;
  const store = getTokenStore();
  await store.set(tempUserId, tokens);
  try {
    const info = await getSessionInfo(tempUserId);
    await store.delete(tempUserId);
    await store.set(info.id, tokens);
    session.userId = info.id;
  } catch (e) {
    await store.delete(tempUserId);
    throw e;
  }

  session.oauthState = undefined;
  const returnTo = session.oauthReturnTo;
  session.oauthReturnTo = undefined;
  await session.save();

  if (returnTo && returnTo.startsWith("/")) {
    return NextResponse.redirect(new URL(returnTo, request.url));
  }

  return new NextResponse(
    `<html><body><script>
       if (window.opener) {
         window.opener.postMessage({ type: 'onshape-oauth-success' }, '*');
         window.close();
       } else {
         document.body.innerText = 'Přihlášeno. Můžeš zavřít toto okno.';
       }
     </script></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
