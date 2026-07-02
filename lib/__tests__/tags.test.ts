import { describe, expect, it } from "vitest";
import { sanitizeTags, TASTE_TAGS } from "@/lib/tags";

describe("sanitizeTags", () => {
  it("geeft een lege lijst voor niet-arrays", () => {
    expect(sanitizeTags(null)).toEqual([]);
    expect(sanitizeTags(undefined)).toEqual([]);
    expect(sanitizeTags("fruitig")).toEqual([]);
  });

  it("houdt alleen bekende taste-tags over", () => {
    expect(sanitizeTags(["fruitig", "onzin", 5, null, "zoet"])).toEqual([
      "fruitig",
      "zoet",
    ]);
  });

  it("accepteert alle gedefinieerde tags", () => {
    expect(sanitizeTags([...TASTE_TAGS])).toEqual([...TASTE_TAGS]);
  });
});
