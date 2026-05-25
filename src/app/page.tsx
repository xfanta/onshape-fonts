import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F48635] text-white">
      {/* Background gradient + subtle texture */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #F48635 0%, #f15a2c 45%, #ed3338 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(0,0,0,0.25) 0%, transparent 50%)",
        }}
      />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="text-lg font-semibold tracking-tight">
          Google Fonts <span className="opacity-70">for Onshape</span>
        </div>
        <nav className="flex items-center gap-5 text-sm">
          <a
            className="opacity-80 hover:opacity-100"
            href="https://github.com/xfanta/onshape-fonts"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <Link
            href="/preview"
            className="opacity-80 hover:opacity-100"
          >
            Standalone preview
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto flex max-w-6xl flex-col items-start gap-10 px-6 py-16 sm:py-24">
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wider backdrop-blur">
          Onshape integrated app
        </span>

        <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Any Google Font.
          <br />
          Native sketch geometry.
        </h1>

        <p className="max-w-2xl text-lg leading-relaxed text-white/90 sm:text-xl">
          Browse 1900+ Google Fonts, pick a weight and style, then insert text
          into a Part Studio as an editable sketch feature. Resize, rotate, or
          move the text anytime — it&apos;s real Onshape geometry, not a frozen
          DXF.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <a
            href="https://appstore.onshape.com/"
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-white px-6 py-3 text-base font-semibold text-[#ed3338] shadow-lg shadow-black/10 transition hover:bg-white/95"
          >
            Install on Onshape
          </a>
          <Link
            href="/preview"
            className="rounded-md border border-white/40 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            Try standalone preview
          </Link>
        </div>

        {/* Feature highlights */}
        <ul className="mt-12 grid w-full gap-6 sm:grid-cols-3">
          <Feature
            title="1900+ Google Fonts"
            body="Search by name, filter by category and subset. Weights and italics handled automatically."
          />
          <Feature
            title="Editable in Onshape"
            body="Em-height, rotation, origin, and offset are real feature parameters — tweak them like any other Onshape feature."
          />
          <Feature
            title="Custom .ttf / .otf"
            body="Got a brand font? Drop in any TrueType or OpenType file and use it the same way."
          />
        </ul>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mx-auto max-w-6xl border-t border-white/15 px-6 py-6 text-xs text-white/70">
        Open source ·{" "}
        <a
          className="underline-offset-2 hover:underline"
          href="https://github.com/xfanta/onshape-fonts"
          target="_blank"
          rel="noreferrer"
        >
          github.com/xfanta/onshape-fonts
        </a>
      </footer>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <li className="rounded-lg border border-white/20 bg-white/5 p-5 backdrop-blur-sm">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-white/85">{body}</p>
    </li>
  );
}
