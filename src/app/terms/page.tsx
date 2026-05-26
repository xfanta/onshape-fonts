import { SiteShell } from "@/components/SiteShell";

export const metadata = {
  title: "Terms — Google Fonts for Onshape",
  description: "Terms of use for the Google Fonts for Onshape add-in.",
};

export default function TermsPage() {
  return (
    <SiteShell>
    <div className="mx-auto max-w-3xl px-6 py-16 text-[15px] leading-relaxed text-gray-800">
      <h1 className="text-4xl font-semibold tracking-tight text-gray-900">
        Terms of use
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Last updated: 26 May 2026
      </p>

      <section className="mt-8 space-y-4">
        <p>
          <strong>Google Fonts for Onshape</strong> (&quot;the add-in&quot;)
          is an open-source project distributed free of charge. Source code:{" "}
          <a
            className="text-[#ed3338] underline"
            href="https://github.com/xfanta/onshape-fonts"
            target="_blank"
            rel="noreferrer"
          >
            github.com/xfanta/onshape-fonts
          </a>
          .
        </p>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">License</h2>
        <p>
          Source code is available under the{" "}
          <a
            className="text-[#ed3338] underline"
            href="https://polyformproject.org/licenses/noncommercial/1.0.0/"
            target="_blank"
            rel="noreferrer"
          >
            PolyForm Noncommercial License 1.0.0
          </a>
          . You may read, fork, study, modify, and redistribute the code
          for any <strong>noncommercial</strong> purpose — personal
          projects, learning, research, public-sector use, or other
          open-source work. Selling, hosting as a paid service, or
          embedding the code in any commercial product is{" "}
          <strong>not permitted</strong> under this license. The full
          text lives in{" "}
          <a
            className="text-[#ed3338] underline"
            href="https://github.com/xfanta/onshape-fonts/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
          >
            LICENSE
          </a>{" "}
          in the repository. For commercial licensing, open a GitHub
          issue.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          No warranty
        </h2>
        <p>
          The add-in is provided <strong>&quot;as is&quot;</strong>, without
          warranty of any kind, express or implied, including but not
          limited to the warranties of merchantability, fitness for a
          particular purpose, and non-infringement. The authors are not
          liable for any claim, damages, or other liability arising from
          the use of the add-in — including any loss of geometry, document
          corruption, or downtime in Onshape.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          Third-party services
        </h2>
        <p>
          The add-in talks to Onshape and Google Fonts. Your use of those
          services is governed by their own terms — see{" "}
          <a
            className="text-[#ed3338] underline"
            href="https://www.onshape.com/en/legal/terms-of-use"
            target="_blank"
            rel="noreferrer"
          >
            Onshape Terms
          </a>{" "}
          and{" "}
          <a
            className="text-[#ed3338] underline"
            href="https://policies.google.com/terms"
            target="_blank"
            rel="noreferrer"
          >
            Google Terms
          </a>
          .
        </p>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          Acceptable use
        </h2>
        <p>
          Don&apos;t abuse the hosted backend (rate-limit floods, attempts
          to extract other users&apos; tokens, etc.). If you need higher
          throughput or want to deploy your own copy, fork the repo and run
          it yourself — instructions in the README.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          Changes
        </h2>
        <p>
          These terms may be updated over time. Material changes will be
          announced via the project&apos;s GitHub releases.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-gray-900">
          Contact
        </h2>
        <p>
          Questions: open an issue or discussion on{" "}
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
    </div>
    </SiteShell>
  );
}
