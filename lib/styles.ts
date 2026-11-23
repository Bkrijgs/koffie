import type { Setup, ShotLog } from "./types";
import { effectiveShots } from "./utils";

/**
 * Zetstijlen: verschillende manieren om espresso te trekken. Elke stijl is
 * een combinatie van brew ratio en doorlooptijd; de maalgraad volgt daaruit.
 * De cijfers zijn gangbare richtwaarden, geen wetten: pas ze hier aan als
 * je een ander recept wilt aanhouden.
 */
export type ShotStyle = {
  id: string;
  label: string;
  ratio: number;
  timeLow: number;
  timeHigh: number;
  /** Richting t.o.v. een normale, voor als er nog geen data is. */
  grindHint: string;
  description: string;
  /** Kanttekening bij de machine (druk e.d.). */
  caveat?: string;
};

export const SHOT_STYLES: ShotStyle[] = [
  {
    id: "ristretto",
    label: "Ristretto",
    ratio: 1.5,
    timeLow: 25,
    timeHigh: 30,
    grindHint: "fijner",
    description:
      "Kort en geconcentreerd: veel body en zoetheid, weinig zuur. Zelfde tijd als een normale, dus fijner malen in plaats van eerder stoppen.",
  },
  {
    id: "normale",
    label: "Normale",
    ratio: 2,
    timeLow: 25,
    timeHigh: 30,
    grindHint: "basis",
    description:
      "De klassieke espresso. Balans tussen body, zoet en zuur, en het ijkpunt voor alle andere stijlen.",
  },
  {
    id: "lungo",
    label: "Lungo",
    ratio: 3,
    timeLow: 25,
    timeHigh: 30,
    grindHint: "grover",
    description:
      "Lange shot met meer helderheid en minder body. Grover malen zodat hij in dezelfde tijd doorloopt; gewoon langer laten lopen wordt bitter.",
  },
  {
    id: "turbo",
    label: "Turbo",
    ratio: 3,
    timeLow: 12,
    timeHigh: 18,
    grindHint: "veel grover",
    description:
      "Grof gemalen, snel en op lagere druk. Helder, zoet en opvallend gelijkmatig, met dunnere body en minder crema.",
    caveat:
      "Bedoeld voor circa 6 bar. Zonder instelbare druk benader je het door grover te malen, zodat de drukmeter laag in het espresso-bereik blijft.",
  },
  {
    id: "allonge",
    label: "Allongé",
    ratio: 5,
    timeLow: 30,
    timeHigh: 40,
    grindHint: "veel grover",
    description:
      "Heel lange shot die richting filterkoffie gaat: licht, theeachtig en helder. Werkt het best met lichte brandingen.",
  },
];

export type StyleEstimate = {
  style: ShotStyle;
  targetYield: number;
  targetTime: number;
  /** Geschatte maalgraad, of null als er geen referentie-shot is. */
  grind: number | null;
  /** Verschil met de referentie-shot (positief = grover). */
  delta: number | null;
  /** De berekende maalgraad viel buiten de schaal van de maler. */
  outOfRange: "fine" | "coarse" | null;
};

export type StyleEstimates = {
  rows: StyleEstimate[];
  reference: ShotLog | null;
  /** True als de gevoeligheid van de maler uit eigen shots is afgeleid. */
  learned: boolean;
};

/**
 * De shot waar alle schattingen op leunen: de best beoordeelde echte shot
 * van de boon, anders de meest recente (zodat een boon met alleen dial-in
 * shots toch een referentie heeft).
 */
export function referenceShot(beanShots: ShotLog[]): ShotLog | null {
  if (beanShots.length === 0) return null;
  const byRecent = (a: ShotLog, b: ShotLog) =>
    +new Date(b.createdAt) - +new Date(a.createdAt);
  const rated = effectiveShots(beanShots);
  if (rated.length > 0) {
    return [...rated].sort((a, b) => b.rating - a.rating || byRecent(a, b))[0];
  }
  return [...beanShots].sort(byRecent)[0];
}

function flowOf(s: ShotLog): number {
  return s.yieldGrams / s.extractionTimeSeconds;
}

/**
 * Vuistregel voor hoe hard de doorstroming reageert op de maler: over de
 * hele schaal een factor e^1.8 (ongeveer 6x). Op de Sage Barista Express
 * (1-16) is dat ~12% per stap, oftewel een paar seconden op een shot van 28s.
 */
function defaultSensitivity(setup: Setup): number {
  const range = Math.max(setup.grindMax - setup.grindMin, 1);
  return 1.8 / range;
}

/**
 * Leidt de gevoeligheid (d ln(flow) / d maalgraad) af uit de shots van deze
 * boon met een lineaire regressie. Alleen bruikbaar bij genoeg shots op
 * verschillende maalgraden en een vergelijkbare dose; onzinnige uitkomsten
 * (ruis, channeling) vallen terug op de vuistregel.
 */
function learnedSensitivity(
  beanShots: ShotLog[],
  reference: ShotLog,
  fallback: number,
): number | null {
  const usable = beanShots.filter(
    (s) =>
      s.extractionTimeSeconds > 0 &&
      s.yieldGrams > 0 &&
      Math.abs(s.doseGrams - reference.doseGrams) <= 1,
  );
  if (usable.length < 4) return null;
  if (new Set(usable.map((s) => s.grindSize)).size < 2) return null;

  const xs = usable.map((s) => s.grindSize);
  const ys = usable.map((s) => Math.log(flowOf(s)));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  if (slope < fallback / 3 || slope > fallback * 3) return null;
  return slope;
}

function roundToStep(value: number, step: number): number {
  const s = step > 0 ? step : 1;
  return Math.round((Math.round(value / s) * s) * 100) / 100;
}

/**
 * Schat per zetstijl de maalgraad voor deze boon. Model: de doorstroming
 * (gram per seconde) hangt exponentieel af van de maalgraad. Vanaf de
 * referentie-shot rekenen we uit hoeveel stappen fijner of grover nodig zijn
 * om de doel-yield in de doel-tijd te halen.
 */
export function estimateStyles(
  beanShots: ShotLog[],
  setup: Setup,
  doseGrams: number,
): StyleEstimates {
  const ref = referenceShot(beanShots);
  const reference =
    ref && ref.extractionTimeSeconds > 0 && ref.yieldGrams > 0 ? ref : null;
  const fallback = defaultSensitivity(setup);
  const learnedK = reference
    ? learnedSensitivity(beanShots, reference, fallback)
    : null;
  const k = learnedK ?? fallback;

  const rows = SHOT_STYLES.map((style): StyleEstimate => {
    const targetYield = Math.round(doseGrams * style.ratio * 10) / 10;
    const targetTime = Math.round((style.timeLow + style.timeHigh) / 2);
    if (!reference) {
      return {
        style,
        targetYield,
        targetTime,
        grind: null,
        delta: null,
        outOfRange: null,
      };
    }
    const targetFlow = targetYield / targetTime;
    const raw =
      reference.grindSize + Math.log(targetFlow / flowOf(reference)) / k;
    const outOfRange =
      raw < setup.grindMin - setup.grindStep / 2
        ? "fine"
        : raw > setup.grindMax + setup.grindStep / 2
          ? "coarse"
          : null;
    const grind = roundToStep(
      Math.min(setup.grindMax, Math.max(setup.grindMin, raw)),
      setup.grindStep,
    );
    return {
      style,
      targetYield,
      targetTime,
      grind,
      delta: Math.round((grind - reference.grindSize) * 100) / 100,
      outOfRange,
    };
  });

  return { rows, reference, learned: learnedK !== null };
}
