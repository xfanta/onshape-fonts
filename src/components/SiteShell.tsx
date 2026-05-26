import Link from "next/link";

/** Sticky header + footer with a max-w-7xl content rail. Pages render
 *  their body inside; the footer self-pushes to the viewport bottom
 *  when content is short (relies on the root <body> being flex-col). */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}

const GRADIENT =
  "linear-gradient(135deg, #F48635 0%, #ed3338 100%)";
const APPSTORE_URL =
  "https://cad.onshape.com/appstore/apps/Utilities/6a0f2d2039092b5cfc0f712a";

function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md p-[5px]"
            style={{ background: GRADIENT }}
            aria-hidden
          >
            <svg viewBox="0 0 640 640" className="h-full w-full" fill="#fff">
              <path d="M200 64C213.3 64 224 74.7 224 88L224 144L360 144C373.3 144 384 154.7 384 168C384 181.3 373.3 192 360 192L343.8 192L327.3 230.4C308.7 273.9 282.1 313.2 249.4 346.4C263.3 355.6 278 363.8 293.4 370.8L354.3 398.7L426.1 238.2C430 229.6 438.5 224 448 224C457.5 224 466 229.6 469.9 238.2L605.9 542.2C611.3 554.3 605.9 568.5 593.8 573.9C581.7 579.3 567.5 573.9 562.1 561.8L532.7 496L363.4 496L334 561.8C328.6 573.9 314.4 579.3 302.3 573.9C290.2 568.5 284.8 554.3 290.2 542.2L334.8 442.5L273.5 414.4C252 404.5 231.6 392.7 212.6 379.2C195.1 392.8 176.3 404.9 156.4 415.3L99.1 445.3C87.4 451.5 72.9 446.9 66.7 435.2C60.5 423.5 65.1 409 76.8 402.8L134 372.8C148 365.5 161.4 357.1 174.1 348C146.6 322.4 123 292.8 104.1 260C97.5 248.5 101.4 233.8 112.9 227.2C124.4 220.6 139.1 224.5 145.7 236C163.1 266.3 185.2 293.5 211.1 316.7C241.6 286.9 266.2 251.2 283.3 211.4L291.6 192L56 192C42.7 192 32 181.3 32 168C32 154.7 42.8 144 56 144L176 144L176 88C176 74.7 186.7 64 200 64zM511.2 448L448 306.8L384.8 448L511.2 448z" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-gray-900">
            Google Fonts{" "}
            <span className="opacity-60">for Onshape</span>
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-gray-600">
          <Link href="/#features" className="hidden hover:text-gray-900 sm:block">
            Features
          </Link>
          <Link href="/#demo" className="hidden hover:text-gray-900 sm:block">
            Demo
          </Link>
          <Link href="/#pricing" className="hidden hover:text-gray-900 sm:block">
            Pricing
          </Link>
          <Link href="/preview" className="hover:text-gray-900">
            Preview
          </Link>
          <a
            className="hidden hover:text-gray-900 md:block"
            href="https://github.com/xfanta/onshape-fonts"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a
            href={APPSTORE_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
            style={{ background: GRADIENT }}
          >
            Add to Onshape
          </a>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-gray-200">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-gray-500">
        <span>© 2026 · Free &amp; open source</span>
        <div className="flex gap-5">
          <Link href="/privacy" className="hover:text-gray-900">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-gray-900">
            Terms
          </Link>
          <a
            href="https://github.com/xfanta/onshape-fonts/issues"
            target="_blank"
            rel="noreferrer"
            className="hover:text-gray-900"
          >
            Support
          </a>
          <a
            href="https://github.com/xfanta/onshape-fonts"
            target="_blank"
            rel="noreferrer"
            className="hover:text-gray-900"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
