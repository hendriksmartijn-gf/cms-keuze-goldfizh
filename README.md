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

## Data beheren: Webflow CMS

De matrix staat in drie Webflow-collecties op de eigen site. Die zijn tegelijk de bron voor de widget en vindbare content (CMS-pagina's op goldfizh.nl):

| Collectie | Inhoud |
|---|---|
| `CMS-vergelijking` (slug `cms`) | per CMS: wat is het, past bij, partner, minimale prijs, eigen frontend nodig, volgorde |
| `CMS-criteria` | per criterium: sleutel (niet wijzigen), categorie, uitleg, in een zin, gewicht, volgorde |
| `CMS-beoordelingen` | per CMS × criterium: score, korte tekst, let op, bron, gecontroleerd op |

**Eenmalig opzetten**

1. Maak in Webflow een API-token (Site settings → Apps & integrations → API access) met scope *CMS: read and write*.
2. `WEBFLOW_API_TOKEN=… WEBFLOW_SITE_ID=… npm run webflow:import` maakt de collecties aan en vult ze vanuit `data/matrix.json` (items als concept; `-- --klaar` zet ze klaar om te publiceren). Het script stopt als de collecties al bestaan.
3. Controleer de items in Webflow, publiceer de site.
4. Zet in Vercel `WEBFLOW_API_TOKEN` (een token met alleen leesrechten volstaat) en de drie collectie-ID's die het script toont.
5. Webflow → Site settings → Integrations → Webhooks: *Collection item published/changed/unpublished* naar `https://<app>/api/revalidate?secret=<REVALIDATE_SECRET>`, zodat wijzigingen direct in de widget staan.

**Werking**

- De app leest alleen gepubliceerde items. Concepten zie je dus pas na publiceren.
- Ontbreekt er een beoordeling (een CMS zonder score op een criterium) of is Webflow onbereikbaar, dan valt de app terug op `data/matrix.json` en logt waarom. Een halve matrix komt nooit live.
- `GET /api/controle?secret=…` geeft de redactiepunten: ontbrekende *Let op*-teksten, bronnen en controledata, en claims ouder dan 180 dagen. Hang er een wekelijkse cron of n8n-flow aan die bij punten mailt.
- Vragen en gewichten per antwoord staan bewust in code (`lib/vragen.ts`): dat zijn productbeslissingen voor een review, geen CMS-velden. Let op: de volgorde van de antwoorden is onderdeel van de deelcode.
- Veldnamen mag je in Webflow hernoemen (de slug blijft gelijk); de *Sleutel* van een criterium en de slug van een CMS niet, want daar rekent de code mee.

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
