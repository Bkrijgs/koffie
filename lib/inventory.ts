import type { Bag, ShotLog } from "./types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type BagStats = {
  bag: Bag;
  isOpen: boolean;
  shots: ShotLog[];
  usedGrams: number;
  remainingGrams: number;
  daysOpen: number;
  gramsPerDay: number;
  shotsPerDay: number;
  projectedDaysLeft: number | null;
  projectedEndDate: string | null;
};

/**
 * Attribute shots to a bag based on the createdAt timestamp falling
 * inside the bag's open window. For an open bag the window extends to now.
 */
export function shotsInBag(bag: Bag, shots: ShotLog[]): ShotLog[] {
  const start = +new Date(bag.openedAt);
  const end = bag.finishedAt
    ? +new Date(bag.finishedAt) + MS_PER_DAY // include the entire finish day
    : Date.now();
  return shots.filter((s) => {
    const t = +new Date(s.createdAt);
    return s.beanId === bag.beanId && t >= start && t <= end;
  });
}

export function bagStats(bag: Bag, shots: ShotLog[]): BagStats {
  const isOpen = !bag.finishedAt;
  const ownShots = shotsInBag(bag, shots);
  const usedGrams = ownShots.reduce((sum, s) => sum + s.doseGrams, 0);
  const remainingGrams = Math.max(0, bag.grams - usedGrams);

  const start = new Date(bag.openedAt);
  const endRef = bag.finishedAt ? new Date(bag.finishedAt) : new Date();
  const daysOpen = Math.max(
    1,
    Math.floor((+endRef - +start) / MS_PER_DAY) + 1,
  );

  const gramsPerDay = usedGrams / daysOpen;
  const shotsPerDay = ownShots.length / daysOpen;

  let projectedDaysLeft: number | null = null;
  let projectedEndDate: string | null = null;
  if (isOpen && gramsPerDay > 0) {
    projectedDaysLeft = Math.round(remainingGrams / gramsPerDay);
    projectedEndDate = new Date(
      Date.now() + projectedDaysLeft * MS_PER_DAY,
    ).toISOString();
  }

  return {
    bag,
    isOpen,
    shots: ownShots,
    usedGrams,
    remainingGrams,
    daysOpen,
    gramsPerDay,
    shotsPerDay,
    projectedDaysLeft,
    projectedEndDate,
  };
}

/**
 * Find the currently-open bag for a bean, if any. Returns the most recently
 * opened one if multiple are open (shouldn't normally happen).
 */
export function openBagFor(beanId: string, bags: Bag[]): Bag | undefined {
  return bags
    .filter((b) => b.beanId === beanId && !b.finishedAt)
    .sort((a, b) => +new Date(b.openedAt) - +new Date(a.openedAt))[0];
}
