/**
 * Gestructureerd advies van de LLM-coach voor de volgende shot.
 * Gedeeld tussen de API-route (app/api/coach) en de UI (CoachCard).
 */
export type ShotAdvice = {
  /** Korte kernboodschap, één regel. */
  headline: string;
  /** Voorgestelde recept-waarden voor de volgende shot. */
  grindSize: number;
  doseGrams: number;
  yieldGrams: number;
  targetTimeSeconds: number;
  /** 2–4 korte bullets met de redenering. */
  rationale: string[];
  /** Waar de gebruiker bij de volgende shot op moet letten/proeven. */
  watchFor: string;
  confidence: "laag" | "gemiddeld" | "hoog";
};
