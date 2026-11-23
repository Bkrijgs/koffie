"use client";

import { useState } from "react";
import type { Bean, ShotLog } from "@/lib/types";
import type { CaffeineEstimate } from "@/lib/caffeine";
import { average } from "@/lib/utils";
import { useKoffie } from "@/lib/useKoffie";

type Props = {
  bean: Bean;
  shots: ShotLog[];
};

/** Meta-cel "Cafeïne" voor de boondetailpagina. Toont ±mg per shot zodra
 *  de AI-schatting is opgeslagen; anders een knop om die op te halen. */
export function CaffeineMeta({ bean, shots }: Props) {
  const { updateBean } = useKoffie();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function estimate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/caffeine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bean }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Er ging iets mis.",
        );
      }
      const est = data.estimate as CaffeineEstimate;
      await updateBean(bean.id, {
        name: bean.name,
        roaster: bean.roaster,
        origin: bean.origin,
        blend: bean.blend,
        roastDate: bean.roastDate,
        priceEuros: bean.priceEuros,
        bagWeightGrams: bean.bagWeightGrams,
        gift: bean.gift,
        caffeineMgPerGram: est.mgPerGram,
        notes: bean.notes,
        inStock: bean.inStock,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Er ging iets mis.");
    } finally {
      setLoading(false);
    }
  }

  const mgPerGram = bean.caffeineMgPerGram;
  const doses = shots.map((s) => s.doseGrams);
  const avgDose = doses.length > 0 ? average(doses) : undefined;

  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-ink-300">
        Cafeïne
      </dt>
      <dd className="mt-1 text-sm font-medium text-ink-800">
        {mgPerGram !== undefined ? (
          <span className="numeric">
            {avgDose !== undefined
              ? `±${Math.round(avgDose * mgPerGram)} mg/shot`
              : `±${mgPerGram} mg/g`}
          </span>
        ) : (
          <button
            type="button"
            onClick={estimate}
            disabled={loading}
            className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink-500 transition hover:bg-ink-50/40 disabled:opacity-50"
          >
            {loading ? "Schatten…" : "Schat met AI"}
          </button>
        )}
      </dd>
      {error && (
        <p className="mt-0.5 text-[10px] text-clay-500">{error}</p>
      )}
    </div>
  );
}
