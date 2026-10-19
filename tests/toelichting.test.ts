import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bereken, vanCode } from "../lib/scoring.ts";
import { basisToelichting, feitenVoorLlm } from "../lib/toelichting.ts";
import { vragen } from "../lib/vragen.ts";
import type { Matrix } from "../lib/types.ts";

const matrix: Matrix = JSON.parse(readFileSync(new URL("../data/matrix.json", import.meta.url), "utf8"));
const top = (code: string) => bereken(matrix, vragen, vanCode(code, vragen)!).ranking.slice(0, 3);

test("nummer 1 beschrijft wat het is en voor wie, alternatieven zeggen waarop ze beter zijn", () => {
  const t = top("cccacb");
  const tekst = basisToelichting(t, matrix);
  assert.ok(tekst[t[0].cms.id].startsWith(t[0].cms.wat));
  assert.ok(tekst[t[0].cms.id].includes("past bij"));
  assert.match(tekst[t[1].cms.id], new RegExp(`Kies ${t[1].cms.naam} boven ${t[0].cms.naam} als je meer nadruk wilt leggen op`));
});

test("elke combinatie krijgt voor de hele top 3 een tekst, zonder lege of dubbele stukken", () => {
  const n = vragen.map((v) => v.antwoorden.length);
  for (let i = 0; i < n.reduce((a, b) => a * b, 1); i++) {
    let rest = i;
    const keuzes = n.map((m) => { const k = rest % m; rest = Math.floor(rest / m); return k; });
    const t = bereken(matrix, vragen, keuzes).ranking.slice(0, 3);
    const tekst = basisToelichting(t, matrix);
    for (const u of t) {
      assert.ok(tekst[u.cms.id]?.length > 40, u.cms.id);
      assert.ok(!/undefined|\s{2}|\.\./.test(tekst[u.cms.id]), tekst[u.cms.id]);
    }
  }
});

test("de input voor het taalmodel bevat geen partnerstatus of scores", () => {
  const t = top("cccacb");
  const json = JSON.stringify(feitenVoorLlm(t, matrix, vragen, vanCode("cccacb", vragen)!));
  assert.ok(!/partner/i.test(json));
  assert.ok(!/match/i.test(json));
});
