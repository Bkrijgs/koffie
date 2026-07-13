import type { Bean, ShotLog } from "./types";

/**
 * Filter out shots that the user marked as a dial-in attempt. Use this
 * everywhere we aggregate or sort by rating so dial-in shots stay
 * visible in lists but never skew averages, top-shot detection or trends.
 */
export function effectiveShots(shots: ShotLog[]): ShotLog[] {
  return shots.filter((s) => !s.dialIn);
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function calcBrewRatio(yieldGrams: number, doseGrams: number): number {
  if (!doseGrams || doseGrams <= 0) return 0;
  return Math.round((yieldGrams / doseGrams) * 100) / 100;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateOnly(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Parse gebruikersinvoer als positief getal; accepteert een Nederlandse komma. */
export function parseDecimal(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

export function pricePerKg(bean: Bean): number | undefined {
  const { priceEuros, bagWeightGrams } = bean;
  if (!priceEuros || priceEuros <= 0) return undefined;
  if (!bagWeightGrams || bagWeightGrams <= 0) return undefined;
  return priceEuros / (bagWeightGrams / 1000);
}

/** Prijs/kwaliteit: gemiddelde rating per €10/kg (raw ★ per €/kg is te klein). */
export function valueScore(
  avgRating: number,
  perKg: number,
): number | undefined {
  if (avgRating <= 0 || perKg <= 0) return undefined;
  return avgRating / (perKg / 10);
}

export type PriceTier = "budget" | "midden" | "premium";

/** Vuistregel voor NL-koffieprijzen: rond supermarktniveau tot ~€25/kg,
 *  het gangbare specialty-segment tot ~€40/kg, en daarboven premium. */
const PRICE_TIER_BUDGET_MAX = 25;
const PRICE_TIER_MIDDEN_MAX = 40;

export function priceTier(perKg: number): PriceTier {
  if (perKg <= PRICE_TIER_BUDGET_MAX) return "budget";
  if (perKg <= PRICE_TIER_MIDDEN_MAX) return "midden";
  return "premium";
}

export function costPerShot(doseGrams: number, perKg: number): number {
  return doseGrams * (perKg / 1000);
}

const euroFormat = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export function formatEuro(n: number): string {
  return euroFormat.format(n);
}

const scoreFormat = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatScore(n: number): string {
  return scoreFormat.format(n);
}

export function mode<T extends string | number>(values: T[]): T | undefined {
  if (values.length === 0) return undefined;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | undefined;
  let bestCount = -1;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      bestCount = c;
      best = v;
    }
  }
  return best;
}
