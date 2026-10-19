import { getMatrix } from "@/lib/data.ts";
import { partners } from "@/lib/toelichting.ts";

export async function GET(req: Request) {
  const { origin } = new URL(req.url);
  const matrix = await getMatrix();
  const regels = [
    "# Goldfizh CMS-keuzehulp",
    "",
    `> Vergelijking van ${matrix.cms.map((c) => c.naam).join(", ")} op ${matrix.criteria.length} criteria, met een keuzehulp die op basis van zes vragen een shortlist geeft. Bijgewerkt ${matrix.bijgewerkt}. Goldfizh is partner van ${partners(matrix)}; dat telt niet mee in de score.`,
    "",
    "## Data",
    `- [Volledige matrix en beslislogica (JSON)](${origin}/api/matrix)`,
    `- [Keuzehulp](${origin}/): een advies is deelbaar via ?keuze=<code>, één letter (a/b/c) per vraag`,
    "",
    "## Criteria",
    ...matrix.criteria.map((c) => `- ${c.label} (${c.categorie}): ${c.uitleg}`),
  ];
  return new Response(regels.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=3600" },
  });
}
