import type { Uitslag } from "./scoring.ts";
import type { Matrix, Vraag } from "./types.ts";

/**
 * Toelichting per CMS in de top 3.
 * - basisToelichting: deterministisch, direct beschikbaar, altijd waar (alleen matrixdata).
 * - feitenVoorLlm: dezelfde feiten als input voor de gegenereerde, persoonlijkere tekst.
 */

export type Toelichtingen = Record<string, string>;

const MAX_PUNTEN = 3;

function opsomming(delen: string[]): string {
  if (delen.length <= 1) return delen[0] ?? "";
  return `${delen.slice(0, -1).join(", ")} en ${delen.at(-1)}`;
}

/** Criteria waarop `cms` beter scoort dan `ref`, zwaarst wegend eerst. */
export function beterDan(cms: Uitslag, ref: Uitslag): string[] {
  return Object.entries(cms.scores)
    .map(([id, s]) => ({ id, verschil: s.punten - (ref.scores[id]?.punten ?? 0), gewicht: s.gewicht }))
    .filter((v) => v.verschil > 0)
    .sort((a, b) => b.gewicht * b.verschil - a.gewicht * a.verschil)
    .map((v) => v.id);
}

export function basisToelichting(top: Uitslag[], matrix: Matrix): Toelichtingen {
  const inZin = (id: string) => matrix.criteria.find((c) => c.id === id)?.inZin ?? id;
  const [eerste] = top;
  const uit: Toelichtingen = {};

  top.forEach((u, i) => {
    const { naam, wat, pastBij } = u.cms;
    if (i === 0) {
      const sterk = u.sterk.slice(0, MAX_PUNTEN).map((r) => inZin(r.criterium));
      uit[u.cms.id] =
        `${wat} ${naam} past bij ${pastBij}` +
        (sterk.length ? ` In jouw situatie wegen ${opsomming(sterk)} zwaar, en daar is ${naam} sterk in.` : "");
      return;
    }
    const beter = beterDan(u, eerste).slice(0, MAX_PUNTEN).map(inZin);
    if (u.buitenEisen) {
      uit[u.cms.id] =
        `${wat} Blijkt die eis minder hard, dan is ${naam} het overwegen waard` +
        (beter.length ? `: het is sterker in ${opsomming(beter)}.` : `. Het past bij ${pastBij}`);
      return;
    }
    uit[u.cms.id] = beter.length
      ? `${wat} Kies ${naam} boven ${eerste.cms.naam} als je meer nadruk wilt leggen op ${opsomming(beter)}.`
      : `${wat} Het scoort op jouw belangrijkste punten vergelijkbaar met of iets lager dan ${eerste.cms.naam}. ${naam} past bij ${pastBij}`;
  });
  return uit;
}

/** Alleen feiten uit de matrix en de antwoorden; geen partnerstatus (mag de tekst niet kleuren). */
export function feitenVoorLlm(top: Uitslag[], matrix: Matrix, vragen: Vraag[], keuzes: number[]) {
  const crit = (id: string) => matrix.criteria.find((c) => c.id === id)!;
  const cel = (critId: string, cmsId: string) => matrix.cellen[critId]?.[cmsId]?.tekst ?? "";
  const [eerste] = top;

  return {
    situatie: vragen.map((v, i) => ({ vraag: v.vraag, antwoord: v.antwoorden[keuzes[i]].label })),
    advies: top.map((u, i) => ({
      id: u.cms.id,
      positie: i + 1,
      naam: u.cms.naam,
      watHetIs: u.cms.wat,
      pastBij: u.cms.pastBij,
      architectuur: cel("architectuur", u.cms.id),
      sterkVoorJou: u.sterk.map((r) => ({ onderwerp: crit(r.criterium).inZin, feit: r.tekst })),
      aandachtspunt: u.letOp ? { onderwerp: crit(u.letOp.criterium).inZin, feit: u.letOp.tekst } : null,
      ...(u.buitenEisen ? { haaltEisNiet: u.buitenEisen.map((r) => `${u.cms.naam} ${r}`) } : {}),
      ...(i > 0
        ? {
            beterDanNummer1Op: beterDan(u, eerste)
              .slice(0, MAX_PUNTEN)
              .map((id) => ({ onderwerp: crit(id).inZin, feit: cel(id, u.cms.id), nummer1: cel(id, eerste.cms.id) })),
          }
        : {}),
    })),
  };
}
