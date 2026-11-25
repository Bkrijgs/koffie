"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Step = { id: string; label: string };

type Props = {
  /** De invoervelden in de volgorde waarin je ze invult. */
  steps: Step[];
};

/**
 * Balk die boven het toetsenbord plakt zolang je in een van de getalvelden
 * staat, met een knop om direct naar het volgende veld te springen. Het
 * cijfertoetsenbord van iOS heeft zelf geen "volgende"-toets, vandaar een
 * eigen knop. Enter (Android, los toetsenbord) doet hetzelfde.
 */
export function FieldStepper({ steps }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);
  const [bottom, setBottom] = useState(0);
  const hideTimer = useRef<number | null>(null);

  const index = steps.findIndex((s) => s.id === activeId);
  const prev = index > 0 ? steps[index - 1] : null;
  const next = index >= 0 && index < steps.length - 1 ? steps[index + 1] : null;

  const focusField = useCallback((id: string) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;
    el.focus();
    // Bestaande waarde selecteren, zodat typen hem meteen vervangt.
    try {
      el.select();
    } catch {
      // Niet elk invoertype ondersteunt select(); dan alleen focus.
    }
  }, []);

  const done = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  }, []);

  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // Bijhouden in welk veld je staat. Het verbergen wacht heel even, zodat een
  // tik op de balk zelf (waarbij het veld kort focus kan verliezen) de balk
  // niet onder je vinger laat verdwijnen.
  useEffect(() => {
    const ids = new Set(steps.map((s) => s.id));

    const onFocusIn = (e: FocusEvent) => {
      const id = (e.target as HTMLElement | null)?.id ?? "";
      if (hideTimer.current !== null) {
        window.clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      setActiveId(ids.has(id) ? id : null);
    };
    const onFocusOut = () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setActiveId(null), 200);
    };
    // Enter springt naar het volgende veld in plaats van het formulier te
    // versturen; op het laatste veld sluit hij het toetsenbord.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const id = (e.target as HTMLElement | null)?.id ?? "";
      const i = steps.findIndex((s) => s.id === id);
      if (i === -1) return;
      e.preventDefault();
      if (i < steps.length - 1) focusField(steps[i + 1].id);
      else (e.target as HTMLElement).blur();
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKeyDown);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, [steps, focusField]);

  // iOS schuift het toetsenbord óver de pagina heen: een element met
  // bottom: 0 verdwijnt er dan achter. Via visualViewport meten we hoeveel
  // van de onderkant is afgedekt en tillen de balk daarboven.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setBottom(
        Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)),
      );
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  if (!touch || index === -1) return null;

  // Voorkomt dat de tik het veld zijn focus afpakt, zodat het toetsenbord
  // open blijft terwijl we naar het volgende veld springen.
  const keepFocus = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <div
      className="veld-stapper fixed inset-x-0 z-50 flex items-center gap-2 border-t border-line bg-card px-3 py-2 shadow-lift"
      style={{ bottom }}
    >
      {/* Op iOS zweven de adresbalk en de toetsenbordbalk van Safari tussen
          deze balk en het toetsenbord. Dit vlak vult die ruimte, zodat de
          pagina er niet doorheen schemert. Elders valt het buiten beeld. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-full h-48 bg-card"
      />
      <button
        type="button"
        disabled={!prev}
        onPointerDown={keepFocus}
        onMouseDown={keepFocus}
        onClick={() => prev && focusField(prev.id)}
        aria-label={prev ? `Vorige veld: ${prev.label}` : "Vorige veld"}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line text-ink-600 transition active:scale-95 disabled:opacity-30"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      <span className="min-w-0 flex-1 truncate text-center text-[11px] uppercase tracking-[0.14em] text-ink-400">
        {steps[index].label} · {index + 1}/{steps.length}
      </span>

      <button
        type="button"
        onPointerDown={keepFocus}
        onMouseDown={keepFocus}
        onClick={() => (next ? focusField(next.id) : done())}
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-ink-800 px-4 text-sm font-medium text-paper transition active:scale-95"
      >
        {next ? (
          <>
            <span>{next.label}</span>
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </>
        ) : (
          <span>Klaar</span>
        )}
      </button>
    </div>
  );
}
