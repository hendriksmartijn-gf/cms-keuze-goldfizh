import type { Vraag } from "./types.ts";

/**
 * De vragen en hun effect op de scoring. Dit is een productbeslissing,
 * daarom staat het in code (versiebeheer + review) en niet in het CMS.
 * Volgorde van antwoorden is onderdeel van de deelcode (a, b, c): niet
 * herschikken zonder te accepteren dat oude deellinks een ander advies geven.
 */
export const vragen: Vraag[] = [
  {
    id: "team",
    vraag: "Wie gaat er dagelijks met het CMS werken?",
    antwoorden: [
      {
        label: "Een paar marketeers, zonder technische kennis",
        gewichten: { gebruiksgemak: 3, implementatie: 1 },
      },
      {
        label: "Een redactieteam met review en goedkeuring",
        gewichten: { workflow: 3, rollen: 2, gebruiksgemak: 1 },
      },
      {
        label: "Meerdere afdelingen of merken, met strikte governance",
        gewichten: { rollen: 3, workflow: 2, contentbeheer: 1 },
      },
    ],
  },
  {
    id: "landschap",
    vraag: "Hoe ziet je contentlandschap eruit?",
    antwoorden: [
      {
        label: "Eén website, één taal",
        gewichten: { implementatie: 2, gebruiksgemak: 1 },
      },
      {
        label: "Meerdere talen of meerdere sites",
        gewichten: { contentbeheer: 3, workflow: 1 },
      },
      {
        label: "Website én app of andere kanalen uit één bron",
        gewichten: { contentbeheer: 3, dx: 2, lockin: 1 },
      },
    ],
  },
  {
    id: "ontwikkeling",
    vraag: "Wie bouwt en onderhoudt de techniek?",
    antwoorden: [
      {
        label: "Niemand, we willen het zelf kunnen zonder developers",
        gewichten: { implementatie: 3, gebruiksgemak: 1 },
        knockOuts: [
          { type: "eigenFrontend", reden: "vraagt een eigen frontend en dus developers" },
          { type: "criterium", criterium: "implementatie", maxScore: "oranje", reden: "is een specialistisch bouwtraject" },
        ],
      },
      {
        label: "Een bureau of freelancers",
        gewichten: { implementatie: 1, ecosysteem: 2, otap: 1 },
      },
      {
        label: "Een eigen developmentteam",
        gewichten: { dx: 3, otap: 2, lockin: 1 },
      },
    ],
  },
  {
    id: "soevereiniteit",
    vraag: "Moeten je data en leverancier onder Europees recht vallen?",
    hulp: "Denk aan de CLOUD Act: een Amerikaanse leverancier kan verplicht worden data te verstrekken, ook als die in de EU staat.",
    antwoorden: [
      { label: "Nee, geen specifieke eis" },
      {
        label: "Liefst wel, het weegt mee",
        gewichten: { hosting: 2, jurisdictie: 2 },
      },
      {
        label: "Ja, harde eis (bijv. overheid, zorg, finance)",
        gewichten: { hosting: 2, jurisdictie: 3 },
        knockOuts: [
          { type: "criterium", criterium: "jurisdictie", maxScore: "oranje", reden: "valt (straks) onder Amerikaans recht" },
        ],
      },
    ],
  },
  {
    id: "budget",
    vraag: "Wat is je licentiebudget per maand?",
    hulp: "Alleen de CMS-licentie, exclusief hosting en bouw.",
    antwoorden: [
      {
        label: "Tot €100",
        gewichten: { licentie: 3 },
        knockOuts: [{ type: "prijs", max: 100, reden: "past niet binnen een licentiebudget tot €100" }],
      },
      {
        label: "€100 – €500",
        gewichten: { licentie: 1 },
        knockOuts: [{ type: "prijs", max: 500, reden: "past niet binnen een licentiebudget tot €500" }],
      },
      { label: "Meer dan €500" },
    ],
  },
  {
    id: "ambitie",
    vraag: "Waar wil je over twee jaar staan met je content?",
    antwoorden: [
      {
        label: "Een snelle site die goed vindbaar is, ook in AI-zoekmachines",
        gewichten: { aiVindbaarheid: 3, meetbaarheid: 1 },
      },
      {
        label: "Content personaliseren en testen per doelgroep",
        gewichten: { personalisatie: 3, meetbaarheid: 2 },
      },
      {
        label: "AI-agents die content mee beheren en publiceren",
        gewichten: { aiBeheer: 3, contentbeheer: 1, aiVindbaarheid: 1 },
      },
    ],
  },
];
