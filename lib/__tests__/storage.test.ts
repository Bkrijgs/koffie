import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localStorageBackend } from "@/lib/storage";
import type { ShotInput } from "@/lib/types";

function fakeLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
}

const SHOT_INPUT: ShotInput = {
  beanId: "bean-1",
  grindSize: 5,
  doseGrams: 18,
  yieldGrams: 36,
  extractionTimeSeconds: 28,
  rating: 4,
  dialIn: false,
};

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: fakeLocalStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("localStorageBackend shots", () => {
  it("slaat een shot op met afgeleide brew ratio", async () => {
    const shot = await localStorageBackend.addShot(SHOT_INPUT);
    expect(shot.brewRatio).toBe(2);
    expect(await localStorageBackend.listShots()).toEqual([shot]);
  });

  it("werkt een shot bij en herberekent de ratio", async () => {
    const shot = await localStorageBackend.addShot(SHOT_INPUT);
    const updated = await localStorageBackend.updateShot(shot.id, {
      ...SHOT_INPUT,
      yieldGrams: 45,
    });
    expect(updated.brewRatio).toBe(2.5);
    expect(await localStorageBackend.listShots()).toEqual([updated]);
  });

  it("verwijdert een shot", async () => {
    const keep = await localStorageBackend.addShot(SHOT_INPUT);
    const gone = await localStorageBackend.addShot(SHOT_INPUT);
    await localStorageBackend.deleteShot(gone.id);
    const left = await localStorageBackend.listShots();
    expect(left.map((s) => s.id)).toEqual([keep.id]);
  });

  it("gooit een fout bij verwijderen van een onbekende shot", async () => {
    await expect(localStorageBackend.deleteShot("bestaat-niet")).rejects.toThrow(
      "Shot niet gevonden",
    );
  });
});
