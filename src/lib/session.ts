import { SessionOptions, getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getEnv } from "./env";

export interface SessionData {
  userId?: string;
  oauthState?: string;
  oauthReturnTo?: string;
}

function options(): SessionOptions {
  return {
    password: getEnv().SESSION_SECRET,
    cookieName: "onshape-fonts-session",
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      path: "/",
    },
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, options());
}
