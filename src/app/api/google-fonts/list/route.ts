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
      subsets: f.subsets,
    }));
    return NextResponse.json(
      { enabled: true, families: slim },
      {
        headers: {
          // CDN + browser cache 24 h. Worst case: a brand-new Google
          // font shows up to a user 24 h late. Saves ~24× lambda
          // invocations vs. the previous 1 h TTL.
          "Cache-Control":
            "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400",
        },
      },
    );
  } catch (e) {
    return NextResponse.json(
      { enabled: true, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
