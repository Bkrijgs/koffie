"use client";

import { useState } from "react";
import type { StyleEstimate, StyleEstimates } from "@/lib/styles";

type Props = {
  estimates: StyleEstimates;
  /** Id van de stijl die nu in het formulier staat, als die matcht. */
  activeId: string | null;
  onPick: (row: StyleEstimate) => void;
};

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function range(low: number, high: number, prefix = ""): string {
  return low === high
    ? `${prefix}${fmt(low)}`
    : `${prefix}${fmt(low)}–${fmt(high)}`;
}

function deltaLabel(delta: number): string {
  if (delta === 0) return "zelfde stand";
  const abs = fmt(Math.abs(delta));
  return delta > 0 ? `${abs} grover` : `${abs} fijner`;
}

/**
 * Overzicht van de zetstijlen met per stijl de doel-yield, doel-tijd en de
 * geschatte maalgraad voor de gekozen boon. Tik op een rij om het recept in
 * het formulier te zetten.
 */
export function ShotStyles({ estimates, activeId, onPick }: Props) {
  const { rows, reference, learned } = estimates;
  const [openId, setOpenId] = useState<string | null>(null);
  const shownId = openId ?? activeId;
  const shown = rows.find((r) => r.style.id === shownId);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">
          Zetstijlen
        </span>
        <span className="text-[10px] uppercase tracking-wider text-ink-300">
          tik om in te vullen
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-paper">
        {rows.map((row) => {
          const { style } = row;
          const isActive = style.id === activeId;
          return (
            <button
              key={style.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                setOpenId(style.id);
                onPick(row);
              }}
              className={`flex w-full items-center justify-between gap-3 border-b border-line px-3.5 py-2.5 text-left transition last:border-b-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-barista-400/40 ${
                isActive ? "bg-barista-100/60" : "hover:bg-card"
              }`}
            >
              <span className="min-w-0">
                <span
                  className={`block font-display text-sm tracking-tightish ${
                    isActive ? "text-barista-500" : "text-ink-800"
                  }`}
                >
                  {style.label}
                </span>
                <span className="numeric block text-[11px] text-ink-300">
                  {range(style.ratioLow, style.ratioHigh, "1:")} ·{" "}
                  {range(row.yieldLow, row.yieldHigh)} g · {style.timeLow}–
                  {style.timeHigh} s
                </span>
              </span>
              <span className="shrink-0 text-right">
                {row.grind !== null && row.delta !== null ? (
                  <>
                    <span
                      className={`numeric block font-display text-base tracking-tightish ${
                        row.outOfRange ? "text-clay-500" : "text-barista-400"
                      }`}
                    >
                      {row.outOfRange === "fine" && "≤ "}
                      {row.outOfRange === "coarse" && "≥ "}
                      {fmt(row.grind)}
                    </span>
                    <span
                      className={`block text-[10px] uppercase tracking-wider ${
                        row.outOfRange ? "text-clay-500" : "text-ink-300"
                      }`}
                    >
                      {row.outOfRange ? "buiten bereik" : deltaLabel(row.delta)}
                    </span>
                  </>
                ) : (
                  <span className="block text-[11px] text-ink-400">
                    {style.grindHint}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {shown && (
        <div className="anim-fade-up mt-2 rounded-lg border border-barista-100 bg-card px-3.5 py-2.5 text-[12px] leading-snug text-ink-600">
          <p>{shown.style.description}</p>
          {shown.outOfRange && (
            <p className="mt-1.5 text-clay-500">
              {shown.outOfRange === "fine"
                ? "Je maler kan hier waarschijnlijk niet fijn genoeg voor. Zet hem op de fijnste stand en verhoog eventueel de dose een beetje."
                : "Je maler kan hier waarschijnlijk niet grof genoeg voor. Zet hem op de grofste stand en reken erop dat hij langer doorloopt dan het recept."}
            </p>
          )}
        </div>
      )}

      <p className="mt-2 text-[11px] leading-snug text-ink-300">
        {reference ? (
          <>
            Maalgraad is een schatting vanaf je{" "}
            {reference.rating ? `${fmt(reference.rating)}★ ` : ""}shot op stand{" "}
            <span className="numeric">{fmt(reference.grindSize)}</span> (
            <span className="numeric">
              {fmt(reference.yieldGrams)} g in{" "}
              {fmt(reference.extractionTimeSeconds)} s
            </span>
            ),{" "}
            {learned
              ? "met de gevoeligheid van je maler afgeleid uit je eigen shots."
              : "met een vuistregel voor je maler. Wordt preciezer naarmate je meer shots op verschillende standen logt."}
          </>
        ) : (
          "Nog geen shots voor deze boon. Log er één, dan rekent de app per stijl de maalgraad voor je uit."
        )}
      </p>
    </div>
  );
}
