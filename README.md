# CMS-keuzehulp

Zes vragen → top 3 CMS'en met onderbouwing → leadformulier. Next.js op Vercel, als iframe-embed in Webflow.

## Starten

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
npm test           # scoring-tests (alle 729 antwoordcombinaties)
```

## Embed in Webflow

Zet een Embed-element op de blogpagina:

```html
<div data-gf-cms-keuzehulp></div>
<script src="https://<vercel-domein>/embed.js" async></script>
```

- Het iframe groeit automatisch mee met de inhoud.
- Het advies komt in de URL van de blogpagina (`?keuze=bcccbc`), zodat deellinks op goldfizh.nl landen en niet op Vercel.
- Events gaan naar `window.dataLayer` (GTM): `cms_keuzehulp_antwoord`, `_resultaat`, `_lead_start`, `_lead`, `_deel`, `_opnieuw`. Er gaan geen persoonsgegevens mee.
- Alleen origins uit `ALLOWED_PARENT_ORIGINS` mogen embedden (CSP `frame-ancestors` + postMessage-check).

## Hoe het advies werkt

1. **Knock-outs**: een antwoord kan CMS'en uitsluiten (geen developers → geen headless; harde EU-eis → geen VS-jurisdictie; budget → minimale licentieprijs).
2. **Gewichten**: elk criterium heeft een basisgewicht (1). Antwoorden tellen daar iets bij op (`lib/vragen.ts`).
3. **Score**: groen 2, geel 1, oranje 0, rood -1. Match % = behaald / maximum bij jouw gewichten.
4. **Toelichting** in twee lagen:
   - **Basistekst** (direct, deterministisch): per CMS *wat het is* + *past bij …* (velden `wat` en `pastBij`), voor #1 de zwaarst wegende sterke punten, voor #2 en #3 "Kies X boven Y als je meer nadruk wilt leggen op …" (criteria waarop het beter scoort dan #1).
   - **Gegenereerde tekst** (`/api/toelichting`, Claude): krijgt alleen feiten uit de matrix en de antwoorden (geen partnerstatus of scores), schrijft per CMS 2-3 zinnen op B1 en vervangt de basistekst zodra die binnen is. Elke van de 729 antwoordcombinaties wordt hooguit één keer gegenereerd en daarna gecachet; een nieuwe matrix (revalidate) of `PROMPT_VERSIE` in `lib/llm.ts` maakt de cache ongeldig. Lukt genereren niet, dan blijft de basistekst staan. De disclaimer meldt het als de tekst met AI is geschreven.
   - Onder elke kaart staat "Hoe we tot deze score komen" met de onderliggende criteria.

Partnerstatus telt niet mee in de score (er is een test die dat bewaakt) en wordt wel getoond.

## Data beheren

- **Nu**: `data/matrix.json`.
- **Later**: Sanity. Zet `SANITY_PROJECT_ID`, kopieer `sanity/schema.ts` naar de Studio en importeer met `npm run sanity:export && npx sanity dataset import sanity-seed.ndjson production`. Maak een Sanity-webhook naar `POST /api/revalidate?secret=…`, zodat een publicatie direct live staat. Valt Sanity om, dan valt de app terug op de JSON.
- Elke beoordeling heeft in Sanity een verplichte `bron` en `gecontroleerd`-datum. Na 180 dagen geeft de Studio een waarschuwing.
- Vragen en gewichten staan bewust in code. Dat zijn productbeslissingen; die horen in een review en niet in een CMS-veld.
  Let op: de volgorde van de antwoorden is onderdeel van de deelcode.

## Leads

`POST /api/lead` valideert de invoer, berekent het advies opnieuw op de server en levert de lead af via:

- **E-mail** (Resend) naar `LEAD_EMAIL_TO`. Reply-to is de lead, dus beantwoorden gaat direct naar de lead. De mail bevat contactgegevens, top 3 met aandachtspunt, afgevallen CMS'en, antwoorden en een link naar het advies.
  Eenmalige setup: maak een Resend-account, verifieer `goldfizh.nl` (of een subdomein zoals `mail.goldfizh.nl`) via DNS, zet `RESEND_API_KEY` en `LEAD_EMAIL_FROM` in Vercel.
- **Webhook** (optioneel, later naar het CRM): `LEAD_WEBHOOK_URL` + Bearer `LEAD_WEBHOOK_SECRET`.

Eén geslaagd kanaal is genoeg. Is er in productie geen enkel kanaal ingesteld, dan geeft het formulier een fout: liever dat dan stilletjes leads kwijtraken.
Bescherming: een origin-check, een honeypot, HTML-escaping in de mail en een rate limit per instantie (best effort; zet voor harde limieten Vercel WAF aan).

## Machineleesbaar

- `/api/matrix`: de volledige matrix + beslislogica als JSON (CORS open).
- `/llms.txt`: een samenvatting met links.
