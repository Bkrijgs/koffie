"use client";

import { setPref, usePrefs, type Prefs } from "@/lib/prefs";

const OPTIONS: { key: keyof Prefs; label: string; hint: string }[] = [
  {
    key: "showStats",
    label: "Statistiek en coach",
    hint: "Tellers, tips, activiteit, grafieken en de AI-coach. Uit: het smaakkompas staat centraal.",
  },
  {
    key: "showStyles",
    label: "Zetstijlen",
    hint: "Ristretto, lungo, turbo en de rest in het shotformulier, met geschatte maalgraad.",
  },
];

export function PrefsToggles() {
  const prefs = usePrefs();

  return (
    <div className="space-y-2">
      {OPTIONS.map((o) => (
        <label
          key={o.key}
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-sm"
        >
          <input
            type="checkbox"
            checked={prefs[o.key]}
            onChange={(e) => setPref(o.key, e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-ink-800"
          />
          <span className="min-w-0 flex-1">
            <span className="font-medium text-ink-800">{o.label}</span>
            <span className="block text-xs text-ink-400">{o.hint}</span>
          </span>
        </label>
      ))}
      <p className="text-xs text-ink-300">
        Deze keuzes gelden voor dit apparaat.
      </p>
    </div>
  );
}
