import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Playfair Display, italic 500 only — the gradient emphasis word in each
// hero. Through next/font rather than a Google Fonts <link>: self-hosted,
// preloaded, and no render-blocking request to another origin (~750 ms on
// a phone in Lighthouse). latin-ext carries Czech and the other accented
// locales.
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
  style: "italic",
  weight: "500",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://onshape-fonts.vercel.app"),
  title: "Google Fonts for Onshape — text as native sketch curves",
  description:
    "Free Onshape add-in: 1,900+ Google Fonts or your own .ttf/.otf, inserted on the active sketch plane as native curves you can resize and move anytime.",
  authors: [{ name: "Michal Fanta" }],
  openGraph: {
    type: "website",
    siteName: "Google Fonts for Onshape",
    title: "Google Fonts for Onshape — type that turns into real geometry",
    description:
      "Free Onshape add-in: 1,900+ Google Fonts or your own .ttf/.otf, inserted on the active sketch plane as native curves you can resize and move anytime.",
    url: "/",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Google Fonts for Onshape — an Onshape add-in that inserts text in any Google Font as native sketch curves." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Google Fonts for Onshape — type that turns into real geometry",
    description:
      "Free Onshape add-in: 1,900+ Google Fonts or your own .ttf/.otf, inserted on the active sketch plane as native curves you can resize and move anytime.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
