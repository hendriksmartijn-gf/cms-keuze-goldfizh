import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bereken, naarCode, vanCode } from "../lib/scoring.ts";
import { vragen } from "../lib/vragen.ts";
import type { Matrix } from "../lib/types.ts";

const matrix: Matrix = JSON.parse(readFileSync(new URL("../data/matrix.json", import.meta.url), "utf8"));
const ids = (code: string) => {
  const r = bereken(matrix, vragen, vanCode(code, vragen)!);
  return { top: r.ranking.map((u) => u.cms.id), af: r.afgevallen.map((a) => a.cms.id), r };
};

test("deelcode heen en terug", () => {
  assert.equal(naarCode([0, 2, 1, 0, 1, 2]), "acbabc");
  assert.deepEqual(vanCode("acbabc", vragen), [0, 2, 1, 0, 1, 2]);
  assert.equal(vanCode("acbab", vragen), null);
  assert.equal(vanCode("acbabz", vragen), null);
  assert.equal(vanCode("dddddd", vragen), null);
});

test("matrix is compleet: elke cel voor elk CMS", () => {
  for (const c of matrix.criteria) for (const cms of matrix.cms) assert.ok(matrix.cellen[c.id]?.[cms.id], `${c.id}/${cms.id}`);
});

test("zonder developers blijven alleen niet-headless, bouwbare opties over", () => {
  const { top, af } = ids("aaaaaa");
  assert.deepEqual(new Set(top), new Set(["wordpress", "webflow"]));
  assert.ok(af.includes("drupal") && af.includes("prepr"));
});

test("elk zwak punt heeft een let-op-tekst in gewone taal", () => {
  for (const c of matrix.criteria)
    for (const cms of matrix.cms) {
      const cel = matrix.cellen[c.id][cms.id];
      if (["geel", "oranje", "rood"].includes(cel.score)) assert.ok(cel.letOp && cel.letOp.length > 30, `${c.id}/${cms.id}`);
    }
});

test("harde EU-eis sluit VS-leveranciers uit", () => {
  const { top, af } = ids("bcccbc");
  for (const id of ["webflow", "contentful", "sanity", "contentstack"]) assert.ok(af.includes(id), id);
  assert.ok(top.includes("prepr") && top.includes("storyblok"));
});

test("budget tot €500 sluit Contentstack uit", () => {
  assert.ok(ids("bbbaba").af.includes("contentstack"));
});

test("partnerstatus beïnvloedt de score niet", () => {
  const zonder = structuredClone(matrix);
  zonder.cms.forEach((c) => (c.partner = false));
  for (const code of ["aaaaaa", "bbbbbb", "cccccc", "bccbbc", "acaacb"]) {
    const a = bereken(matrix, vragen, vanCode(code, vragen)!).ranking.map((u) => [u.cms.id, u.match]);
    const b = bereken(zonder, vragen, vanCode(code, vragen)!).ranking.map((u) => [u.cms.id, u.match]);
    assert.deepEqual(a, b, code);
  }
});

test("elke combinatie geeft minstens één advies", () => {
  const n = vragen.map((v) => v.antwoorden.length);
  const totaal = n.reduce((a, b) => a * b, 1);
  for (let i = 0; i < totaal; i++) {
    let rest = i;
    const keuzes = n.map((m) => {
      const k = rest % m;
      rest = Math.floor(rest / m);
      return k;
    });
    const r = bereken(matrix, vragen, keuzes);
    assert.ok(r.ranking.length > 0, naarCode(keuzes));
    for (const u of r.ranking) assert.ok(u.match >= 0 && u.match <= 100);
  }
});
