import { describe, expect, it } from "vitest";
import {
  average,
  calcBrewRatio,
  effectiveShots,
  errorMessage,
  formatDateOnly,
  localDateKey,
  mode,
} from "@/lib/utils";
import { makeShot } from "./fixtures";

describe("calcBrewRatio", () => {
  it("berekent yield/dose afgerond op twee decimalen", () => {
    expect(calcBrewRatio(36, 18)).toBe(2);
    expect(calcBrewRatio(37, 18)).toBe(2.06);
  });

  it("geeft 0 bij ontbrekende of ongeldige dose", () => {
    expect(calcBrewRatio(36, 0)).toBe(0);
    expect(calcBrewRatio(36, -1)).toBe(0);
  });
});

describe("average", () => {
  it("geeft 0 voor een lege lijst", () => {
    expect(average([])).toBe(0);
  });

  it("middelt de waarden", () => {
    expect(average([1, 2, 3])).toBe(2);
    expect(average([4, 4.5])).toBe(4.25);
  });
});

describe("mode", () => {
  it("geeft undefined voor een lege lijst", () => {
    expect(mode([])).toBeUndefined();
  });

  it("geeft de vaakst voorkomende waarde", () => {
    expect(mode([5, 6, 6, 7])).toBe(6);
  });

  it("geeft bij gelijkspel de eerst geziene waarde", () => {
    expect(mode([5, 5, 6, 6])).toBe(5);
  });
});

describe("effectiveShots", () => {
  it("filtert dial-in shots eruit", () => {
    const real = makeShot({ dialIn: false });
    const dial = makeShot({ dialIn: true });
    expect(effectiveShots([real, dial])).toEqual([real]);
  });
});

describe("localDateKey", () => {
  it("formatteert met zero-padding", () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(localDateKey(new Date(2026, 10, 30))).toBe("2026-11-30");
  });

  it("gebruikt de lokale dag, niet de UTC-dag", () => {
    // 2026-06-09T23:30 lokale tijd is 2026-06-09T21:30Z in de zomer —
    // toISOString().slice(0,10) zou hier ook "2026-06-09" geven, maar
    // net ná lokale middernacht loopt UTC een dag achter.
    const justAfterMidnight = new Date(2026, 5, 10, 0, 30);
    expect(justAfterMidnight.toISOString().slice(0, 10)).toBe("2026-06-09");
    expect(localDateKey(justAfterMidnight)).toBe("2026-06-10");
  });

  it("is consistent met een shot-createdAt uit de database (UTC)", () => {
    // 22:30Z in juni = 00:30 lokale tijd de volgende dag (CEST).
    const fromDb = new Date("2026-06-09T22:30:00.000Z");
    expect(localDateKey(fromDb)).toBe("2026-06-10");
  });
});

describe("formatDateOnly", () => {
  it("geeft lege string zonder input", () => {
    expect(formatDateOnly(undefined)).toBe("");
    expect(formatDateOnly("")).toBe("");
  });

  it("toont een datum-string zonder tijd als lokale datum", () => {
    // Zou zonder lokale parsing westelijk van UTC een dag terugschuiven.
    expect(formatDateOnly("2026-06-10")).toContain("10");
    expect(formatDateOnly("2026-06-10")).toContain("2026");
  });
});

describe("errorMessage", () => {
  it("pakt de message van een Error", () => {
    expect(errorMessage(new Error("kapot"), "fallback")).toBe("kapot");
  });

  it("pakt message van een object (PostgrestError-vorm)", () => {
    expect(errorMessage({ message: "rls denied" }, "fallback")).toBe(
      "rls denied",
    );
  });

  it("valt terug bij onbruikbare input", () => {
    expect(errorMessage(null, "fallback")).toBe("fallback");
    expect(errorMessage({}, "fallback")).toBe("fallback");
    expect(errorMessage(new Error(""), "fallback")).toBe("fallback");
  });
});
