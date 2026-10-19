import { NextResponse } from "next/server";
import { getMatrix } from "@/lib/data.ts";
import { blokkerendeFouten, redactiePunten } from "@/lib/webflow.ts";

/**
 * Redactiecontrole van de matrix: GET /api/controle?secret=…
 * Meldt ontbrekende "Let op"-teksten, bronnen en controledata, en claims ouder dan 180 dagen.
 * Hang er bijvoorbeeld een wekelijkse Vercel Cron of n8n-flow aan die bij punten een mail stuurt.
 */
export async function GET(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || new URL(req.url).searchParams.get("secret") !== secret) {
    return NextResponse.json({ fout: "Niet toegestaan" }, { status: 401 });
  }
  const matrix = await getMatrix();
  const blokkerend = blokkerendeFouten(matrix);
  const redactie = redactiePunten(matrix);
  return NextResponse.json(
    { bron: process.env.WEBFLOW_API_TOKEN ? "webflow" : "lokaal", bijgewerkt: matrix.bijgewerkt, blokkerend, redactie, aantal: redactie.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
