export const TASTE_TAGS = [
  "fruitig",
  "bessen",
  "citrus",
  "noten",
  "chocolade",
  "karamel",
  "bloemig",
  "kruidig",
  "zuur",
  "bitter",
  "zoet",
  "vol",
] as const;

export type TasteTag = (typeof TASTE_TAGS)[number];

export function sanitizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set<string>(TASTE_TAGS);
  return input.filter(
    (t): t is string => typeof t === "string" && allowed.has(t),
  );
}
