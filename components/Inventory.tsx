"use client";

import { useMemo, useState } from "react";
import type { Bag, ShotLog } from "@/lib/types";
import { bagStats, openBagFor, type BagStats } from "@/lib/inventory";
import { formatDateOnly } from "@/lib/utils";
import { useKoffie } from "@/lib/useKoffie";
import { BagForm } from "./BagForm";

type Props = {
  beanId: string;
  bags: Bag[];
  shots: ShotLog[];
};

export function Inventory({ beanId, bags, shots }: Props) {
  const { updateBag } = useKoffie();
  const [showForm, setShowForm] = useState(false);

  const beanBags = useMemo(
    () =>
      bags
        .filter((b) => b.beanId === beanId)
        .sort((a, b) => +new Date(b.openedAt) - +new Date(a.openedAt)),
    [bags, beanId],
  );
  const open = openBagFor(beanId, bags);
  const closed = beanBags.filter((b) => b.id !== open?.id);

  async function handleClose(bag: Bag) {
    if (!confirm("Zak afsluiten op vandaag?")) return;
    await updateBag(bag.id, {
      beanId: bag.beanId,
      grams: bag.grams,
      openedAt: bag.openedAt,
      finishedAt: new Date().toISOString().slice(0, 10),
      notes: bag.notes,
    });
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="font-display text-lg tracking-tightish text-ink-800">
          Voorraad
        </h2>
        {!open && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-600 transition hover:bg-ink-50/40"
          >
            + Nieuwe zak
          </button>
        )}
      </header>

      {showForm && (
        <div className="rounded-xl2 border border-line bg-card p-5 shadow-soft">
          <BagForm
            beanId={beanId}
            onCreated={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {open ? (
        <OpenBag stats={bagStats(open, shots)} onClose={handleClose} />
      ) : !showForm ? (
        <p className="text-sm text-ink-400">
          Nog geen open zak. Open er een om je verbruik bij te houden.
        </p>
      ) : null}

      {closed.length > 0 && (
        <details className="group rounded-xl2 border border-line bg-paper px-5 py-3">
          <summary className="cursor-pointer text-sm text-ink-500 marker:text-ink-300">
            Geschiedenis · {closed.length}{" "}
            {closed.length === 1 ? "zak" : "zakken"}
          </summary>
          <ul className="mt-3 space-y-2">
            {closed.map((b) => (
              <ClosedBag key={b.id} stats={bagStats(b, shots)} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function OpenBag({
  stats,
  onClose,
}: {
  stats: BagStats;
  onClose: (bag: Bag) => void;
}) {
  const pctUsed = Math.min(100, (stats.usedGrams / stats.bag.grams) * 100);
  return (
    <div className="rounded-xl2 border border-line bg-card p-5 shadow-soft">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
            Open zak
          </p>
          <p className="mt-1 font-display text-2xl tracking-tightish text-ink-800">
            <span className="numeric">{round(stats.remainingGrams)}</span>
            <span className="text-base text-ink-400"> g over</span>
          </p>
        </div>
        <p className="numeric text-xs text-ink-400">
          {round(stats.usedGrams)} / {round(stats.bag.grams)} g
        </p>
      </div>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={Math.round(pctUsed)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-ink-800 transition-all"
          style={{ width: `${pctUsed}%` }}
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <Stat label="Open sinds" value={formatDateOnly(stats.bag.openedAt)} />
        <Stat
          label="Dagen open"
          value={`${stats.daysOpen}`}
          numeric
        />
        <Stat
          label="Tempo"
          value={stats.gramsPerDay > 0 ? `${stats.gramsPerDay.toFixed(1)} g/dag` : "—"}
          numeric
        />
        <Stat
          label="Nog over"
          value={
            stats.projectedDaysLeft != null
              ? `~${stats.projectedDaysLeft} dagen`
              : "—"
          }
          numeric
        />
      </dl>

      {stats.bag.notes && (
        <p className="mt-3 text-sm italic text-ink-500">{stats.bag.notes}</p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => onClose(stats.bag)}
          className="text-xs text-ink-400 transition hover:text-ink-700"
        >
          Zak afsluiten →
        </button>
      </div>
    </div>
  );
}

function ClosedBag({ stats }: { stats: BagStats }) {
  return (
    <li className="flex items-baseline justify-between gap-3 rounded-lg bg-card px-3 py-2 text-sm">
      <span className="numeric text-ink-700">{round(stats.bag.grams)} g</span>
      <span className="text-xs text-ink-400">
        {formatDateOnly(stats.bag.openedAt)} →{" "}
        {formatDateOnly(stats.bag.finishedAt)}
      </span>
      <span className="numeric text-xs text-ink-400">
        {stats.daysOpen}d · {stats.gramsPerDay.toFixed(1)} g/dag
      </span>
    </li>
  );
}

function Stat({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-ink-300">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-sm font-medium text-ink-800 ${numeric ? "numeric" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function round(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
