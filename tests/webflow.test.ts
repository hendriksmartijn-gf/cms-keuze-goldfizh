import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blokkerendeFouten, COLLECTIES, naarMatrix, redactiePunten, veldSlug, type WebflowCollectie } from "../lib/webflow.ts";
import type { Matrix } from "../lib/types.ts";

const lokaal: Matrix = JSON.parse(readFileSync(new URL("../data/matrix.json", import.meta.url), "utf8"));

// Bouwt Webflow-API-data na zoals scripts/import-webflow.ts die aanmaakt.
function alsWebflow(m: Matrix): Record<"criteria" | "cms" | "beoordelingen", WebflowCollectie> {
  const opties = (namen: readonly string[]) => namen.map((name) => ({ id: `opt-${name}`, name }));
  const velden = (k: keyof typeof COLLECTIES) =>
    Object.values(COLLECTIES[k].velden).map((v) => ({
      slug: veldSlug(v.displayName),
      type: v.type,
      validations: "options" in v ? { options: opties(v.options) } : null,
    }));
  const s = (n: string) => veldSlug(n);
  return {
    criteria: {
      fields: velden("criteria"),
      items: m.criteria.map((c, i) => ({
        id: `crit-${c.id}`,
        fieldData: { name: c.label, slug: s(c.id), sleutel: c.id, categorie: `opt-${c.categorie}`, uitleg: c.uitleg, "in-een-zin": c.inZin, gewicht: c.gewicht, volgorde: i + 1 },
      })).reverse(),
    },
    cms: {
      fields: velden("cms"),
      items: m.cms.map((c, i) => ({
        id: `cms-${c.id}`,
        lastUpdated: "2026-10-20T08:00:00.000Z",
        fieldData: { name: c.naam, slug: c.id, "wat-is-het": c.wat, "past-bij": c.pastBij, "goldfizh-partner": c.partner, "minimale-prijs": c.minPrijs, "eigen-frontend-nodig": c.eigenFrontend, volgorde: i + 1 },
      })),
    },
    beoordelingen: {
      fields: velden("beoordelingen"),
      items: m.criteria.flatMap((c) =>
        m.cms.map((x) => {
          const cel = m.cellen[c.id][x.id];
          return {
            id: `b-${x.id}-${c.id}`,
            fieldData: { name: "", slug: "", cms: `cms-${x.id}`, criterium: `crit-${c.id}`, score: `opt-${cel.score}`, "korte-tekst": cel.tekst, ...(cel.letOp ? { "let-op": cel.letOp } : {}), "gecontroleerd-op": "2026-01-01T00:00:00.000Z" },
          };
        }),
      ),
    },
  };
}

test("veld-slugs volgen Webflow's afleiding", () => {
  assert.equal(veldSlug("Eigen frontend nodig"), "eigen-frontend-nodig");
  assert.equal(veldSlug("Goldfizh-partner"), "goldfizh-partner");
  assert.equal(veldSlug("In een zin"), "in-een-zin");
});

test("Webflow-data wordt exact dezelfde matrix, in de ingestelde volgorde", () => {
  const m = naarMatrix(alsWebflow(lokaal));
  assert.deepEqual(m.cms, lokaal.cms);
  assert.deepEqual(m.criteria, lokaal.criteria);
  for (const c of lokaal.criteria)
    for (const x of lokaal.cms) {
      const { gecontroleerd, ...cel } = m.cellen[c.id][x.id];
      assert.deepEqual(cel, lokaal.cellen[c.id][x.id]);
      assert.equal(gecontroleerd, "2026-01-01");
    }
  assert.equal(m.bijgewerkt, "2026-10-20");
  assert.deepEqual(blokkerendeFouten(m), []);
});

test("ontbrekende beoordeling is blokkerend, ontbrekende let op en verouderde controle zijn redactiepunten", () => {
  const data = alsWebflow(lokaal);
  data.beoordelingen.items = data.beoordelingen.items.filter((i) => i.id !== "b-webflow-otap");
  const otapWp = data.beoordelingen.items.find((i) => i.id === "b-wordpress-otap")!;
  delete otapWp.fieldData["let-op"];
  const m = naarMatrix(data);
  assert.ok(blokkerendeFouten(m).some((f) => f.includes("Webflow / OTAP")));
  const punten = redactiePunten(m, new Date("2026-10-20"));
  assert.ok(punten.some((p) => p.startsWith("WordPress / OTAP") && p.includes("Let op")));
  assert.ok(punten.some((p) => p.includes("langer dan 180 dagen")));
});
