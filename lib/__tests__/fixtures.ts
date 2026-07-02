import type { Bag, Bean, ShotLog } from "@/lib/types";
import { calcBrewRatio } from "@/lib/utils";

let seq = 0;

export function makeBean(overrides: Partial<Bean> = {}): Bean {
  seq += 1;
  return {
    id: `bean-${seq}`,
    name: `Testboon ${seq}`,
    createdAt: "2026-06-01T08:00:00.000Z",
    ...overrides,
  };
}

export function makeShot(overrides: Partial<ShotLog> = {}): ShotLog {
  seq += 1;
  const doseGrams = overrides.doseGrams ?? 18;
  const yieldGrams = overrides.yieldGrams ?? 36;
  return {
    id: `shot-${seq}`,
    beanId: "bean-1",
    createdAt: "2026-06-10T08:00:00.000Z",
    grindSize: 5,
    doseGrams,
    yieldGrams,
    brewRatio: calcBrewRatio(yieldGrams, doseGrams),
    extractionTimeSeconds: 28,
    rating: 4,
    dialIn: false,
    ...overrides,
  };
}

export function makeBag(overrides: Partial<Bag> = {}): Bag {
  seq += 1;
  return {
    id: `bag-${seq}`,
    beanId: "bean-1",
    grams: 250,
    openedAt: "2026-06-01",
    createdAt: "2026-06-01T08:00:00.000Z",
    ...overrides,
  };
}
