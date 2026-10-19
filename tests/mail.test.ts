import { test } from "node:test";
import assert from "node:assert/strict";
import { leadMail, verstuurLeadMail, type LeadPayload } from "../lib/mail.ts";

const lead: LeadPayload = {
  naam: '<script>alert("x")</script>',
  email: "lead@voorbeeld.nl",
  bedrijf: "Evil\r\nBcc: iedereen@x.nl",
  telefoon: "",
  keuze: "bcccbc",
  antwoorden: { team: "Een redactieteam" },
  advies: [{ cms: "Prepr", match: 90, letOp: "Vendor lock-in" }],
  afgevallen: ["Webflow"],
  ontvangen: "2026-10-19T10:00:00.000Z",
};

test("mail escapet invoer en onderwerp heeft geen regeleinden", () => {
  const { onderwerp, html } = leadMail(lead, "https://www.goldfizh.nl/blog/cms?keuze=bcccbc");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!/[\r\n]/.test(onderwerp));
  assert.ok(onderwerp.includes("Prepr"));
});

test("verstuurt naar Resend met reply-to van de lead", async () => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.LEAD_EMAIL_TO = "martijn@goldfizh.nl";
  process.env.LEAD_EMAIL_FROM = "CMS-keuzehulp <keuzehulp@goldfizh.nl>";
  let verzoek: { url: string; init: RequestInit } | null = null;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    verzoek = { url, init };
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  assert.equal(await verstuurLeadMail(lead, null), true);
  const body = JSON.parse(String(verzoek!.init.body));
  assert.equal(verzoek!.url, "https://api.resend.com/emails");
  assert.deepEqual(body.to, ["martijn@goldfizh.nl"]);
  assert.equal(body.reply_to, "lead@voorbeeld.nl");

  globalThis.fetch = (async () => new Response("nee", { status: 403 })) as typeof fetch;
  assert.equal(await verstuurLeadMail(lead, null), false);
});
