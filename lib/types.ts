export type Score = "groen" | "geel" | "oranje" | "rood" | "info";

export interface Cms {
  id: string;
  naam: string;
  /** Goldfizh-partner: alleen voor transparantie, telt nooit mee in de score. */
  partner: boolean;
  /** Laagste realistische licentieprijs per maand in euro's, voor de budget-knock-out. */
  minPrijs: number;
  /** Vraagt een eigen (headless) frontend, dus developers. */
  eigenFrontend: boolean;
}

export interface Criterium {
  id: string;
  categorie: string;
  label: string;
  uitleg: string;
  /** Basisgewicht. 0 = alleen informatief (bijv. architectuur). */
  gewicht: number;
}

export interface Cel {
  score: Score;
  tekst: string;
  bron?: string;
  gecontroleerd?: string;
}

export interface Matrix {
  bijgewerkt: string;
  cms: Cms[];
  criteria: Criterium[];
  /** cellen[criteriumId][cmsId] */
  cellen: Record<string, Record<string, Cel>>;
}

export type KnockOut =
  | { type: "criterium"; criterium: string; maxScore: Score; reden: string }
  | { type: "prijs"; max: number; reden: string }
  | { type: "eigenFrontend"; reden: string };

export interface Antwoord {
  label: string;
  toelichting?: string;
  /** Extra gewicht per criterium bovenop het basisgewicht. */
  gewichten?: Record<string, number>;
  knockOuts?: KnockOut[];
}

export interface Vraag {
  id: string;
  vraag: string;
  hulp?: string;
  antwoorden: Antwoord[];
}
