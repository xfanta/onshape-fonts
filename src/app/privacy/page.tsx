import Link from "next/link";

export const metadata = {
  title: "Privacy — Google Fonts for Onshape",
  description: "What data this Onshape add-in collects and how it's used.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-800">
    <main className="mx-auto max-w-3xl px-6 py-16 text-[15px] leading-relaxed">
      <Link href="/" className="text-sm text-[#ed3338] hover:underline">
        ← Back
      </Link>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight text-gray-900">
        Privacy
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Last updated: 26 May 2026
      </p>

      <section className="mt-8 space-y-4">
        <p>
          <strong>Google Fonts for Onshape</strong> is a free, open-source
          add-in. It runs as an iframe panel inside an Onshape Part Studio
          and as a backend deployed on Vercel. This page describes what data
          flows through it and where it is stored.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          What we collect
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Your Onshape user ID</strong> — supplied by Onshape when
            you open the panel. Used as the key for your OAuth token.
          </li>
          <li>
            <strong>An Onshape OAuth access &amp; refresh token</strong> —
            issued by Onshape after you click <em>Sign in via OAuth</em>.
            Stored in Vercel KV (Upstash Redis). The token lets the backend
            call the Onshape REST API on your behalf to create the
            <em>Text to Sketch</em> feature in your active Part Studio.
          </li>
          <li>
            <strong>The document context</strong> you have open
            (documentId, workspaceId, elementId) — passed in the iframe URL
            by Onshape and only used at request time to target the correct
            Part Studio. Not stored.
          </li>
          <li>
            <strong>The text you type and the font you pick</strong> —
            converted in your browser into curves and sent to Onshape as
            feature parameters. Not stored on our side.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          What we do <em>not</em> collect
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>No analytics, no third-party trackers, no cookies beyond a
            signed session cookie for the OAuth state.</li>
          <li>No content of your documents beyond what you explicitly
            insert.</li>
          <li>No marketing emails — we don&apos;t collect your email at
            all.</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          Third parties
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Onshape</strong> — REST API calls when you insert a
            text feature.
          </li>
          <li>
            <strong>Google Fonts Developer API</strong> — we fetch the
            font catalog and the .ttf files server-side and proxy them to
            your browser. No personal data is sent to Google.
          </li>
          <li>
            <strong>Vercel &amp; Upstash</strong> — host the app and store
            OAuth tokens.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          Retention &amp; deletion
        </h2>
        <p>
          OAuth tokens live in Vercel KV until you uninstall the app from
          Onshape (which revokes the token) or until you ask for deletion.
          To request manual deletion, open an issue at{" "}
          <a
            className="text-[#ed3338] underline"
            href="https://github.com/xfanta/onshape-fonts/issues"
            target="_blank"
            rel="noreferrer"
          >
            github.com/xfanta/onshape-fonts/issues
          </a>
          .
        </p>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          Contact
        </h2>
        <p>
          Questions or concerns: open an issue or discussion on{" "}
          <a
            className="text-[#ed3338] underline"
            href="https://github.com/xfanta/onshape-fonts"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          .
        </p>
      </section>
    </main>
    </div>
  );
}
