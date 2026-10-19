import type { Cel, Cms, Criterium, Matrix, Score } from "./types.ts";

/**
 * De matrix in Webflow CMS: drie collecties, aangemaakt door scripts/import-webflow.ts.
 * Veld-slugs liggen hier vast; het importscript controleert dat Webflow ze zo aanmaakt.
 * Webflow houdt een slug gelijk als een redacteur de veldnaam later wijzigt.
 */
export const COLLECTIES = {
  criteria: {
    displayName: "CMS-criteria",
    singularName: "CMS-criterium",
    slug: "cms-criteria",
    velden: {
      sleutel: { displayName: "Sleutel", type: "PlainText", isRequired: true, helpText: "Wordt gebruikt in de scoring-code. Niet wijzigen." },
      categorie: { displayName: "Categorie", type: "Option", options: ["Redactie", "Techniek", "Soevereiniteit", "AI", "Marketing", "Kosten & risico"] },
      uitleg: { displayName: "Uitleg", type: "PlainText" },
      inEenZin: { displayName: "In een zin", type: "PlainText", isRequired: true, helpText: 'Hoe het criterium in een lopende zin heet, bijv. "personalisatie".' },
      gewicht: { displayName: "Gewicht", type: "Number", isRequired: true, helpText: "Basisgewicht. 0 = alleen informatief." },
      volgorde: { displayName: "Volgorde", type: "Number" },
    },
  },
  cms: {
    displayName: "CMS-vergelijking",
    singularName: "CMS",
    slug: "cms",
    velden: {
      watIsHet: { displayName: "Wat is het", type: "PlainText", isRequired: true, helpText: "Eén zin. Alleen claims die ook in de beoordelingen staan." },
      pastBij: { displayName: "Past bij", type: "PlainText", isRequired: true, helpText: 'Vervolg op "… past bij", bijv. "organisaties die …".' },
      partner: { displayName: "Goldfizh-partner", type: "Switch", helpText: "Alleen voor openbaarmaking; telt niet mee in de score." },
      minPrijs: { displayName: "Minimale prijs", type: "Number", isRequired: true, helpText: "Laagste licentieprijs per maand in euro's (budgetfilter)." },
      eigenFrontend: { displayName: "Eigen frontend nodig", type: "Switch", helpText: "Headless: vraagt developers." },
      volgorde: { displayName: "Volgorde", type: "Number" },
    },
  },
  beoordelingen: {
    displayName: "CMS-beoordelingen",
    singularName: "CMS-beoordeling",
    slug: "cms-beoordelingen",
    velden: {
      cms: { displayName: "CMS", type: "Reference", naar: "cms", isRequired: true },
      criterium: { displayName: "Criterium", type: "Reference", naar: "criteria", isRequired: true },
      score: { displayName: "Score", type: "Option", options: ["groen", "geel", "oranje", "rood", "info"], isRequired: true },
      korteTekst: { displayName: "Korte tekst", type: "PlainText", isRequired: true, helpText: "Samenvatting voor de vergelijking." },
      letOp: { displayName: "Let op", type: "PlainText", helpText: "Verplicht bij geel, oranje of rood: wat betekent het en wanneer is het een probleem?" },
      bron: { displayName: "Bron", type: "Link" },
      gecontroleerd: { displayName: "Gecontroleerd op", type: "DateTime" },
    },
  },
} as const;

type Sleutel = keyof typeof COLLECTIES;

