import { NextResponse } from "next/server";
import {
  isGoogleFontsEnabled,
  listGoogleFamilies,
} from "@/lib/googleFonts";

export async function GET() {
  if (!isGoogleFontsEnabled()) {
    return NextResponse.json({ enabled: false, families: [] });
  }
  try {
    const families = await listGoogleFamilies();
    const slim = families.map((f) => ({
      family: f.family,
      category: f.category,
      variants: f.variants,
    }));
    return NextResponse.json(
      { enabled: true, families: slim },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch (e) {
    return NextResponse.json(
      { enabled: true, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
