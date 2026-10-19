import "server-only";
import lokaal from "../data/matrix.json";
import type { Cel, Matrix } from "./types.ts";

/**
 * Bron van de matrix. Met SANITY_PROJECT_ID gezet komt de data uit Sanity
 * (gecachet, ververst via /api/revalidate); anders uit data/matrix.json.
 * Valt Sanity om, dan tonen we de lokale versie in plaats van een kapotte widget.
 */
export const MATRIX_TAG = "matrix";

const GROQ = `{
  "criteria": *[_type == "criterium"] | order(volgorde asc) { "id": slug.current, categorie, label, uitleg, gewicht },
  "cms": *[_type == "cms"] | order(volgorde asc) {
    "id": slug.current, naam, partner, minPrijs, eigenFrontend, _updatedAt,
    beoordelingen[] { "criterium": criterium->slug.current, score, tekst, bron, gecontroleerd }
  }
}`;

interface SanityCms {
  id: string;
  naam: string;
  partner: boolean;
  minPrijs: number;
  eigenFrontend: boolean;
  _updatedAt: string;
  beoordelingen?: (Cel & { criterium: string })[];
}

export async function getMatrix(): Promise<Matrix> {
  const projectId = process.env.SANITY_PROJECT_ID;
  if (!projectId) return lokaal as Matrix;

  const dataset = process.env.SANITY_DATASET ?? "production";
  const url = `https://${projectId}.apicdn.sanity.io/v2025-02-19/data/query/${dataset}?query=${encodeURIComponent(GROQ)}`;

  try {
    const res = await fetch(url, { next: { tags: [MATRIX_TAG], revalidate: 86400 } });
    if (!res.ok) throw new Error(`Sanity ${res.status}`);
    const { result } = (await res.json()) as {
      result: { criteria: Matrix["criteria"]; cms: SanityCms[] };
    };

    const cellen: Matrix["cellen"] = {};
    for (const cms of result.cms) {
      for (const { criterium, ...cel } of cms.beoordelingen ?? []) {
        (cellen[criterium] ??= {})[cms.id] = cel;
      }
    }
    const bijgewerkt = result.cms.map((c) => c._updatedAt.slice(0, 10)).sort().at(-1) ?? lokaal.bijgewerkt;

    return {
      bijgewerkt,
      criteria: result.criteria,
      cms: result.cms.map(({ id, naam, partner, minPrijs, eigenFrontend }) => ({
        id,
        naam,
        partner: !!partner,
        minPrijs: minPrijs ?? 0,
        eigenFrontend: !!eigenFrontend,
      })),
      cellen,
    };
  } catch (err) {
    console.error("Matrix uit Sanity laden mislukt, val terug op lokaal", err);
    return lokaal as Matrix;
  }
}
