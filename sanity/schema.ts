/**
 * Sanity-schema voor de matrix. Kopieer naar je Studio (schemaTypes) en
 * importeer de startdata met: npm run sanity:export && npx sanity dataset import sanity-seed.ndjson production
 *
 * Opzet: één document per CMS met een beoordeling per criterium. Bron en
 * controledatum zijn verplicht: claims als "VS-jurisdictie" moeten herleidbaar zijn.
 */
import { defineArrayMember, defineField, defineType } from "sanity";

const OUD_NA_DAGEN = 180;

export const criterium = defineType({
  name: "criterium",
  title: "Criterium",
  type: "document",
  fields: [
    defineField({ name: "label", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "label" }, validation: (r) => r.required(), readOnly: ({ document }) => !!document?._createdAt, description: "Wordt gebruikt in de scoring-code. Niet wijzigen." }),
    defineField({ name: "categorie", type: "string", options: { list: ["Redactie", "Techniek", "Soevereiniteit", "AI", "Marketing", "Kosten & risico"] }, validation: (r) => r.required() }),
    defineField({ name: "uitleg", type: "string" }),
    defineField({ name: "inZin", title: "In een lopende zin", type: "string", description: 'Bijv. "personalisatie en A/B-testen". Gebruikt in de toelichting.', validation: (r) => r.required() }),
    defineField({ name: "gewicht", type: "number", initialValue: 1, description: "Basisgewicht. 0 = alleen informatief.", validation: (r) => r.required().min(0).max(5) }),
    defineField({ name: "volgorde", type: "number" }),
  ],
  orderings: [{ title: "Volgorde", name: "volgorde", by: [{ field: "volgorde", direction: "asc" }] }],
});

export const cms = defineType({
  name: "cms",
  title: "CMS",
  type: "document",
  fields: [
    defineField({ name: "naam", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "naam" }, validation: (r) => r.required() }),
    defineField({ name: "partner", title: "Goldfizh-partner", type: "boolean", initialValue: false, description: "Alleen voor openbaarmaking; telt niet mee in de score." }),
    defineField({ name: "minPrijs", title: "Minimale licentieprijs p/m (€)", type: "number", validation: (r) => r.required().min(0) }),
    defineField({ name: "eigenFrontend", title: "Vraagt eigen frontend (headless)", type: "boolean", initialValue: false }),
    defineField({ name: "wat", title: "Wat is het (één zin)", type: "text", rows: 2, description: "Alleen claims die ook in de beoordelingen staan.", validation: (r) => r.required().max(200) }),
    defineField({ name: "pastBij", title: "Past bij … (vervolg van de zin)", type: "text", rows: 3, description: 'Begint klein, bijv. "organisaties die …".', validation: (r) => r.required().max(300) }),
    defineField({ name: "volgorde", type: "number" }),
    defineField({
      name: "beoordelingen",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "beoordeling",
          fields: [
            defineField({ name: "criterium", type: "reference", to: [{ type: "criterium" }], validation: (r) => r.required() }),
            defineField({ name: "score", type: "string", options: { list: ["groen", "geel", "oranje", "rood", "info"], layout: "radio", direction: "horizontal" }, validation: (r) => r.required() }),
            defineField({ name: "tekst", type: "string", validation: (r) => r.required().max(120) }),
            defineField({ name: "bron", type: "url", validation: (r) => r.required().warning("Voeg een bron toe") }),
            defineField({
              name: "gecontroleerd",
              type: "date",
              validation: (r) =>
                r.required().custom((d) => {
                  if (!d) return true;
                  const dagen = (Date.now() - new Date(d as string).getTime()) / 86_400_000;
                  return dagen > OUD_NA_DAGEN ? { message: `Ouder dan ${OUD_NA_DAGEN} dagen, opnieuw controleren`, level: "warning" } : true;
                }),
            }),
          ],
          preview: { select: { title: "criterium.label", subtitle: "tekst", score: "score" }, prepare: ({ title, subtitle, score }) => ({ title: `${title} · ${score}`, subtitle }) },
        }),
      ],
    }),
  ],
  orderings: [{ title: "Volgorde", name: "volgorde", by: [{ field: "volgorde", direction: "asc" }] }],
});

export const schemaTypes = [criterium, cms];
