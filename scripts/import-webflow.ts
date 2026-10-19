/**
 * Eenmalige import: maakt de drie collecties (criteria, CMS'en, beoordelingen) in Webflow aan
 * en vult ze vanuit data/matrix.json.
 *
 *   WEBFLOW_API_TOKEN=… WEBFLOW_SITE_ID=… npm run webflow:import            # items als concept
 *   WEBFLOW_API_TOKEN=… WEBFLOW_SITE_ID=… npm run webflow:import -- --klaar  # klaar om te publiceren
 *
 * Token: Webflow → Site settings → Apps & integrations → API access, scope "CMS: read and write".
 * Stopt als een van de collecties al bestaat, zodat er nooit dubbele data ontstaat.
 */
import { readFileSync } from "node:fs";
import type { Matrix } from "../lib/types.ts";
import { COLLECTIES, veldSlug } from "../lib/webflow.ts";

const API = process.env.WEBFLOW_API_BASE ?? "https://api.webflow.com/v2";
const TOKEN = process.env.WEBFLOW_API_TOKEN;
const SITE = process.env.WEBFLOW_SITE_ID;
const KLAAR = process.argv.includes("--klaar");
const PAUZE_MS = Number(process.env.WEBFLOW_PAUZE_MS ?? 1100); // ruim onder de limiet van 60 verzoeken per minuut

if (!TOKEN || !SITE) {
  console.error("Zet WEBFLOW_API_TOKEN en WEBFLOW_SITE_ID.");
  process.exit(1);
}

