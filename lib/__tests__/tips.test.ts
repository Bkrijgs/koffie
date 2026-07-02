import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { globalTips, moodForTips, tipsForBean, tipsForShot } from "@/lib/tips";
import type { Tip } from "@/lib/tips";
import { makeBean, makeShot } from "./fixtures";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T10:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

function ids(tips: Tip[]): string[] {
  return tips.map((t) => t.id);
}

describe("tipsForBean", () => {
  const bean = makeBean({ id: "bean-1", name: "Testboon" });

  it("geeft een onboarding-tip zonder effectieve shots", () => {
    expect(ids(tipsForBean(bean, []))).toEqual(["first"]);
    // Alleen-dial-in telt ook als "nog geen echte shots".
    const dialOnly = [makeShot({ beanId: "bean-1", dialIn: true })];
    expect(ids(tipsForBean(bean, dialOnly))).toEqual(["first"]);
  });

  it("geeft baseline + beste shot bij precies één shot", () => {
    const shots = [makeShot({ beanId: "bean-1", rating: 3 })];
    const result = ids(tipsForBean(bean, shots));
    expect(result).toContain("baseline");
    expect(result).toContain("best-shot");
  });

  it("adviseert fijner malen als recente shots te snel lopen", () => {
    // Ratings < 4 zodat er geen geleerde sweet spot is en de
    // vuistregel-grens (25s) geldt.
    const shots = [
      makeShot({ beanId: "bean-1", rating: 3, extractionTimeSeconds: 19 }),
      makeShot({ beanId: "bean-1", rating: 3, extractionTimeSeconds: 20 }),
      makeShot({ beanId: "bean-1", rating: 3, extractionTimeSeconds: 18 }),
    ];
    expect(ids(tipsForBean(bean, shots))).toContain("time-fast");
  });

  it("prijst drie goede shots op rij", () => {
    const shots = [4.5, 4.5, 5].map((rating) =>
      makeShot({ beanId: "bean-1", rating: rating as 4.5 | 5 }),
    );
    expect(ids(tipsForBean(bean, shots))).toContain("streak");
  });

  it("waarschuwt voor oude bonen", () => {
    const oldBean = makeBean({
      id: "bean-1",
      name: "Oud",
      roastDate: "2026-04-01",
    });
    const shots = [makeShot({ beanId: "bean-1", rating: 3 })];
    expect(ids(tipsForBean(oldBean, shots))).toContain("too-old");
  });

  it("geeft maximaal drie tips", () => {
    const oldBean = makeBean({
      id: "bean-1",
      name: "Oud",
      roastDate: "2026-04-01",
    });
    const shots = [
      makeShot({ beanId: "bean-1", rating: 3, extractionTimeSeconds: 18 }),
      makeShot({ beanId: "bean-1", rating: 3, extractionTimeSeconds: 19 }),
      makeShot({ beanId: "bean-1", rating: 3, extractionTimeSeconds: 20 }),
    ];
    expect(tipsForBean(oldBean, shots).length).toBeLessThanOrEqual(3);
  });
});

describe("globalTips", () => {
  it("stuurt onboarding zonder bonen of shots", () => {
    expect(ids(globalTips([], []))).toEqual(["no-beans"]);
    expect(ids(globalTips([makeBean()], []))).toEqual(["no-shots"]);
  });

  it("behandelt alleen-dial-in shots als onboarding", () => {
    const bean = makeBean({ id: "bean-1" });
    const tips = globalTips(
      [bean],
      [makeShot({ beanId: "bean-1", dialIn: true })],
    );
    expect(ids(tips)).toEqual(["no-shots"]);
    expect(tips[0].text).toContain("dial-in");
  });

  it("viert een shots-milestone", () => {
    const bean = makeBean({ id: "bean-1" });
    const shots = Array.from({ length: 10 }, (_, i) =>
      makeShot({
        beanId: "bean-1",
        createdAt: `2026-06-${String(14 - i).padStart(2, "0")}T08:00:00.000Z`,
      }),
    );
    expect(ids(globalTips([bean], shots))).toContain("milestone-shots");
  });
});

describe("tipsForShot", () => {
  it("markeert een snelle shot", () => {
    const shot = makeShot({ extractionTimeSeconds: 20 });
    expect(ids(tipsForShot(shot, undefined, []))).toContain("shot-time-fast");
  });

  it("herkent de sweet spot bij goede rating en nette tijd", () => {
    const shot = makeShot({ extractionTimeSeconds: 28, rating: 4.5 });
    expect(ids(tipsForShot(shot, undefined, []))).toContain("shot-time-sweet");
  });

  it("valt terug op een neutrale tip", () => {
    const shot = makeShot({ extractionTimeSeconds: 28, rating: 3 });
    expect(ids(tipsForShot(shot, undefined, []))).toEqual(["shot-neutral"]);
  });
});

describe("moodForTips", () => {
  it("kiest de mood op tip-prioriteit", () => {
    expect(moodForTips([{ id: "no-beans", kind: "info", text: "" }])).toBe(
      "wave",
    );
    expect(moodForTips([{ id: "streak", kind: "praise", text: "" }])).toBe(
      "celebrate",
    );
    expect(moodForTips([{ id: "x", kind: "praise", text: "" }])).toBe("happy");
    expect(moodForTips([{ id: "x", kind: "warn", text: "" }])).toBe(
      "concerned",
    );
    expect(moodForTips([{ id: "x", kind: "tweak", text: "" }])).toBe("think");
  });
});
