"use client";

import { useState } from "react";
import type { Bean, Setup, ShotLog } from "@/lib/types";
import type { ShotAdvice } from "@/lib/coach";
import { Barista } from "./Barista";

type Props = {
  bean: Bean;
  setup: Setup;
  shots: ShotLog[];
};

const CONFIDENCE_STYLE: Record<ShotAdvice["confidence"], string> = {
  laag: "bg-ink-100 text-ink-500",
  gemiddeld: "bg-gold-300/30 text-gold-500",
  hoog: "bg-emerald-500/15 text-emerald-600",
};

export function CoachCard({ bean, setup, shots }: Props) {
  const [advice, setAdvice] = useState<ShotAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyse() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bean, setup, shots }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Er ging iets mis.",
        );
      }
      setAdvice(data.advice as ShotAdvice);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Er ging iets mis.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl2 border border-line bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
            Barista-coach
          </p>
          <h2 className="font-display text-base tracking-tightish text-ink-800">
            Advies voor je volgende shot
          </h2>
        </div>
        {advice && !loading && (
          <button
            type="button"
            onClick={analyse}
            className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-500 transition hover:bg-ink-50/40"
          >
            Opnieuw
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-4 flex items-center gap-3 text-sm text-ink-500">
          <Barista mood="think" size={48} />
          <span>De barista analyseert je shots…</span>
        </div>
      )}

      {!loading && !advice && (
        <div className="mt-4">
          <p className="text-sm text-ink-500">
            Laat de AI je shot-historie en apparatuur doorlichten en een
            concreet recept voor de volgende shot voorstellen.
          </p>
          <button
            type="button"
            onClick={analyse}
            className="mt-3 rounded-lg bg-ink-800 px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-700"
          >
            Analyseer mijn shots
          </button>
        </div>
      )}

      {!loading && error && (
        <div className="mt-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={analyse}
            className="mt-3 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-50/40"
          >
            Opnieuw proberen
          </button>
        </div>
      )}

      {!loading && advice && (
        <div className="mt-4 space-y-4 anim-fade-up">
          <p className="font-display text-lg tracking-tightish text-ink-800">
            {advice.headline}
          </p>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Recipe label="Maalgraad" value={fmt(advice.grindSize)} />
            <Recipe label="Dose" value={`${fmt(advice.doseGrams)} g`} />
            <Recipe label="Yield" value={`${fmt(advice.yieldGrams)} g`} />
            <Recipe
              label="Tijd"
              value={`${fmt(advice.targetTimeSeconds)} s`}
            />
          </dl>

          {advice.rationale.length > 0 && (
            <ul className="space-y-1.5">
              {advice.rationale.map((line, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 text-sm text-ink-700"
                >
                  <span
                    className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-barista-400"
                    aria-hidden
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}

          {advice.watchFor && (
            <p className="border-l-2 border-line pl-3 text-sm italic text-ink-500">
              Let op: {advice.watchFor}
            </p>
          )}

          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${CONFIDENCE_STYLE[advice.confidence]}`}
            >
              Zekerheid: {advice.confidence}
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-ink-300">
              AI-suggestie
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function Recipe({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-barista-100 bg-paper px-3 py-2.5">
      <dt className="text-[10px] uppercase tracking-[0.16em] text-ink-300">
        {label}
      </dt>
      <dd className="numeric mt-0.5 font-display text-lg tracking-tightish text-barista-400">
        {value}
      </dd>
    </div>
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
