import type { Cel, Cms, KnockOut, Matrix, Score, Vraag } from "./types.ts";

const PUNTEN: Record<Exclude<Score, "info">, number> = { groen: 2, geel: 1, oranje: 0, rood: -1 };
const VOLGORDE: Score[] = ["rood", "oranje", "geel", "groen"];
const LETTERS = "abcdefghij";

/** Antwoordindexen <-> deelcode, bijv. [0,2,1] <-> "acb". */
export function naarCode(keuzes: number[]): string {
  return keuzes.map((i) => LETTERS[i]).join("");
}

export function vanCode(code: string | undefined | null, vragen: Vraag[]): number[] | null {
  if (!code || code.length !== vragen.length) return null;
  const keuzes = [...code].map((c) => LETTERS.indexOf(c));
  return keuzes.every((k, i) => k >= 0 && k < vragen[i].antwoorden.length) ? keuzes : null;
}

export interface Reden {
  criterium: string;
  label: string;
  tekst: string;
  /** Uitleg in gewone taal voor als dit het aandachtspunt is. */
  letOp?: string;
  score: Score;
  /** Het antwoord dat dit criterium zwaar liet wegen, voor "omdat je aangaf…". */
  omdat?: string;
}

export interface Uitslag {
  cms: Cms;
  /** 0–100: behaalde punten t.o.v. het maximum bij jouw gewichten. */
  match: number;
  sterk: Reden[];
  letOp: Reden | null;
  /** Per meewegend criterium: punten (-1..2) en jouw gewicht. Basis voor vergelijkingen. */
  scores: Record<string, { punten: number; gewicht: number }>;
}

export interface Afgevallen {
  cms: Cms;
  redenen: string[];
}

export interface Resultaat {
  ranking: Uitslag[];
  afgevallen: Afgevallen[];
}

function valtAf(ko: KnockOut, cms: Cms, matrix: Matrix): boolean {
  switch (ko.type) {
    case "prijs":
      return cms.minPrijs > ko.max;
    case "eigenFrontend":
      return cms.eigenFrontend;
    case "criterium": {
      const score = matrix.cellen[ko.criterium]?.[cms.id]?.score;
      return !!score && score !== "info" && VOLGORDE.indexOf(score) <= VOLGORDE.indexOf(ko.maxScore);
    }
  }
}

export function bereken(matrix: Matrix, vragen: Vraag[], keuzes: number[]): Resultaat {
  const gewichten: Record<string, number> = {};
  const omdat: Record<string, { label: string; extra: number }> = {};
  for (const c of matrix.criteria) gewichten[c.id] = c.gewicht;

  const knockOuts: KnockOut[] = [];
  keuzes.forEach((k, i) => {
    const antwoord = vragen[i].antwoorden[k];
    for (const [id, extra] of Object.entries(antwoord.gewichten ?? {})) {
      gewichten[id] = (gewichten[id] ?? 0) + extra;
      if (!omdat[id] || extra > omdat[id].extra) omdat[id] = { label: antwoord.label, extra };
    }
    knockOuts.push(...(antwoord.knockOuts ?? []));
  });

  const ranking: Uitslag[] = [];
  const afgevallen: Afgevallen[] = [];

  for (const cms of matrix.cms) {
    const redenen = knockOuts.filter((ko) => valtAf(ko, cms, matrix)).map((ko) => ko.reden);
    if (redenen.length) {
      afgevallen.push({ cms, redenen: [...new Set(redenen)] });
      continue;
    }

    let behaald = 0;
    let maximum = 0;
    const bijdragen: (Reden & { gewicht: number; punten: number })[] = [];
    for (const crit of matrix.criteria) {
      const cel: Cel | undefined = matrix.cellen[crit.id]?.[cms.id];
      const gewicht = gewichten[crit.id] ?? 0;
      if (!cel || cel.score === "info" || gewicht <= 0) continue;
      const punten = PUNTEN[cel.score];
      behaald += gewicht * punten;
      maximum += gewicht * PUNTEN.groen;
      bijdragen.push({
        criterium: crit.id,
        label: crit.label,
        tekst: cel.tekst,
        letOp: cel.letOp,
        score: cel.score,
        omdat: omdat[crit.id]?.label,
        gewicht,
        punten,
      });
    }

    const zwaarsteEerst = [...bijdragen].sort((a, b) => b.gewicht - a.gewicht);
    const sterk = zwaarsteEerst.filter((b) => b.punten === 2).slice(0, 3);
    const letOp =
      zwaarsteEerst.find((b) => b.punten <= 0) ?? zwaarsteEerst.find((b) => b.punten === 1) ?? null;

    ranking.push({
      cms,
      match: maximum ? Math.max(0, Math.round((100 * behaald) / maximum)) : 0,
      sterk: sterk.map(stripIntern),
      letOp: letOp ? stripIntern(letOp) : null,
      scores: Object.fromEntries(bijdragen.map((b) => [b.criterium, { punten: b.punten, gewicht: b.gewicht }])),
    });
  }

  ranking.sort((a, b) => b.match - a.match || a.cms.naam.localeCompare(b.cms.naam));
  return { ranking, afgevallen };
}

function stripIntern({ criterium, label, tekst, letOp, score, omdat }: Reden): Reden {
  return { criterium, label, tekst, letOp, score, omdat };
}
