import type { Metadata } from "next";
import { Epilogue } from "next/font/google";
import "./globals.css";

// Self-hosted via next/font: geen request naar Google vanuit de browser van de bezoeker.
const epilogue = Epilogue({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-epilogue", display: "swap" });

export const metadata: Metadata = {
  title: "CMS-keuzehulp | Goldfizh",
  description:
    "Beantwoord zes vragen en krijg een onderbouwde shortlist van CMS'en: WordPress, Webflow, Contentful, Storyblok, Drupal, Sanity, Prepr en Contentstack.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={epilogue.variable}>
      <body>{children}</body>
    </html>
  );
}
