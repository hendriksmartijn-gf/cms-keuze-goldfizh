/** Leadmail via Resend (https://resend.com/docs/api-reference/emails/send-email). */

export interface LeadPayload {
  naam: string;
  email: string;
  bedrijf: string;
  telefoon: string;
  keuze: string;
  antwoorden: Record<string, string>;
  advies: { cms: string; match: number; letOp: string | null }[];
  afgevallen: string[];
  ontvangen: string;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Alles hierin is gebruikersinvoer: altijd escapen. */
export function leadMail(lead: LeadPayload, deelLink: string | null) {
  const onderwerp = `Lead CMS-keuzehulp: ${lead.bedrijf} (${lead.advies[0]?.cms ?? "geen advies"})`.replace(/[\r\n]+/g, " ");
  const rij = (k: string, v: string) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(k)}</td><td>${esc(v)}</td></tr>`;

  const html = `
<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#16141f">
  <h2 style="margin:0 0 12px">Nieuwe lead uit de CMS-keuzehulp</h2>
  <table>${rij("Naam", lead.naam)}${rij("E-mail", lead.email)}${rij("Organisatie", lead.bedrijf)}${rij("Telefoon", lead.telefoon || "–")}</table>
  <h3 style="margin:20px 0 6px">Advies</h3>
  <ol>${lead.advies.map((a) => `<li><strong>${esc(a.cms)}</strong> (${a.match}% match)${a.letOp ? ` · let op: ${esc(a.letOp)}` : ""}</li>`).join("")}</ol>
  ${lead.afgevallen.length ? `<p style="color:#666">Afgevallen: ${esc(lead.afgevallen.join(", "))}</p>` : ""}
  <h3 style="margin:20px 0 6px">Antwoorden</h3>
  <table>${Object.entries(lead.antwoorden).map(([k, v]) => rij(k, v)).join("")}</table>
  ${deelLink ? `<p><a href="${esc(deelLink)}">Bekijk dit advies</a></p>` : ""}
  <p style="color:#999;font-size:12px">Ontvangen ${esc(lead.ontvangen)} · toestemming voor contact gegeven · beantwoorden gaat direct naar de lead</p>
</div>`;

  const tekst = [
    `Nieuwe lead uit de CMS-keuzehulp`,
    ``,
    `Naam: ${lead.naam}`,
    `E-mail: ${lead.email}`,
    `Organisatie: ${lead.bedrijf}`,
    `Telefoon: ${lead.telefoon || "-"}`,
    ``,
    `Advies:`,
    ...lead.advies.map((a, i) => `${i + 1}. ${a.cms} (${a.match}%)${a.letOp ? `, let op: ${a.letOp}` : ""}`),
    lead.afgevallen.length ? `Afgevallen: ${lead.afgevallen.join(", ")}` : "",
    ``,
    `Antwoorden:`,
    ...Object.entries(lead.antwoorden).map(([k, v]) => `- ${k}: ${v}`),
    deelLink ? `\nAdvies bekijken: ${deelLink}` : "",
  ].join("\n");

  return { onderwerp, html, tekst };
}

export async function verstuurLeadMail(lead: LeadPayload, deelLink: string | null): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const aan = process.env.LEAD_EMAIL_TO;
  const van = process.env.LEAD_EMAIL_FROM;
  if (!key || !aan || !van) return false;

  const { onderwerp, html, tekst } = leadMail(lead, deelLink);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: van,
      to: aan.split(",").map((s) => s.trim()),
      reply_to: lead.email,
      subject: onderwerp,
      html,
      text: tekst,
    }),
  }).catch(() => null);

  if (!res?.ok) {
    console.error("[lead] mail faalde", res?.status);
    return false;
  }
  return true;
}
