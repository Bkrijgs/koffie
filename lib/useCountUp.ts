"use client";

import { useEffect, useState } from "react";

type Options = {
  /** Ease-in delay in ms voordat de telling begint. Default 0. */
  delay?: number;
  /** Duur van de telling in ms. Default 800. */
  duration?: number;
  /** Aantal decimalen om te tonen. Default 0 (integer). */
  decimals?: number;
};

/**
 * Telt vloeiend van 0 naar `target` met ease-out cubic. Geeft een
 * geformatteerde string terug zodat callers 'm direct kunnen renderen.
 * Respecteert prefers-reduced-motion door direct op `target` te springen.
 */
export function useCountUp(target: number, options: Options = {}): string {
  const { delay = 0, duration = 800, decimals = 0 } = options;
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      setValue(target);
      return;
    }
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || !isFinite(target) || target <= 0) {
      setValue(target);
      return;
    }

    let raf = 0;
    let startTimer = 0;
    const animate = (now: number, startTime: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) {
        raf = window.requestAnimationFrame((n) => animate(n, startTime));
      }
    };

    startTimer = window.setTimeout(() => {
      const start = performance.now();
      raf = window.requestAnimationFrame((n) => animate(n, start));
    }, delay);

    return () => {
      window.clearTimeout(startTimer);
      window.cancelAnimationFrame(raf);
    };
  }, [target, delay, duration]);

  return decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
}
