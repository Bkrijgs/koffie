"use client";

import { useKoffie } from "@/lib/useKoffie";

/**
 * Laad-/foutweergave voor pagina's die op useKoffie wachten. Toont
 * "Laden…" zolang de data onderweg is, en een foutmelding met
 * retry-knop als de init mislukte (i.p.v. eeuwig te blijven laden).
 */
export function LoadState() {
  const { error, retry } = useKoffie();

  if (!error) {
    return <p className="text-sm text-ink-300">Laden…</p>;
  }

  return (
    <div className="rounded-xl2 border border-line bg-card p-5 shadow-soft">
      <p className="text-sm font-medium text-ink-800">Laden mislukt</p>
      <p className="mt-1 text-xs text-ink-400">{error}</p>
      <button
        type="button"
        onClick={retry}
        className="mt-3 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-600 transition hover:bg-ink-50/40"
      >
        Opnieuw proberen
      </button>
    </div>
  );
}