/** Zoals Webflow een veld-slug afleidt van de displayName. */
export function veldSlug(displayName: string) {
  return displayName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface WebflowItem {
  id: string;
  lastUpdated?: string;
  fieldData: Record<string, unknown>;
}

export interface WebflowVeld {
  slug: string;
  type: string;
  validations?: { options?: { id: string; name: string }[] } | null;
  metadata?: { options?: { id: string; name: string }[] } | null;
}

export interface WebflowCollectie {
  fields: WebflowVeld[];
  items: WebflowItem[];
}

/** Webflow-items → Matrix. Puur, zodat het zonder API te testen is. */
export function naarMatrix(data: Record<Sleutel, WebflowCollectie>): Matrix {
  const optie = (c: WebflowCollectie, veld: string, id: unknown) => {
    const f = c.fields.find((f) => f.slug === veldSlug(veld));
    return (f?.validations?.options ?? f?.metadata?.options)?.find((o) => o.id === id)?.name;
  };
  const v = (item: WebflowItem, displayName: string) => item.fieldData[veldSlug(displayName)];
  const tekst = (item: WebflowItem, displayName: string) => (v(item, displayName) as string | undefined) ?? "";
  const getal = (item: WebflowItem, displayName: string) => Number(v(item, displayName) ?? 0);
  const opVolgorde = (a: WebflowItem, b: WebflowItem) => getal(a, "Volgorde") - getal(b, "Volgorde");

  const { criteria: C, cms: M, beoordelingen: B } = COLLECTIES;

  const critPerId = new Map<string, string>();
  const criteria: Criterium[] = [...data.criteria.items].sort(opVolgorde).map((item) => {
    const id = tekst(item, C.velden.sleutel.displayName);
    critPerId.set(item.id, id);
    return {
      id,
      label: tekst(item, "name"),
      categorie: optie(data.criteria, C.velden.categorie.displayName, v(item, C.velden.categorie.displayName)) ?? "",
      uitleg: tekst(item, C.velden.uitleg.displayName),
      inZin: tekst(item, C.velden.inEenZin.displayName),
      gewicht: getal(item, C.velden.gewicht.displayName),
    };
  });

  const cmsPerId = new Map<string, string>();
  const cms: Cms[] = [...data.cms.items].sort(opVolgorde).map((item) => {
    const id = tekst(item, "slug");
    cmsPerId.set(item.id, id);
    return {
      id,
      naam: tekst(item, "name"),
      wat: tekst(item, M.velden.watIsHet.displayName),
      pastBij: tekst(item, M.velden.pastBij.displayName),
      partner: !!v(item, M.velden.partner.displayName),
      minPrijs: getal(item, M.velden.minPrijs.displayName),
      eigenFrontend: !!v(item, M.velden.eigenFrontend.displayName),
    };
  });

  const cellen: Matrix["cellen"] = {};
  for (const item of data.beoordelingen.items) {
    const critId = critPerId.get(v(item, B.velden.criterium.displayName) as string);
    const cmsId = cmsPerId.get(v(item, B.velden.cms.displayName) as string);
    const score = optie(data.beoordelingen, B.velden.score.displayName, v(item, B.velden.score.displayName)) as Score | undefined;
    if (!critId || !cmsId || !score) continue;
    const cel: Cel = { score, tekst: tekst(item, B.velden.korteTekst.displayName) };
    const letOp = tekst(item, B.velden.letOp.displayName);
    const bron = tekst(item, B.velden.bron.displayName);
    const gecontroleerd = tekst(item, B.velden.gecontroleerd.displayName);
    if (letOp) cel.letOp = letOp;
    if (bron) cel.bron = bron;
    if (gecontroleerd) cel.gecontroleerd = gecontroleerd.slice(0, 10);
    (cellen[critId] ??= {})[cmsId] = cel;
  }

  const bijgewerkt =
    [data.criteria, data.cms, data.beoordelingen]
      .flatMap((c) => c.items.map((i) => i.lastUpdated ?? ""))
      .sort()
      .at(-1)
      ?.slice(0, 10) ?? "";

  return { bijgewerkt, criteria, cms, cellen };
}

/** Blokkerend: zonder dit is het advies niet te berekenen en vallen we terug op de lokale matrix. */
export function blokkerendeFouten(m: Matrix): string[] {
  const fouten: string[] = [];
  if (m.cms.length < 3) fouten.push(`maar ${m.cms.length} CMS'en gepubliceerd`);
  if (!m.criteria.length) fouten.push("geen criteria gepubliceerd");
  for (const c of m.criteria)
    for (const cms of m.cms) if (!m.cellen[c.id]?.[cms.id]) fouten.push(`beoordeling ontbreekt: ${cms.naam} / ${c.label}`);
  return fouten;
}

/** Redactionele punten: de widget werkt, maar de inhoud verdient aandacht. */
export function redactiePunten(m: Matrix, vandaag = new Date(), maxDagen = 180): string[] {
  const punten: string[] = [];
  for (const c of m.criteria)
    for (const cms of m.cms) {
      const cel = m.cellen[c.id]?.[cms.id];
      if (!cel || cel.score === "info") continue;
      const waar = `${cms.naam} / ${c.label}`;
      if (["geel", "oranje", "rood"].includes(cel.score) && !cel.letOp) punten.push(`${waar}: "Let op" ontbreekt`);
      if (!cel.bron) punten.push(`${waar}: bron ontbreekt`);
      if (!cel.gecontroleerd) punten.push(`${waar}: controledatum ontbreekt`);
      else if ((vandaag.getTime() - new Date(cel.gecontroleerd).getTime()) / 86_400_000 > maxDagen)
        punten.push(`${waar}: langer dan ${maxDagen} dagen niet gecontroleerd (${cel.gecontroleerd})`);
    }
  return punten;
}
