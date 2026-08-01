/** Antwoord van /api/caffeine: AI-schatting van het cafeïnegehalte
 *  van een boon, plus korte uitleg en zekerheid. */
export type CaffeineEstimate = {
  /** mg cafeïne per gram gemalen koffie in het kopje (espresso-extractie). */
  mgPerGram: number;
  /** Eén korte NL-zin met de redenering (bijv. "100% arabica, ~10 mg/g"). */
  note: string;
  confidence: "laag" | "gemiddeld" | "hoog";
};
