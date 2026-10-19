import "server-only";
import lokaal from "../data/matrix.json";
import type { Matrix } from "./types.ts";
import { blokkerendeFouten, naarMatrix, type WebflowCollectie, type WebflowItem, type WebflowVeld } from "./webflow.ts";

/**
 * Bron van de matrix. Met WEBFLOW_API_TOKEN en de drie collectie-ID's gezet komt de data
 * uit Webflow CMS (alleen gepubliceerde items, gecachet, ververst via /api/revalidate);
 * anders uit data/matrix.json. Is Webflow onbereikbaar of de data onvolledig, dan tonen
 * we de lokale versie in plaats van een kapotte widget.
 */
export const MATRIX_TAG = "matrix";

const API = process.env.WEBFLOW_API_BASE ?? "https://api.webflow.com/v2";
const CACHE: RequestInit = { next: { tags: [MATRIX_TAG], revalidate: 86400 } };

function config() {
  const token = process.env.WEBFLOW_API_TOKEN;
  const ids = {
    criteria: process.env.WEBFLOW_COLLECTIE_CRITERIA,
    cms: process.env.WEBFLOW_COLLECTIE_CMS,
    beoordelingen: process.env.WEBFLOW_COLLECTIE_BEOORDELINGEN,
  };
  if (!token || !ids.criteria || !ids.cms || !ids.beoordelingen) return null;
  return { token, ids: ids as Record<keyof typeof ids, string> };
}

async function haal<T>(pad: string, token: string): Promise<T> {
  const res = await fetch(`${API}${pad}`, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" }, ...CACHE });
  if (!res.ok) throw new Error(`Webflow ${res.status} op ${pad}`);
  return res.json() as Promise<T>;
}

async function collectie(id: string, token: string): Promise<WebflowCollectie> {
  const { fields } = await haal<{ fields: WebflowVeld[] }>(`/collections/${id}`, token);
  const items: WebflowItem[] = [];
  for (let offset = 0; ; offset += 100) {
    const pagina = await haal<{ items: WebflowItem[]; pagination: { total: number } }>(
      `/collections/${id}/items/live?limit=100&offset=${offset}`,
      token,
    );
    items.push(...pagina.items);
    if (items.length >= pagina.pagination.total || !pagina.items.length) break;
  }
  return { fields, items };
}

export async function getMatrix(): Promise<Matrix> {
  const cfg = config();
  if (!cfg) return lokaal as Matrix;

  try {
    const [criteria, cms, beoordelingen] = await Promise.all([
      collectie(cfg.ids.criteria, cfg.token),
      collectie(cfg.ids.cms, cfg.token),
      collectie(cfg.ids.beoordelingen, cfg.token),
    ]);
    const matrix = naarMatrix({ criteria, cms, beoordelingen });
    const fouten = blokkerendeFouten(matrix);
    if (fouten.length) throw new Error(`Matrix onvolledig: ${fouten.slice(0, 5).join("; ")}`);
    return matrix;
  } catch (err) {
    console.error("Matrix uit Webflow laden mislukt, val terug op lokaal:", err instanceof Error ? err.message : err);
    return lokaal as Matrix;
  }
}
