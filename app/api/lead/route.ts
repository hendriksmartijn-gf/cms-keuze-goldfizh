import { NextResponse } from "next/server";
import { getMatrix } from "@/lib/data.ts";
import { veiligeParent } from "@/lib/config.ts";
import { verstuurLeadMail } from "@/lib/mail.ts";
import { bereken, vanCode } from "@/lib/scoring.ts";
import { vragen } from "@/lib/vragen.ts";

/**
 * Ontvangt een lead en mailt die (Resend) en/of stuurt die naar LEAD_WEBHOOK_URL (CRM).
 * Het advies wordt hier opnieuw berekend uit de deelcode: we vertrouwen de client niet.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PER_MINUUT = 5;
// Best effort: per serverless-instantie. Voor harde limieten Vercel WAF of Upstash gebruiken.
const pogingen = new Map<string, number[]>();

function teVaak(ip: string) {
  const nu = Date.now();
  const recent = (pogingen.get(ip) ?? []).filter((t) => nu - t < 60_000);
  recent.push(nu);
  pogingen.set(ip, recent);
  return recent.length > PER_MINUUT;
}

const tekst = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ fout: "Niet toegestaan" }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "onbekend";
  if (teVaak(ip)) return NextResponse.json({ fout: "Te veel pogingen, probeer het zo opnieuw" }, { status: 429 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ fout: "Ongeldige aanvraag" }, { status: 400 });

  // Honeypot ingevuld: doe alsof het gelukt is, zodat bots niet leren.
  if (tekst(body.website, 200)) return NextResponse.json({ ok: true });

  const lead = {
    naam: tekst(body.naam, 100),
    email: tekst(body.email, 200).toLowerCase(),
    bedrijf: tekst(body.bedrijf, 150),
    telefoon: tekst(body.telefoon, 30),
  };
  if (!lead.naam || !lead.bedrijf || !EMAIL.test(lead.email)) {
    return NextResponse.json({ fout: "Vul naam, organisatie en een geldig e-mailadres in" }, { status: 400 });
  }
  if (body.toestemming !== true) return NextResponse.json({ fout: "Toestemming is nodig" }, { status: 400 });

  const keuzes = vanCode(tekst(body.keuze, 20), vragen);
  if (!keuzes) return NextResponse.json({ fout: "Ongeldige keuze" }, { status: 400 });

  const { top, afgevallen } = bereken(await getMatrix(), vragen, keuzes);
  const payload = {
    ...lead,
    toestemming: true,
    bron: "cms-keuzehulp",
    keuze: tekst(body.keuze, 20),
    antwoorden: Object.fromEntries(vragen.map((v, i) => [v.id, v.antwoorden[keuzes[i]].label])),
    advies: top.map((u) => ({
      cms: u.cms.naam,
      match: u.match,
      letOp: u.buitenEisen ? `buiten je eisen: ${u.buitenEisen.join("; ")}` : (u.letOp?.label ?? null),
    })),
    afgevallen: afgevallen.map((a) => a.cms.naam),
    ontvangen: new Date().toISOString(),
  };

  const pagina = veiligeParent(tekst(body.parent, 200) || undefined, tekst(body.pagina, 500) || undefined)?.deelUrl;
  const deelLink = `${pagina ?? new URL(req.url).origin + "/"}?keuze=${payload.keuze}`;

  // Kanalen: e-mail (Resend) en/of webhook (CRM). Eén geslaagd kanaal is genoeg.
  const kanalen: Promise<boolean>[] = [];
  if (process.env.RESEND_API_KEY) kanalen.push(verstuurLeadMail(payload, deelLink));
  if (process.env.LEAD_WEBHOOK_URL) kanalen.push(naarWebhook(process.env.LEAD_WEBHOOK_URL, payload));

  if (!kanalen.length) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[lead] geen RESEND_API_KEY of LEAD_WEBHOOK_URL, lead niet doorgestuurd:", payload.keuze, payload.advies);
      return NextResponse.json({ ok: true });
    }
    console.error("[lead] geen afleverkanaal geconfigureerd");
    return NextResponse.json({ fout: "Versturen lukt nu niet" }, { status: 503 });
  }

  const gelukt = (await Promise.all(kanalen)).some(Boolean);
  if (!gelukt) return NextResponse.json({ fout: "Versturen lukt nu niet" }, { status: 502 });
  return NextResponse.json({ ok: true });
}

async function naarWebhook(url: string, payload: object): Promise<boolean> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.LEAD_WEBHOOK_SECRET ? { Authorization: `Bearer ${process.env.LEAD_WEBHOOK_SECRET}` } : {}),
    },
    body: JSON.stringify(payload),
  }).catch(() => null);
  // Geen persoonsgegevens loggen.
  if (!res?.ok) console.error("[lead] webhook faalde", res?.status);
  return !!res?.ok;
}
