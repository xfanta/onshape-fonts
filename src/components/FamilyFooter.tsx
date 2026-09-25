import { pick, type Family, type FamilyGlyph } from "@/lib/family";

/** The shared "more apps by xfanta" band at the top of the footer: every
 *  listed xfanta app, grouped (2D & 3D graphics, disk tools, Onshape
 *  add-ins, more), each with its mark and a few words. The app this site is
 *  about is shown but not linked. No hooks, so it renders from a server or a
 *  client shell alike. Same file in every product site. */
export function FamilyFooter({ family, locale, current }: { family: Family | null; locale: string; current: string }) {
  if (!family?.categories.length) return null;
  return (
    <div className="border-b border-gray-100 bg-[#fcfcfd]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">{pick(family.heading, locale)}</h2>
          <a href={family.hub.url} className="text-xs text-gray-500 hover:text-gray-900">
            {pick(family.hub.label, locale)} →
          </a>
        </div>
        <div className="mt-5 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
          {family.categories.map((c) => (
            <section key={c.id}>
              <h3 className="text-xs font-medium text-gray-900">{pick(c.label, locale)}</h3>
              <ul className="mt-3 flex flex-col gap-3">
                {c.apps.map((a) => {
                  const body = (
                    <>
                      <Mark glyph={a.glyph} />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium leading-tight text-gray-800 group-hover:text-gray-950 group-hover:underline">{a.name}</span>
                        <span className="block text-xs leading-snug text-gray-500">{pick(a.blurb, locale)}</span>
                      </span>
                    </>
                  );
                  return (
                    <li key={a.id}>
                      {a.id === current ? (
                        <span className="flex items-start gap-2.5" aria-current="page">
                          {body}
                        </span>
                      ) : (
                        <a href={a.url} className="group flex items-start gap-2.5">
                          {body}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The app's mark: the family's gradient tile with its white glyph. */
function Mark({ glyph }: { glyph: FamilyGlyph }) {
  return (
    <span
      aria-hidden
      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] p-[3px]"
      style={{ background: "linear-gradient(135deg, #F48635 0%, #ed3338 100%)" }}
    >
      <svg
        viewBox={glyph.viewBox}
        className="h-full w-full"
        fill={glyph.mode === "fill" ? "#fff" : "none"}
        stroke={glyph.mode === "stroke" ? "#fff" : undefined}
        strokeWidth={glyph.mode === "stroke" ? (glyph.strokeWidth ?? 2) : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyph.paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
    </span>
  );
}
