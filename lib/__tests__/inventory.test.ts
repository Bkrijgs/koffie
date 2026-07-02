import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bagStats, openBagFor, shotsInBag } from "@/lib/inventory";
import { makeBag, makeShot } from "./fixtures";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T10:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("shotsInBag", () => {
  const bag = makeBag({
    beanId: "bean-1",
    openedAt: "2026-06-01",
    finishedAt: "2026-06-10",
  });

  it("telt shots binnen het open-venster mee, inclusief de sluitdag", () => {
    const inWindow = makeShot({
      beanId: "bean-1",
      createdAt: "2026-06-05T09:00:00.000Z",
    });
    const onFinishDay = makeShot({
      beanId: "bean-1",
      createdAt: "2026-06-10T20:00:00.000Z",
    });
    expect(shotsInBag(bag, [inWindow, onFinishDay])).toEqual([
      inWindow,
      onFinishDay,
    ]);
  });

  it("sluit shots buiten het venster en van andere bonen uit", () => {
    const before = makeShot({
      beanId: "bean-1",
      createdAt: "2026-05-31T09:00:00.000Z",
    });
    const after = makeShot({
      beanId: "bean-1",
      createdAt: "2026-06-11T12:00:00.000Z",
    });
    const otherBean = makeShot({
      beanId: "bean-2",
      createdAt: "2026-06-05T09:00:00.000Z",
    });
    expect(shotsInBag(bag, [before, after, otherBean])).toEqual([]);
  });

  it("laat het venster van een open zak doorlopen tot nu", () => {
    const open = makeBag({ beanId: "bean-1", openedAt: "2026-06-01" });
    const recent = makeShot({
      beanId: "bean-1",
      createdAt: "2026-06-15T08:00:00.000Z",
    });
    expect(shotsInBag(open, [recent])).toEqual([recent]);
  });
});

describe("bagStats", () => {
  it("berekent verbruik, restant en projectie voor een open zak", () => {
    const bag = makeBag({
      beanId: "bean-1",
      grams: 250,
      openedAt: "2026-06-01",
    });
    const shots = [
      makeShot({
        beanId: "bean-1",
        doseGrams: 18,
        createdAt: "2026-06-05T09:00:00.000Z",
      }),
      makeShot({
        beanId: "bean-1",
        doseGrams: 18,
        createdAt: "2026-06-10T09:00:00.000Z",
      }),
    ];
    const stats = bagStats(bag, shots);
    expect(stats.isOpen).toBe(true);
    expect(stats.usedGrams).toBe(36);
    expect(stats.remainingGrams).toBe(214);
    // 1 juni t/m 15 juni = 15 dagen open.
    expect(stats.daysOpen).toBe(15);
    expect(stats.gramsPerDay).toBeCloseTo(36 / 15);
    expect(stats.projectedDaysLeft).toBe(Math.round(214 / (36 / 15)));
    expect(stats.projectedEndDate).not.toBeNull();
  });

  it("klemt het restant op 0 en geeft geen projectie zonder verbruik", () => {
    const bag = makeBag({
      beanId: "bean-1",
      grams: 30,
      openedAt: "2026-06-01",
    });
    const overshoot = bagStats(bag, [
      makeShot({
        beanId: "bean-1",
        doseGrams: 18,
        createdAt: "2026-06-05T09:00:00.000Z",
      }),
      makeShot({
        beanId: "bean-1",
        doseGrams: 18,
        createdAt: "2026-06-06T09:00:00.000Z",
      }),
    ]);
    expect(overshoot.remainingGrams).toBe(0);

    const untouched = bagStats(bag, []);
    expect(untouched.projectedDaysLeft).toBeNull();
    expect(untouched.projectedEndDate).toBeNull();
  });

  it("gebruikt de sluitdatum als eindpunt voor een dichte zak", () => {
    const bag = makeBag({
      beanId: "bean-1",
      openedAt: "2026-06-01",
      finishedAt: "2026-06-10",
    });
    const stats = bagStats(bag, []);
    expect(stats.isOpen).toBe(false);
    expect(stats.daysOpen).toBe(10);
    expect(stats.projectedDaysLeft).toBeNull();
  });
});

describe("openBagFor", () => {
  it("kiest de meest recent geopende open zak en negeert dichte zakken", () => {
    const finished = makeBag({
      beanId: "bean-1",
      openedAt: "2026-05-01",
      finishedAt: "2026-05-20",
    });
    const older = makeBag({ beanId: "bean-1", openedAt: "2026-05-25" });
    const newest = makeBag({ beanId: "bean-1", openedAt: "2026-06-05" });
    const otherBean = makeBag({ beanId: "bean-2", openedAt: "2026-06-10" });

    expect(openBagFor("bean-1", [finished, older, newest, otherBean])).toBe(
      newest,
    );
    expect(openBagFor("bean-3", [finished, older, newest])).toBeUndefined();
  });
});
