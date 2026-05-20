import type { Setup } from "./types";

/**
 * Default-setup: Sage Barista Express met ingebouwde maler. Wordt gebruikt
 * tot de gebruiker via /instellingen iets aanpast, en als veilige fallback.
 * De maalgraad-schaal van de Express is 1–16 op de buitenring (1 = fijn).
 */
export const DEFAULT_SETUP: Setup = {
  machine: "Sage Barista Express",
  grinder: "Ingebouwde conische maler",
  grindMin: 1,
  grindMax: 16,
  grindStep: 1,
  defaultBasket: "double",
  pressurized: false,
  pressureGauge: true,
  preInfusion: true,
  pid: false,
  weighs: true,
};

/** Leidt het waarschijnlijke basket-type af uit de dose. */
export function basketForDose(doseGrams: number): "single" | "double" {
  return doseGrams >= 14 ? "double" : "single";
}

/** Klem een maalgraad binnen de schaal van de setup. */
export function clampGrind(value: number, setup: Setup): number {
  return Math.min(setup.grindMax, Math.max(setup.grindMin, value));
}
