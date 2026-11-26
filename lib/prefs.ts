"use client";

import { useEffect, useState } from "react";

/**
 * Weergave-voorkeuren. Per apparaat bewaard in localStorage (net als de
 * skin), zodat ze geen database-migratie nodig hebben.
 */
export type Prefs = {
  /** Zetstijlen (ristretto, turbo, ...) tonen in het shotformulier. */
  showStyles: boolean;
  /** Grafieken, tips, heatmap en AI-coach tonen. */
  showStats: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  showStyles: false,
  showStats: false,
};

const PREFS_KEY = "koffie:prefs:v1";
const PREFS_EVENT = "koffie:prefs-change";

function readPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      showStyles:
        typeof parsed.showStyles === "boolean"
          ? parsed.showStyles
          : DEFAULT_PREFS.showStyles,
      showStats:
        typeof parsed.showStats === "boolean"
          ? parsed.showStats
          : DEFAULT_PREFS.showStats,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  const next = { ...readPrefs(), [key]: value };
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // localStorage niet beschikbaar: de keuze geldt dan niet na herladen.
  }
  window.dispatchEvent(new Event(PREFS_EVENT));
}

/** Leest de voorkeuren en volgt wijzigingen, ook vanuit een ander tabblad. */
export function usePrefs(): Prefs {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    const sync = () => setPrefs(readPrefs());
    sync();
    window.addEventListener(PREFS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PREFS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return prefs;
}
