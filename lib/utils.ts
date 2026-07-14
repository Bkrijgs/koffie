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

/** Waar-voor-je-geld: wat een gemiddelde ster kost, in euro's per shot.
 *  Lager is beter — je betaalt minder per ster kwaliteit. */
export function costPerStar(
  avgCostPerShot: number,
  avgRating: number,
): number | undefined {
  if (avgCostPerShot <= 0 || avgRating <= 0) return undefined;
  return avgCostPerShot / avgRating;
}

export type PriceTier = "budget" | "midden" | "premium";

/** Vuistregel voor NL-koffieprijzen: supermarkt/aanbieding tot ~€20/kg,
 *  het gangbare specialty-segment tot ~€45/kg, en daarboven premium.
 *  Zo blijft "Premium" gereserveerd voor echt dure zakken i.p.v. elke
 *  standaard specialty-boon. */
const PRICE_TIER_BUDGET_MAX = 20;
const PRICE_TIER_MIDDEN_MAX = 45;

export function priceTier(perKg: number): PriceTier {
  if (perKg <= PRICE_TIER_BUDGET_MAX) return "budget";
  if (perKg <= PRICE_TIER_MIDDEN_MAX) return "midden";
  return "premium";
}

export function costPerShot(doseGrams: number, perKg: number): number {
  return doseGrams * (perKg / 1000);
}

/** Totale bonenkosten van een lijst shots, o.b.v. bonen met prijs + gewicht.
 *  Dial-in shots tellen gewoon mee: die bonen zijn net zo goed verbruikt.
 *  Cadeau-bonen vallen buiten `cost` (jij betaalde er niets voor); hun
 *  geschatte winkelwaarde komt apart terug als `giftCost`/`giftCounted`.
 *  `counted` zegt hoeveel betaalde shots meededen (zonder prijs valt af). */
export function shotsCost(
  shots: ShotLog[],
  beans: Bean[],
): { cost: number; counted: number; giftCost: number; giftCounted: number } {
  const beanById = new Map(beans.map((b) => [b.id, b]));
  let cost = 0;
  let counted = 0;
  let giftCost = 0;
  let giftCounted = 0;
  for (const s of shots) {
    const bean = beanById.get(s.beanId);
    const perKg = bean ? pricePerKg(bean) : undefined;
    if (!bean || perKg === undefined) continue;
    if (bean.gift) {
      giftCost += costPerShot(s.doseGrams, perKg);
      giftCounted += 1;
    } else {
      cost += costPerShot(s.doseGrams, perKg);
      counted += 1;
    }
  }
  return { cost, counted, giftCost, giftCounted };
}

export function isSameMonth(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear()
  );
}

const euroFormat = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export function formatEuro(n: number): string {
  return euroFormat.format(n);
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
