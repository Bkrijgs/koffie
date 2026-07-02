import type { ShotLog } from "./types";

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
  // Datum-strings zonder tijd ("2026-06-10") als lokale datum parsen;
  // new Date(iso) leest ze als UTC-middernacht en kan dan een dag schuiven.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Dag-key (YYYY-MM-DD) in de lokale tijdzone. Niet via toISOString():
 *  dat converteert naar UTC en schuift avond-/nachtshots een dag op. */
export function localDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Menselijke foutmelding uit een onbekende throw-waarde (Error,
 *  Supabase PostgrestError, string), met Nederlandse fallback. */
export function errorMessage(e: unknown, fallback: string): string {
  if (typeof e === "string" && e) return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

export function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
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
