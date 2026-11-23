import type { Setup, ShotLog } from "./types";
import { effectiveShots } from "./utils";

/**
 * Zetstijlen uit Lance Hedricks "6 easy espresso recipes". Per stijl geeft
 * hij een ratio-range, een tijd-range en de stand van zijn eigen maler:
 *
 *   Normale    1:2-1:2.5   25-30 s   stand 1
 *   Ristretto  1:1-1:1.5   20-25 s   stand 1
 *   Lungo      1:3-1:4     30-40 s   stand 1
 *   Allonge    1:5-1:6     30-40 s   stand 1.3
 *   Turbo      1:3         12-17 s   stand 1.5
 *   Sprover    1:8-1:12    30-40 s   stand 2.5
 *
 * Ristretto en lungo gebruiken dus dezelfde maalgraad als de normale: je
 * stopt alleen eerder of later. Pas vanaf de allonge gaat de maler grover.
 */
export type ShotStyle = {
  id: string;
  label: string;
  ratioLow: number;
  ratioHigh: number;
  /** Ratio die we invullen als je de stijl aantikt. */
  ratio: number;
  timeLow: number;
  timeHigh: number;
  /** Hoeveel grover dan de normale, in standen van Lance's maler. */
  lanceOffset: number;
  /** Richting t.o.v. een normale, voor als er nog geen data is. */
  grindHint: string;
  description: string;
};

export const SHOT_STYLES: ShotStyle[] = [
  {
    id: "ristretto",
    label: "Ristretto",
    ratioLow: 1,
    ratioHigh: 1.5,
    ratio: 1.25,
    timeLow: 20,
    timeHigh: 25,
    lanceOffset: 0,
    grindHint: "zelfde als normale",
    description:
      "Zelfde maalgraad als je normale, maar eerder stoppen. Kort en geconcentreerd, met veel meer body.",
  },
  {
    id: "normale",
    label: "Normale",
    ratioLow: 2,
    ratioHigh: 2.5,
    ratio: 2,
    timeLow: 25,
    timeHigh: 30,
    lanceOffset: 0,
    grindHint: "basis",
    description:
      "De standaard espresso en het ijkpunt: alle andere stijlen zijn fijner of grover ten opzichte van deze stand.",
  },
  {
    id: "lungo",
    label: "Lungo",
    ratioLow: 3,
    ratioHigh: 4,
    ratio: 3.5,
    timeLow: 30,
    timeHigh: 40,
    lanceOffset: 0,
    grindHint: "zelfde als normale",
    description:
      "Zelfde maalgraad als je normale, maar langer laten doorlopen. Lichter in body en minder geconcentreerd.",
  },
  {
    id: "allonge",
    label: "Allongé",
    ratioLow: 5,
    ratioHigh: 6,
    ratio: 5.5,
    timeLow: 30,
    timeHigh: 40,
    lanceOffset: 0.3,
    grindHint: "iets grover",
    description:
      "Iets grover en veel langer. Zit qua sterkte tussen filterkoffie en espresso: helder en goed drinkbaar, zonder de intensiteit van espresso.",
  },
  {
    id: "turbo",
    label: "Turbo",
    ratioLow: 3,
    ratioHigh: 3,
    ratio: 3,
    timeLow: 12,
    timeHigh: 17,
    lanceOffset: 0.5,
    grindHint: "grover",
    description:
      "Grover en heel snel. Je hebt er geen speciale machine of drukinstelling voor nodig: bij zo'n snelle doorloop bouwt de druk vanzelf niet volledig op.",
  },
  {
    id: "sprover",
    label: "Sprover",
    ratioLow: 8,
    ratioHigh: 12,
    ratio: 10,
    timeLow: 30,
    timeHigh: 40,
    lanceOffset: 1.5,
    grindHint: "veel grover",
    description:
      "Filterkoffie uit je espressomachine: een grote kop, veel grover gemalen dan espresso maar nog steeds fijn voor filter.",
  },
];

/**
 * Omrekening van Lance's maler naar die van jou. Uit zijn turbo- en
 * allonge-recept volgt dat een hele stand op zijn maler de doorstroming
 * ongeveer een factor e^2 versnelt. Gedeeld door de gevoeligheid van jouw
 * maler geeft dat het aantal standen dat jij moet verdraaien.
 */
const LANCE_LOG_FLOW_PER_UNIT = 2;

export type StyleEstimate = {
  style: ShotStyle;
  targetYield: number;
  targetTime: number;
  yieldLow: number;
  yieldHigh: number;
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

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * Schat per zetstijl de maalgraad voor deze boon.
 *
 * 1. Bepaal de normale-stand van de boon. Valt de referentie-shot al binnen
 *    het normale-recept, dan is dat gewoon de stand van die shot. Anders
 *    corrigeren we: de doorstroming (gram per seconde) hangt exponentieel af
 *    van de maalgraad, dus we rekenen uit hoeveel fijner of grover nodig is
 *    om binnen het recept te komen.
 * 2. Tel daar per stijl Lance's verschil met zijn normale bij op, omgerekend
 *    naar de standen van jouw maler.
 */
export function estimateStyles(
  beanShots: ShotLog[],
  setup: Setup,
  doseGrams: number,
): StyleEstimates {
  const ref = referenceShot(beanShots);
  const reference =
    ref && ref.extractionTimeSeconds > 0 && ref.yieldGrams > 0 && ref.doseGrams > 0
      ? ref
      : null;
  const fallback = defaultSensitivity(setup);
  const learnedK = reference
    ? learnedSensitivity(beanShots, reference, fallback)
    : null;
  const k = learnedK ?? fallback;

  const normale = SHOT_STYLES.find((s) => s.id === "normale")!;
  let normaleGrind: number | null = null;
  if (reference) {
    const refRatio = reference.yieldGrams / reference.doseGrams;
    const nearestRatio = clamp(refRatio, normale.ratioLow, normale.ratioHigh);
    const nearestTime = clamp(
      reference.extractionTimeSeconds,
      normale.timeLow,
      normale.timeHigh,
    );
    const targetFlow = (reference.doseGrams * nearestRatio) / nearestTime;
    normaleGrind =
      reference.grindSize + Math.log(targetFlow / flowOf(reference)) / k;
  }

  const rows = SHOT_STYLES.map((style): StyleEstimate => {
    const targetYield = Math.round(doseGrams * style.ratio * 10) / 10;
    const targetTime = Math.round((style.timeLow + style.timeHigh) / 2);
    const base = {
      style,
      targetYield,
      targetTime,
      yieldLow: Math.round(doseGrams * style.ratioLow),
      yieldHigh: Math.round(doseGrams * style.ratioHigh),
    };
    if (!reference || normaleGrind === null) {
      return { ...base, grind: null, delta: null, outOfRange: null };
    }
    const raw =
      normaleGrind + (style.lanceOffset * LANCE_LOG_FLOW_PER_UNIT) / k;
    const outOfRange =
      raw < setup.grindMin - setup.grindStep / 2
        ? "fine"
        : raw > setup.grindMax + setup.grindStep / 2
          ? "coarse"
          : null;
    const grind = roundToStep(
      clamp(raw, setup.grindMin, setup.grindMax),
      setup.grindStep,
    );
    return {
      ...base,
      grind,
      delta: Math.round((grind - reference.grindSize) * 100) / 100,
      outOfRange,
    };
  });

  return { rows, reference, learned: learnedK !== null };
}
