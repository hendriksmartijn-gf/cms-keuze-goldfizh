"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { bereken, naarCode, type Reden, type Uitslag } from "@/lib/scoring.ts";
import { basisToelichting, type Toelichtingen } from "@/lib/toelichting.ts";
import type { Matrix, Vraag } from "@/lib/types.ts";

interface Props {
  matrix: Matrix;
  vragen: Vraag[];
  startKeuzes: number[] | null;
  parentOrigin: string | null;
  parentUrl: string | null;
}

const PRIVACY_URL = process.env.NEXT_PUBLIC_PRIVACY_URL ?? "https://www.goldfizh.nl/privacy";

type Event = { naam: string; params?: Record<string, string | number> };

export default function Keuzehulp({ matrix, vragen, startKeuzes, parentOrigin, parentUrl }: Props) {
  const [keuzes, setKeuzes] = useState<number[]>(startKeuzes ?? []);
  const [stap, setStap] = useState(startKeuzes ? vragen.length : 0);
  const klaar = stap >= vragen.length;
  const code = klaar ? naarCode(keuzes) : null;
  const resultaat = useMemo(() => (klaar ? bereken(matrix, vragen, keuzes) : null), [klaar, matrix, vragen, keuzes]);
  const basis = useMemo(() => (resultaat ? basisToelichting(resultaat.ranking.slice(0, 3), matrix) : {}), [resultaat, matrix]);
  // Gegenereerde toelichting vervangt de basistekst zodra die er is; mislukt het, dan blijft de basis staan.
  const [gegenereerd, setGegenereerd] = useState<{ code: string; teksten: Toelichtingen } | null>(null);

  // Events gaan naar de parent (Webflow → GTM/dataLayer). Nooit persoonsgegevens meesturen.
  const meld = (e: Event) => {
    if (parentOrigin) window.parent.postMessage({ type: "gf-cms:event", ...e }, parentOrigin);
    else (window as unknown as { dataLayer?: unknown[] }).dataLayer?.push({ event: `cms_keuzehulp_${e.naam}`, ...e.params });
  };

  // Hoogte doorgeven zodat het iframe meegroeit.
  useEffect(() => {
    if (!parentOrigin) return;
    const post = () =>
      window.parent.postMessage({ type: "gf-cms:resize", height: document.documentElement.scrollHeight }, parentOrigin);
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    post();
    return () => ro.disconnect();
  }, [parentOrigin]);

  useEffect(() => {
    if (!code) return;
    const ctrl = new AbortController();
    fetch(`/api/toelichting?keuze=${code}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.toelichtingen && setGegenereerd({ code, teksten: d.toelichtingen }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [code]);

  useEffect(() => {
    if (!resultaat || !code) return;
    meld({ naam: "resultaat", params: { keuze: code, top1: resultaat.ranking[0]?.cms.id ?? "geen" } });
    if (parentOrigin) window.parent.postMessage({ type: "gf-cms:keuze", code }, parentOrigin);
    else window.history.replaceState(null, "", `?keuze=${code}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const kies = (antwoord: number) => {
    const nieuw = [...keuzes.slice(0, stap), antwoord];
    setKeuzes(nieuw);
    meld({ naam: "antwoord", params: { vraag: vragen[stap].id, antwoord: naarCode([antwoord]), stap: stap + 1 } });
    setStap(stap + 1);
  };

  const opnieuw = () => {
    setKeuzes([]);
    setStap(0);
    meld({ naam: "opnieuw" });
    if (parentOrigin) window.parent.postMessage({ type: "gf-cms:keuze", code: null }, parentOrigin);
    else window.history.replaceState(null, "", window.location.pathname);
  };

  if (!klaar) {
    const vraag = vragen[stap];
    return (
      <section className="kaart" aria-live="polite">
        <div className="voortgang" role="progressbar" aria-valuemin={1} aria-valuemax={vragen.length} aria-valuenow={stap + 1}>
          <div style={{ width: `${(stap / vragen.length) * 100}%` }} />
        </div>
        <p className="stap">
          Vraag {stap + 1} van {vragen.length}
        </p>
        <fieldset key={vraag.id}>
          <legend>
            <h2>{vraag.vraag}</h2>
          </legend>
          {vraag.hulp && <p className="hulp">{vraag.hulp}</p>}
          <div className="opties">
            {vraag.antwoorden.map((a, i) => (
              <label key={i} className={keuzes[stap] === i ? "optie gekozen" : "optie"}>
                <input type="radio" name={vraag.id} checked={keuzes[stap] === i} onChange={() => kies(i)} />
                <span>{a.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {stap > 0 && (
          <button type="button" className="link" onClick={() => setStap(stap - 1)}>
            ← Vorige vraag
          </button>
        )}
      </section>
    );
  }

  const { ranking, afgevallen } = resultaat!;
  const ai = gegenereerd?.code === code ? gegenereerd.teksten : null;
  const top = ranking.slice(0, 3);
  const rest = ranking.slice(3);
  const deelLink = `${parentUrl ? parentUrl.split("?")[0] : typeof window !== "undefined" ? window.location.origin + window.location.pathname : ""}?keuze=${code}`;

  return (
    <section className="resultaat" aria-live="polite">
      <header>
        <p className="stap">Jouw eerste advies</p>
        <h2>{top.length ? `Deze ${top.length === 1 ? "past" : `${top.length} passen`} het best bij jouw situatie` : "Geen CMS past bij al je eisen"}</h2>
        <p className="hulp">
          Gebaseerd op je antwoorden en onze vergelijking van {matrix.cms.length} CMS'en op {matrix.criteria.length}{" "}
          criteria (bijgewerkt {new Date(matrix.bijgewerkt).toLocaleDateString("nl-NL", { month: "long", year: "numeric" })}).
        </p>
      </header>

      <ol className="top">
        {top.map((u, i) => (
          <UitslagKaart
            key={u.cms.id}
            uitslag={u}
            positie={i + 1}
            tekst={ai?.[u.cms.id] ?? basis[u.cms.id]}
            onOpen={() => meld({ naam: "uitklap", params: { cms: u.cms.id, positie: i + 1 } })}
          />
        ))}
      </ol>

      <LeadForm code={code!} top={top.map((u) => u.cms.id)} meld={meld} parentOrigin={parentOrigin} parentUrl={parentUrl} />

      {rest.length > 0 && (
        <details className="extra">
          <summary>Overige opties ({rest.length})</summary>
          <ul>
            {rest.map((u) => (
              <li key={u.cms.id}>
                <strong>{u.cms.naam}</strong> <span className="match-klein">{u.match}% match</span>
                {u.letOp && <span className="hulp"> · let op: {u.letOp.label.toLowerCase()}, {u.letOp.tekst.toLowerCase()}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {afgevallen.length > 0 && (
        <details className="extra">
          <summary>Afgevallen ({afgevallen.length})</summary>
          <ul>
            {afgevallen.map((a) => (
              <li key={a.cms.id}>
                <strong>{a.cms.naam}</strong> <span className="hulp">{a.redenen.join("; ")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="acties">
        <button
          type="button"
          className="knop secundair"
          onClick={() => {
            navigator.clipboard?.writeText(deelLink);
            meld({ naam: "deel", params: { keuze: code! } });
          }}
        >
          Kopieer link naar dit advies
        </button>
        <button type="button" className="link" onClick={opnieuw}>
          Opnieuw beginnen
        </button>
      </div>

      <p className="disclaimer">
        Goldfizh is partner van Webflow, Sanity en Prepr. Partnerschap telt niet mee in de score: elk CMS wordt op dezelfde
        criteria beoordeeld. Dit is een eerste richting, geen definitief advies; prijzen en voorwaarden veranderen.
        {ai && " De toelichting per CMS is met AI geschreven op basis van onze vergelijking."}
      </p>
    </section>
  );
}

function UitslagKaart({
  uitslag,
  positie,
  tekst,
  onOpen,
}: {
  uitslag: Uitslag;
  positie: number;
  tekst?: string;
  onOpen: () => void;
}) {
  const { cms, match, sterk, letOp } = uitslag;
  return (
    <li className={positie === 1 ? "uitslag eerste" : "uitslag"}>
      <details onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && onOpen()}>
        <summary className="kop">
          <span className="positie">{positie}</span>
          <span className="naam">
            <h3>{cms.naam}</h3>
            {cms.partner && <span className="badge">Goldfizh-partner</span>}
          </span>
          <span className="match">{match}%</span>
          <span className="pijl" aria-hidden="true" />
        </summary>
        <div className="inhoud">
          {tekst && (
            <p className="toelichting" key={tekst}>
              {tekst}
            </p>
          )}
          {letOp && (
            <p className="letop">
              <span className="sub">Let op · {letOp.label}</span>
              {letOp.letOp ?? letOp.tekst}
            </p>
          )}
          {sterk.length > 0 && (
            <details className="onderbouwing">
              <summary>Hoe we tot deze score komen</summary>
              <ul className="redenen">
                {sterk.map((r) => (
                  <RedenRegel key={r.criterium} reden={r} />
                ))}
                {letOp && <RedenRegel reden={letOp} />}
              </ul>
            </details>
          )}
        </div>
      </details>
    </li>
  );
}

function RedenRegel({ reden }: { reden: Reden }) {
  return (
    <li className={`reden ${reden.score}`}>
      <strong>{reden.label}:</strong> {reden.tekst}
      {reden.omdat && <span className="omdat">Weegt zwaar door je antwoord “{reden.omdat}”</span>}
    </li>
  );
}

function LeadForm({
  code,
  top,
  meld,
  parentOrigin,
  parentUrl,
}: {
  code: string;
  top: string[];
  meld: (e: Event) => void;
  parentOrigin: string | null;
  parentUrl: string | null;
}) {
  const [status, setStatus] = useState<"idle" | "bezig" | "klaar" | "fout">("idle");
  const [fout, setFout] = useState("");
  const gestart = useRef(false);

  async function verstuur(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("bezig");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, toestemming: data.toestemming === "on", keuze: code, parent: parentOrigin, pagina: parentUrl }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.fout ?? "Versturen mislukt");
      setStatus("klaar");
      meld({ naam: "lead", params: { keuze: code, top1: top[0] ?? "geen" } });
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Versturen mislukt");
      setStatus("fout");
    }
  }

  if (status === "klaar") {
    return (
      <div className="lead klaar">
        <h3>Dank je, we nemen contact op</h3>
        <p>Een van onze specialisten neemt contact met je op om je advies samen aan te scherpen.</p>
      </div>
    );
  }

  return (
    <form
      className="lead"
      onSubmit={verstuur}
      onFocus={() => {
        if (!gestart.current) meld({ naam: "lead_start" });
        gestart.current = true;
      }}
    >
      <h3>Toets dit advies aan jouw situatie</h3>
      <p>
        Een keuzehulp kent je contentmodel, integraties en roadmap niet. Plan een gratis sparsessie van 30 minuten met een
        van onze specialisten; we nemen je antwoorden als startpunt.
      </p>
      <div className="velden">
        <label>
          Naam
          <input name="naam" required autoComplete="name" maxLength={100} />
        </label>
        <label>
          Zakelijk e-mailadres
          <input name="email" type="email" required autoComplete="email" maxLength={200} />
        </label>
        <label>
          Organisatie
          <input name="bedrijf" required autoComplete="organization" maxLength={150} />
        </label>
        <label>
          Telefoon <span className="hulp">(optioneel)</span>
          <input name="telefoon" type="tel" autoComplete="tel" maxLength={30} />
        </label>
        {/* Honeypot: onzichtbaar voor mensen, bots vullen het in. */}
        <label className="hp" aria-hidden="true">
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" name="toestemming" required />
        <span>
          Goldfizh mag contact met me opnemen over dit advies. Zie onze{" "}
          <a href={PRIVACY_URL} target="_blank" rel="noopener">
            privacyverklaring
          </a>
          .
        </span>
      </label>
      <button className="knop" disabled={status === "bezig"}>
        {status === "bezig" ? "Versturen…" : "Plan mijn sparsessie"}
      </button>
      {status === "fout" && <p className="foutmelding">{fout}. Probeer het opnieuw of mail ons direct.</p>}
    </form>
  );
}
