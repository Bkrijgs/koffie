import { describe, expect, it } from "vitest";
import { basketForDose, clampGrind, DEFAULT_SETUP } from "@/lib/setup";

describe("clampGrind", () => {
  it("klemt binnen de schaal van de maler", () => {
    expect(clampGrind(0, DEFAULT_SETUP)).toBe(DEFAULT_SETUP.grindMin);
    expect(clampGrind(99, DEFAULT_SETUP)).toBe(DEFAULT_SETUP.grindMax);
    expect(clampGrind(8, DEFAULT_SETUP)).toBe(8);
  });
});

describe("basketForDose", () => {
  it("kiest double vanaf 14 g, anders single", () => {
    expect(basketForDose(14)).toBe("double");
    expect(basketForDose(18)).toBe("double");
    expect(basketForDose(13.9)).toBe("single");
  });
});
