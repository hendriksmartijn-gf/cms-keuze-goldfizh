import type { NextConfig } from "next";

const parents = (process.env.ALLOWED_PARENT_ORIGINS ?? "https://www.goldfizh.nl,https://goldfizh.webflow.io")
  .split(",")
  .map((s) => s.trim())
  .join(" ");

const config: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Alleen onze eigen sites mogen de keuzehulp in een iframe tonen (clickjacking).
          { key: "Content-Security-Policy", value: `frame-ancestors 'self' ${parents}` },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/embed.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, s-maxage=3600" }],
      },
    ];
  },
};

export default config;
