import type { Setup, ShotLog } from "./types";

/**
 * Smaakkompas. Een shot krijgt een plek op twee assen:
 *
 *   x: zuur (onderextractie, -1)  ...  bitter (overextractie, +1)
 *   y: waterig (-1)               ...  zwaar (+1)
 *
 * Het midden is raak. Uit de plek volgt welke knop je de volgende keer
 * omdraait. Per kwadrant is er één knop die beide assen tegelijk goed zet:
 *
 *   zuur + zwaar      meer yield     (meer extractie, minder sterk)
 *   bitter + waterig  minder yield   (minder extractie, sterker)
 *   zuur + waterig    fijner malen   (meer extractie, sterker)
 *   bitter + zwaar    grover malen   (minder extractie, minder sterk)
 */

/** Binnen deze straal telt een shot als raak. */
export const ON_TARGET_RADIUS = 0.22;
/** Een as telt pas mee als de afwijking groter is dan dit. */
const AXIS_THRESHOLD = 0.2;
/** Voorbij deze afstand tot het midden doen we een grotere stap. */
const BIG_STEP_RADIUS = 0.6;

export type TastePoint = { x: number; y: number };

export type CompassLever =
  | "none"
  | "grind"
  | "yield"
  | "dose"
  | "water";

export type CompassAdvice = {
  lever: CompassLever;
  /** Korte opdracht, bv. "Fijner malen". */
  title: string;
  /** De concrete verandering, bv. "stand 5 → 4". */
  change?: string;
  /** Waarom, in één zin. */
  reason: string;
  /** Waarden om in het formulier van de volgende shot te zetten. */
  next: {
    grindSize?: number;
    yieldGrams?: number;
    doseGrams?: number;
    waterGrams?: number;
  };
};

export function tasteOf(shot: ShotLog): TastePoint | null {
  if (typeof shot.tasteX !== "number" || typeof shot.tasteY !== "number") {
    return null;
  }
  return { x: shot.tasteX, y: shot.tasteY };
}

/** Beschrijft een plek in woorden, bv. "zuur en zwaar" of "raak". */
export function describeTaste(p: TastePoint): string {
  if (Math.hypot(p.x, p.y) < ON_TARGET_RADIUS) return "raak";
  const parts: string[] = [];
  if (p.x <= -AXIS_THRESHOLD) parts.push("zuur");
  if (p.x >= AXIS_THRESHOLD) parts.push("bitter");
  if (p.y >= AXIS_THRESHOLD) parts.push("zwaar");
  if (p.y <= -AXIS_THRESHOLD) parts.push("waterig");
  return parts.length > 0 ? parts.join(" en ") : "bijna raak";
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function roundToStep(value: number, step: number): number {
  const s = step > 0 ? step : 1;
  return Math.round(Math.round(value / s) * s * 100) / 100;
}

/**
 * Advies voor de volgende shot, op basis van waar deze shot op het kompas
 * zat. Geeft null als de shot geen kompaspositie heeft.
 */
export function compassAdvice(
  shot: ShotLog,
  setup: Setup,
): CompassAdvice | null {
  const p = tasteOf(shot);
  if (!p) return null;

  const r = Math.hypot(p.x, p.y);
  if (r < ON_TARGET_RADIUS) {
    return {
      lever: "none",
      title: "Raak",
      reason: "Deze shot zat in het midden. Houd dit recept aan.",
      next: {},
    };
  }

  const big = r >= BIG_STEP_RADIUS;
  const xOff = Math.abs(p.x) >= AXIS_THRESHOLD;
  const yOff = Math.abs(p.y) >= AXIS_THRESHOLD;
  const sameSign = Math.sign(p.x) === Math.sign(p.y);
  const taste = describeTaste(p);

  // Alleen de sterkte wijkt af en er zat water bij: dan is het water de
  // makkelijkste knop, niet het recept van de shot zelf.
  if (yOff && !xOff && shot.waterGrams && shot.waterGrams > 0) {
    const delta = Math.max(5, Math.round((shot.waterGrams * (big ? 0.4 : 0.2)) / 5) * 5);
    const next = Math.max(0, shot.waterGrams + (p.y > 0 ? delta : -delta));
    return {
      lever: "water",
      title: p.y > 0 ? "Meer water erbij" : "Minder water erbij",
      change: `${fmt(shot.waterGrams)} → ${fmt(next)} g`,
      reason: `De shot was ${taste}, maar qua extractie goed. Stel dat bij met het water, niet met het recept.`,
      next: { waterGrams: next },
    };
  }

  // Yield: bij zuur + zwaar, bitter + waterig, of alleen sterkte.
  if (yOff && (!xOff || !sameSign)) {
    const more = p.y > 0;
    const delta = Math.max(1, Math.round(shot.doseGrams * (big ? 0.4 : 0.2)));
    const next = Math.max(1, Math.round(shot.yieldGrams + (more ? delta : -delta)));
    return {
      lever: "yield",
      title: more ? "Langer laten doorlopen" : "Eerder stoppen",
      change: `yield ${fmt(shot.yieldGrams)} → ${fmt(next)} g`,
      reason: more
        ? `De shot was ${taste}. Meer yield maakt hem minder sterk en haalt meer uit de koffie.`
        : `De shot was ${taste}. Minder yield maakt hem sterker en haalt minder uit de koffie.`,
      next: { yieldGrams: next },
    };
  }

  // Maalgraad: bij zuur + waterig, bitter + zwaar, of alleen extractie.
  const finer = p.x < 0;
  const steps = (big ? 2 : 1) * (setup.grindStep > 0 ? setup.grindStep : 1);
  const wanted = shot.grindSize + (finer ? -steps : steps);
  const clamped = roundToStep(
    Math.min(setup.grindMax, Math.max(setup.grindMin, wanted)),
    setup.grindStep,
  );

  if (clamped === shot.grindSize) {
    // De maler zit aan zijn grens. De dose doet dan ongeveer hetzelfde:
    // meer koffie remt de doorloop, minder koffie versnelt hem.
    const next = Math.round((shot.doseGrams + (finer ? 0.5 : -0.5)) * 10) / 10;
    return {
      lever: "dose",
      title: finer ? "Dose omhoog" : "Dose omlaag",
      change: `dose ${fmt(shot.doseGrams)} → ${fmt(next)} g`,
      reason: finer
        ? `De shot was ${taste}, maar je maler staat al op de fijnste stand (${fmt(shot.grindSize)}). Meer koffie in het filter remt de doorloop ook af.`
        : `De shot was ${taste}, maar je maler staat al op de grofste stand (${fmt(shot.grindSize)}). Minder koffie in het filter versnelt de doorloop ook.`,
      next: { doseGrams: next },
    };
  }

  return {
    lever: "grind",
    title: finer ? "Fijner malen" : "Grover malen",
    change: `stand ${fmt(shot.grindSize)} → ${fmt(clamped)}`,
    reason: finer
      ? `De shot was ${taste}. Fijner malen haalt meer uit de koffie en maakt hem voller.`
      : `De shot was ${taste}. Grover malen haalt minder uit de koffie en maakt hem lichter.`,
    next: { grindSize: clamped },
  };
}

/** De shots van een boon die een kompaspositie hebben, oudste eerst. */
export function tasteTrail(beanShots: ShotLog[], limit = 8): ShotLog[] {
  return beanShots
    .filter((s) => tasteOf(s) !== null)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    .slice(-limit);
}