const matrix: Matrix = JSON.parse(readFileSync(new URL("../data/matrix.json", import.meta.url), "utf8"));
const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(methode: string, pad: string, body?: unknown, poging = 1): Promise<T> {
  await wacht(PAUZE_MS);
  const res = await fetch(`${API}${pad}`, {
    method: methode,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429 && poging <= 5) {
    const sec = Number(res.headers.get("retry-after") ?? 60);
    console.log(`  rate limit, wacht ${sec}s…`);
    await wacht(sec * 1000);
    return api(methode, pad, body, poging + 1);
  }
  if (!res.ok) throw new Error(`${methode} ${pad} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

type Optie = { id: string; name: string };
type VeldDef = { displayName: string; type: string; isRequired?: boolean; helpText?: string; options?: readonly string[]; naar?: string };
type Veld = { id: string; slug: string; validations?: { options?: Optie[] }; metadata?: { options?: Optie[] } };

async function maakCollectie(sleutel: keyof typeof COLLECTIES, ids: Record<string, string>) {
  const def = COLLECTIES[sleutel];
  const { id } = await api<{ id: string }>("POST", `/sites/${SITE}/collections`, {
    displayName: def.displayName,
    singularName: def.singularName,
    slug: def.slug,
  });
  console.log(`✓ collectie ${def.displayName} (${id})`);

  const opties: Record<string, Map<string, string>> = {};
  for (const veld of Object.values(def.velden) as VeldDef[]) {
    const body: Record<string, unknown> = {
      type: veld.type,
      displayName: veld.displayName,
      isRequired: veld.isRequired ?? false,
      ...(veld.helpText ? { helpText: veld.helpText } : {}),
    };
    if (veld.options) body.metadata = { options: veld.options.map((name) => ({ name })) };
    if (veld.naar) body.metadata = { collectionId: ids[veld.naar] };

    const gemaakt = await api<Veld>("POST", `/collections/${id}/fields`, body);
    if (gemaakt.slug !== veldSlug(veld.displayName)) {
      throw new Error(`Veld "${veld.displayName}" kreeg slug "${gemaakt.slug}", verwacht "${veldSlug(veld.displayName)}". Pas lib/webflow.ts aan.`);
    }
    if (veld.options) {
      const lijst = gemaakt.validations?.options ?? gemaakt.metadata?.options ?? [];
      opties[veld.displayName] = new Map(lijst.map((o) => [o.name, o.id]));
    }
  }
  console.log(`  ${Object.keys(def.velden).length} velden`);
  return { id, opties };
}

async function maakItems(collectieId: string, items: { fieldData: Record<string, unknown> }[], label: string) {
  const ids = new Map<string, string>();
  for (const [i, item] of items.entries()) {
    const res = await api<{ id: string }>("POST", `/collections/${collectieId}/items`, { isDraft: !KLAAR, ...item });
    ids.set(item.fieldData.slug as string, res.id);
    if ((i + 1) % 20 === 0 || i === items.length - 1) console.log(`  ${label}: ${i + 1}/${items.length}`);
  }
  return ids;
}

const v = (displayName: string) => veldSlug(displayName);

async function main() {
  const { collections } = await api<{ collections: { slug: string; displayName: string }[] }>("GET", `/sites/${SITE}/collections`);
  const bestaand = collections.filter((c) => Object.values(COLLECTIES).some((d) => d.slug === c.slug));
  if (bestaand.length) {
    console.error(`Gestopt: deze collecties bestaan al: ${bestaand.map((c) => c.displayName).join(", ")}.`);
    process.exit(1);
  }

  const ids: Record<string, string> = {};
  const { criteria: C, cms: M, beoordelingen: B } = COLLECTIES;

  const crit = await maakCollectie("criteria", ids);
  ids.criteria = crit.id;
  const cms = await maakCollectie("cms", ids);
  ids.cms = cms.id;
  const beo = await maakCollectie("beoordelingen", ids);
  ids.beoordelingen = beo.id;

  const critIds = await maakItems(
    crit.id,
    matrix.criteria.map((c, i) => ({
      fieldData: {
        name: c.label,
        slug: veldSlug(c.id),
        [v(C.velden.sleutel.displayName)]: c.id,
        [v(C.velden.categorie.displayName)]: crit.opties[C.velden.categorie.displayName].get(c.categorie),
        [v(C.velden.uitleg.displayName)]: c.uitleg,
        [v(C.velden.inEenZin.displayName)]: c.inZin,
        [v(C.velden.gewicht.displayName)]: c.gewicht,
        [v(C.velden.volgorde.displayName)]: i + 1,
      },
    })),
    "criteria",
  );

  const cmsIds = await maakItems(
    cms.id,
    matrix.cms.map((c, i) => ({
      fieldData: {
        name: c.naam,
        slug: c.id,
        [v(M.velden.watIsHet.displayName)]: c.wat,
        [v(M.velden.pastBij.displayName)]: c.pastBij,
        [v(M.velden.partner.displayName)]: c.partner,
        [v(M.velden.minPrijs.displayName)]: c.minPrijs,
        [v(M.velden.eigenFrontend.displayName)]: c.eigenFrontend,
        [v(M.velden.volgorde.displayName)]: i + 1,
      },
    })),
    "CMS'en",
  );

  const beoordelingen = matrix.criteria.flatMap((c) =>
    matrix.cms.map((m) => {
      const cel = matrix.cellen[c.id][m.id];
      return {
        fieldData: {
          name: `${m.naam} – ${c.label}`,
          slug: `${m.id}-${veldSlug(c.id)}`,
          [v(B.velden.cms.displayName)]: cmsIds.get(m.id),
          [v(B.velden.criterium.displayName)]: critIds.get(veldSlug(c.id)),
          [v(B.velden.score.displayName)]: beo.opties[B.velden.score.displayName].get(cel.score),
          [v(B.velden.korteTekst.displayName)]: cel.tekst,
          ...(cel.letOp ? { [v(B.velden.letOp.displayName)]: cel.letOp } : {}),
          ...(cel.bron ? { [v(B.velden.bron.displayName)]: cel.bron } : {}),
          [v(B.velden.gecontroleerd.displayName)]: `${cel.gecontroleerd ?? matrix.bijgewerkt}T00:00:00.000Z`,
        },
      };
    }),
  );
  await maakItems(beo.id, beoordelingen, "beoordelingen");

  console.log(`\nKlaar. ${KLAAR ? "Items staan klaar om te publiceren." : "Items staan als concept; zet ze op 'klaar' en publiceer de site."}`);
  console.log("Zet deze waarden in Vercel:\n");
  console.log(`WEBFLOW_COLLECTIE_CRITERIA=${ids.criteria}`);
  console.log(`WEBFLOW_COLLECTIE_CMS=${ids.cms}`);
  console.log(`WEBFLOW_COLLECTIE_BEOORDELINGEN=${ids.beoordelingen}`);
}

main().catch((err) => {
  console.error("\nImport mislukt:", err.message);
  console.error("Collecties die al zijn aangemaakt blijven staan; verwijder ze in Webflow voordat je opnieuw draait.");
  process.exit(1);
});
