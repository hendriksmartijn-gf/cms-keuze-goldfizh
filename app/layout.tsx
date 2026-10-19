import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CMS-keuzehulp | Goldfizh",
  description:
    "Beantwoord zes vragen en krijg een onderbouwde shortlist van CMS'en: WordPress, Webflow, Contentful, Storyblok, Drupal, Sanity, Prepr en Contentstack.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
