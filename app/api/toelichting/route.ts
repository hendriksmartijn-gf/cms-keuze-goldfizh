import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { getMatrix, MATRIX_TAG } from "@/lib/data.ts";
import { genereerToelichting, llmBeschikbaar, PROMPT_VERSIE } from "@/lib/llm.ts";
import { bereken, vanCode } from "@/lib/scoring.ts";
import { feitenVoorLlm } from "@/lib/toelichting.ts";
import { vragen } from "@/lib/vragen.ts";

/**
 * Gegenereerde toelichting voor een deelcode. Er zijn maar 729 combinaties, dus
 * elke combinatie wordt hooguit één keer gegenereerd en daarna uit de cache geserveerd
 * (tot de matrix of de prompt verandert). Mislukt het, dan houdt de widget de basistekst.
 */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("keuze") ?? "";
  const keuzes = vanCode(code, vragen);
  if (!keuzes) return NextResponse.json({ fout: "Ongeldige keuze" }, { status: 400 });
  if (!llmBeschikbaar()) return NextResponse.json({ fout: "Niet geconfigureerd" }, { status: 404 });

  const matrix = await getMatrix();
  const top = bereken(matrix, vragen, keuzes).top;

  const gecachet = unstable_cache(
    () => genereerToelichting(feitenVoorLlm(top, matrix, vragen, keuzes)),
    ["toelichting", PROMPT_VERSIE, matrix.bijgewerkt, code],
    { tags: [MATRIX_TAG, "toelichting"] },
  );

  try {
    return NextResponse.json(
      { toelichtingen: await gecachet() },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (err) {
    console.error("[toelichting] genereren mislukt", code, err instanceof Error ? err.message : err);
    return NextResponse.json({ fout: "Niet beschikbaar" }, { status: 503 });
  }
}
