// Zet data/matrix.json om naar NDJSON voor `sanity dataset import`.
import { readFileSync } from "node:fs";
import type { Matrix } from "../lib/types.ts";

const matrix: Matrix = JSON.parse(readFileSync(new URL("../data/matrix.json", import.meta.url), "utf8"));
const regels: object[] = [];

matrix.criteria.forEach((c, i) => {
  regels.push({
    _id: `criterium-${c.id}`,
    _type: "criterium",
    label: c.label,
    slug: { _type: "slug", current: c.id },
    categorie: c.categorie,
    uitleg: c.uitleg,
    gewicht: c.gewicht,
    volgorde: i,
  });
});

matrix.cms.forEach((cms, i) => {
  regels.push({
    _id: `cms-${cms.id}`,
    _type: "cms",
    naam: cms.naam,
    slug: { _type: "slug", current: cms.id },
    partner: cms.partner,
    minPrijs: cms.minPrijs,
    eigenFrontend: cms.eigenFrontend,
    volgorde: i,
    beoordelingen: matrix.criteria
      .filter((c) => matrix.cellen[c.id]?.[cms.id])
      .map((c) => {
        const cel = matrix.cellen[c.id][cms.id];
        return {
          _key: c.id,
          _type: "beoordeling",
          criterium: { _type: "reference", _ref: `criterium-${c.id}` },
          score: cel.score,
          tekst: cel.tekst,
          ...(cel.bron ? { bron: cel.bron } : {}),
          gecontroleerd: cel.gecontroleerd ?? matrix.bijgewerkt,
        };
      }),
  });
});

process.stdout.write(regels.map((r) => JSON.stringify(r)).join("\n") + "\n");
