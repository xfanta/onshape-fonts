import { NextRequest, NextResponse } from "next/server";
import {
  fetchFontFile,
  isGoogleFontsEnabled,
  listGoogleFamilies,
  pickFileUrl,
} from "@/lib/googleFonts";

export async function GET(request: NextRequest) {
  if (!isGoogleFontsEnabled()) {
    return NextResponse.json({ error: "Google Fonts disabled" }, { status: 404 });
  }
  const family = request.nextUrl.searchParams.get("family");
  const variant = request.nextUrl.searchParams.get("variant") ?? "regular";
  if (!family) {
    return NextResponse.json({ error: "family required" }, { status: 400 });
  }
  try {
    const families = await listGoogleFamilies();
    const fam = families.find((f) => f.family === family);
    if (!fam) {
      return NextResponse.json({ error: "family not found" }, { status: 404 });
    }
    const url = pickFileUrl(fam, variant);
    if (!url) {
      return NextResponse.json({ error: "no file URL" }, { status: 404 });
    }
    const { buffer, contentType } = await fetchFontFile(url);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Font-Source-Url": url,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
