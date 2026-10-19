import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { feitenVoorLlm, Toelichtingen } from "./toelichting.ts";

/** Ophogen bij elke promptwijziging: oude teksten in de cache vervallen dan. */
export const PROMPT_VERSIE = "2";

const SYSTEEM = `Je schrijft korte toelichtingen bij een CMS-advies op de website van Goldfizh, een digital agency.
De lezer is een marketeer of IT-beslisser die net zes vragen heeft beantwoord en een top 3 CMS'en ziet.

Schrijf per CMS één alinea van 2 tot 3 zinnen, maximaal 60 woorden:
- Positie 1: zeg kort wat het CMS is en waarom het past bij déze situatie. Vertaal de antwoorden naar wat de organisatie wil bereiken ("je wilt zelf de regie houden over…"), citeer de antwoorden niet letterlijk.
- Positie 2 en 3: begin met "{naam} past beter als je meer nadruk wilt leggen op …", gebaseerd op beterDanNummer1Op, en zeg in één zin wat het is.
- Noem het aandachtspunt niet, dat staat al apart in beeld.
- Heeft een CMS "haaltEisNiet", dan voldoet het niet aan een harde eis en vult het alleen de top 3 aan (dat staat al apart in beeld). Schrijf dan wat het is en in welke situatie het toch het overwegen waard is, bijvoorbeeld als die eis minder hard blijkt. Begin dan niet met "past beter als".

Regels:
- Gebruik uitsluitend feiten uit de input. Geen prijzen, klantnamen, cijfers of functies die niet in de input staan.
- Nederlands op B1-niveau, jij-vorm, nuchter en concreet. Geen superlatieven, geen marketingclichés, geen uitroeptekens.
- Noem Goldfizh, partnerschappen en matchpercentages niet.`;

const Schema = z.object({
  toelichtingen: z.array(z.object({ id: z.string(), tekst: z.string() })),
});

let client: Anthropic | null = null;

export function llmBeschikbaar() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function genereerToelichting(feiten: ReturnType<typeof feitenVoorLlm>): Promise<Toelichtingen> {
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 });

  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Schema) },
    system: SYSTEEM,
    messages: [{ role: "user", content: JSON.stringify(feiten) }],
  });

  if (response.stop_reason !== "end_turn" || !response.parsed_output) {
    throw new Error(`Geen bruikbare toelichting (${response.stop_reason})`);
  }

  // Alleen accepteren wat precies bij de gevraagde CMS'en hoort en redelijk kort is.
  const verwacht = new Set(feiten.advies.map((a) => a.id));
  const uit: Toelichtingen = {};
  for (const { id, tekst } of response.parsed_output.toelichtingen) {
    if (verwacht.has(id) && tekst.trim() && tekst.length <= 600) uit[id] = tekst.trim();
  }
  if (Object.keys(uit).length !== verwacht.size) throw new Error("Toelichting onvolledig");
  return uit;
}
