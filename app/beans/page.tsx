"use client";

import { useMemo, useState } from "react";
import { useKoffie } from "@/lib/useKoffie";
import { BeanCard } from "@/components/BeanCard";
import { BeanForm } from "@/components/BeanForm";
import { EmptyState } from "@/components/EmptyState";
import type { ShotLog } from "@/lib/types";
import {
  average,
  costPerShot,
  costPerStar,
  effectiveShots,
  pricePerKg,
} from "@/lib/utils";

type SortKey = "nieuwste" | "rating" | "prijs" | "waarde";

export default function BeansPage() {
  const { ready, beans, shots } = useKoffie();
  const [showForm, setShowForm] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("nieuwste");

  const shotsByBean = useMemo(() => {
    const map = new Map<string, ShotLog[]>();
    for (const s of shots) {
      const list = map.get(s.beanId) ?? [];
      list.push(s);
      map.set(s.beanId, list);
    }
    return map;
  }, [shots]);

  const sorted = useMemo(() => {
    // Per boon de vergelijkingscijfers: gem. rating, €/kg en €/ster.
    const stats = new Map<
      string,
      { avg: number | undefined; perKg: number | undefined; starCost: number | undefined }
    >();
    for (const b of beans) {
      const effective = effectiveShots(shotsByBean.get(b.id) ?? []);
      const avg =
        effective.length > 0
          ? average(effective.map((s) => s.rating))
          : undefined;
      const perKg = pricePerKg(b);
      const starCost =
        perKg !== undefined && avg !== undefined
          ? costPerStar(
              average(effective.map((s) => costPerShot(s.doseGrams, perKg))),
              avg,
            )
          : undefined;
      stats.set(b.id, { avg, perKg, starCost });
    }

    const arr = [...beans];
    if (sortBy === "rating") {
      // Hoogste gemiddelde eerst; bonen zonder beoordeelde shots achteraan.
      arr.sort(
        (a, b) =>
          (stats.get(b.id)?.avg ?? -1) - (stats.get(a.id)?.avg ?? -1),
      );
    } else if (sortBy === "prijs") {
      // Goedkoopste per kilo eerst; bonen zonder prijs achteraan.
      arr.sort(
        (a, b) =>
          (stats.get(a.id)?.perKg ?? Infinity) -
          (stats.get(b.id)?.perKg ?? Infinity),
      );
    } else if (sortBy === "waarde") {
      // Laagste kosten per ster = beste deal eerst; zonder data achteraan.
      arr.sort(
        (a, b) =>
          (stats.get(a.id)?.starCost ?? Infinity) -
          (stats.get(b.id)?.starCost ?? Infinity),
      );
    } else {
      arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    return arr;
  }, [beans, shotsByBean, sortBy]);

  if (!ready) {
    return <p className="text-sm text-ink-300">Laden…</p>;
  }

  const active = sorted.filter((b) => b.inStock);
  const finished = sorted.filter((b) => !b.inStock);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tighter2 text-ink-800 sm:text-4xl">
            Bonen
          </h1>
          <p className="numeric mt-1 text-sm text-ink-400">
            {beans.length}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-ink-800 px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-700"
        >
          {showForm ? "Sluiten" : "Nieuwe boon"}
        </button>
      </header>

      {showForm && (
        <div className="rounded-xl2 border border-line bg-card p-6 shadow-soft">
          <BeanForm
            onCreated={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {beans.length === 0 ? (
        <EmptyState
          title="Geen bonen"
          description="Voeg je eerste boon toe."
        />
      ) : (
        <>
          {beans.length > 1 && (
            <div className="flex justify-end">
              <SortControl value={sortBy} onChange={setSortBy} />
            </div>
          )}

          {active.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {active.map((b) => (
                <BeanCard
                  key={b.id}
                  bean={b}
                  shots={shotsByBean.get(b.id) ?? []}
                />
              ))}
            </div>
          )}

          {finished.length > 0 && (
            <section>
              <header className="mb-3 flex items-baseline gap-2">
                <h2 className="font-display text-base tracking-tightish text-ink-600">
                  Niet op voorraad
                </h2>
                <span className="numeric text-xs text-ink-300">
                  {finished.length}
                </span>
              </header>
              <div className="grid gap-3 opacity-75 sm:grid-cols-2">
                {finished.map((b) => (
                  <BeanCard
                    key={b.id}
                    bean={b}
                    shots={shotsByBean.get(b.id) ?? []}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SortControl({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  const options: { key: SortKey; label: string }[] = [
    { key: "nieuwste", label: "Nieuwste" },
    { key: "rating", label: "Rating" },
    { key: "prijs", label: "Prijs" },
    { key: "waarde", label: "Waarde" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-line bg-card p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded-md px-2.5 py-1 transition ${
            value === o.key
              ? "bg-ink-800 text-paper"
              : "text-ink-400 hover:text-ink-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
