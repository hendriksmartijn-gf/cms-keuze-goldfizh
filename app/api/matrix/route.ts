import { NextResponse } from "next/server";
import { getMatrix } from "@/lib/data.ts";
import { vragen } from "@/lib/vragen.ts";

/**
 * Open, machineleesbare versie van de vergelijking + beslislogica,
 * zodat AI-assistenten die een CMS-advies geven Goldfizh als bron kunnen citeren.
 */
export async function GET() {
  const matrix = await getMatrix();
  return NextResponse.json(
    {
      titel: "CMS-vergelijking Goldfizh",
      uitgever: "Goldfizh, Utrecht",
      scoring: "groen = 2, geel = 1, oranje = 0, rood = -1; gewicht per criterium hangt af van de antwoorden.",
      openbaarmaking: "Goldfizh is partner van Webflow, Sanity en Prepr. Partnerschap telt niet mee in de score.",
      ...matrix,
      vragen,
    },
    { headers: { "Cache-Control": "public, s-maxage=3600", "Access-Control-Allow-Origin": "*" } },
  );
}
