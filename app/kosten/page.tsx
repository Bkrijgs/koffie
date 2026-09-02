"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useKoffie } from "@/lib/useKoffie";
import { EmptyState } from "@/components/EmptyState";
import { ExpenseForm } from "@/components/ExpenseForm";
import { ExpenseCategoryBadge } from "@/components/ExpenseCategoryBadge";
import { GiftBadge } from "@/components/PriceTierBadge";
import type { Bean, Expense } from "@/lib/types";
import {
  expensesInMonth,
  investedTotal,
  isRunning,
  runningTotal,
  sortByPurchasedAt,
} from "@/lib/expenses";
import {
  average,
  costPerShot,
  costPerStar,
  effectiveShots,
  formatDateOnly,
  formatEuro,
  pricePerKg,
  shotsCost,
} from "@/lib/utils";

const MONTHS_NL = [
  "jan",
  "feb",
  "mrt",
  "apr",
  "mei",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

const MONTH_HISTORY = 6;

type BeanCost = {
  bean: Bean;
  counted: number;
  total: number;
  perShot: number;
  starCost: number | undefined;
  gift: boolean;
};

type MonthRow = {
  label: string;
  beanCost: number;
  expenseCost: number;
  total: number;
  counted: number;
};

export default function KostenPage() {
  const { ready, beans, shots, expenses, deleteExpense } = useKoffie();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const perBean = useMemo<BeanCost[]>(() => {
    return beans
      .map((bean) => {
        const perKg = pricePerKg(bean);
        if (perKg === undefined) return null;
        const beanShots = shots.filter((s) => s.beanId === bean.id);
        if (beanShots.length === 0) return null;
        const total = beanShots.reduce(
          (sum, s) => sum + costPerShot(s.doseGrams, perKg),
          0,
        );
        const rated = effectiveShots(beanShots);
        const starCost =
          rated.length > 0
            ? costPerStar(
                average(rated.map((s) => costPerShot(s.doseGrams, perKg))),
                average(rated.map((s) => s.rating)),
              )
            : undefined;
        return {
          bean,
          counted: beanShots.length,
          total,
          perShot: total / beanShots.length,
          starCost,
          gift: Boolean(bean.gift),
        };
      })
      .filter((x): x is BeanCost => x !== null)
      .sort((a, b) => b.total - a.total);
  }, [beans, shots]);

  const months = useMemo<MonthRow[]>(() => {
    const now = new Date();
    const rows: MonthRow[] = [];
    for (let i = 0; i < MONTH_HISTORY; i++) {
      const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const inMonth = shots.filter((s) => {
        const d = new Date(s.createdAt);
        return (
          d.getMonth() === ref.getMonth() &&
          d.getFullYear() === ref.getFullYear()
        );
      });
      const { cost, counted } = shotsCost(inMonth, beans);
      // Alleen lopende uitgaven; apparatuur zou de maandbalk laten ontploffen.
      const expenseCost = runningTotal(expensesInMonth(expenses, ref));
      rows.push({
        label: `${MONTHS_NL[ref.getMonth()]} ${ref.getFullYear()}`,
        beanCost: cost,
        expenseCost,
        total: cost + expenseCost,
        counted,
      });
    }
    return rows;
  }, [beans, shots, expenses]);

  const running = useMemo(
    () => sortByPurchasedAt(expenses.filter(isRunning)),
    [expenses],
  );
  const equipment = useMemo(
    () =>
      sortByPurchasedAt(expenses.filter((e) => e.category === "apparatuur")),
    [expenses],
  );

  async function handleDelete(expense: Expense) {
    if (
      !confirm(
        `"${expense.description}" verwijderen? Dit kan niet ongedaan worden gemaakt.`,
      )
    )
      return;
    setDeletingId(expense.id);
    try {
      await deleteExpense(expense.id);
      if (editing?.id === expense.id) setEditing(null);
    } finally {
      setDeletingId(null);
    }
  }

  if (!ready) return <p className="text-sm text-ink-300">Laden…</p>;

  const all = shotsCost(shots, beans);
  const expensesRunning = runningTotal(expenses);
  const invested = investedTotal(expenses);
  const grandTotal = all.cost + expensesRunning;
  const thisMonth = months[0];
  const lastMonth = months[1];
  const maxMonthCost = Math.max(...months.map((m) => m.total), 0);

  const nothingYet =
    all.counted === 0 && all.giftCounted === 0 && expenses.length === 0;

  function barWidth(value: number): string {
    if (value <= 0 || maxMonthCost <= 0) return "0%";
    return `${Math.max(2, (value / maxMonthCost) * 100)}%`;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl tracking-tighter2 text-ink-800 sm:text-4xl">
          Kosten
        </h1>
        <p className="mt-1 text-sm text-ink-400">
          Wat je espresso&apos;s en je opstelling kosten, per boon en per maand
        </p>
      </header>

      {nothingYet && (
        <EmptyState
          title="Nog geen kostendata"
          description="Vul bij een boon de prijs en het zakgewicht in — daarna rekent elke shot automatisch mee. Filters en schoonmaakmiddel voeg je hieronder toe als uitgave."
          ctaHref="/beans"
          ctaLabel="Naar bonen"
        />
      )}

      {!nothingYet && (
        <>
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl2 border border-line bg-line sm:grid-cols-4">
            <Tile label="Deze maand" value={formatEuro(thisMonth.total)} />
            <Tile label="Vorige maand" value={formatEuro(lastMonth.total)} />
            <Tile
              label="Bonen/shot"
              value={all.counted > 0 ? formatEuro(all.cost / all.counted) : "—"}
            />
            <Tile label="Totaal" value={formatEuro(grandTotal)} />
          </section>

          <div className="space-y-1.5">
            {thisMonth.total > 0 && (
              <p className="numeric text-xs text-ink-400">
                Deze maand: {formatEuro(thisMonth.beanCost)} bonen ·{" "}
                {formatEuro(thisMonth.expenseCost)} onderhoud &amp; spullen
              </p>
            )}
            <p className="text-xs text-ink-400">
              &quot;Bonen/shot&quot; rekent alleen bonen mee, zodat bonen
              onderling vergelijkbaar blijven.
            </p>
            {all.giftCost > 0 && (
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-400">
                <GiftBadge />
                Daarnaast {formatEuro(all.giftCost)} aan cadeau-koffie gedronken
                ({all.giftCounted} {all.giftCounted === 1 ? "shot" : "shots"}) —
                telt niet mee in je uitgaven.
              </p>
            )}
          </div>
        </>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg tracking-tightish text-ink-800">
            Uitgaven
          </h2>
          {!showForm && !editing && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-600 transition hover:bg-ink-50/40"
            >
              + Uitgave
            </button>
          )}
        </div>

        {(showForm || editing) && (
          <div className="mb-4 rounded-xl2 border border-line bg-card p-5 shadow-soft">
            <ExpenseForm
              key={editing?.id ?? "nieuw"}
              expense={editing ?? undefined}
              onSaved={() => {
                setShowForm(false);
                setEditing(null);
              }}
              onCancel={() => {
                setShowForm(false);
                setEditing(null);
              }}
            />
          </div>
        )}

        {running.length === 0 ? (
          <p className="text-sm text-ink-400">
            Nog geen onderhoudskosten. Denk aan een waterfilter,
            schoonmaakmiddel of ontkalker.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl2 border border-line bg-card shadow-soft">
            {running.map((e, i) => (
              <ExpenseRow
                key={e.id}
                expense={e}
                first={i === 0}
                deleting={deletingId === e.id}
                onEdit={() => {
                  setShowForm(false);
                  setEditing(e);
                }}
                onDelete={() => handleDelete(e)}
              />
            ))}
            <div className="flex items-center justify-between border-t border-line bg-kraft/40 px-5 py-3">
              <span className="text-xs uppercase tracking-[0.14em] text-ink-400">
                Totaal uitgaven
              </span>
              <span className="numeric font-display text-base tracking-tightish text-ink-800">
                {formatEuro(expensesRunning)}
              </span>
            </div>
          </div>
        )}
      </section>

      {perBean.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-lg tracking-tightish text-ink-800">
            Per boon
          </h2>
          <div className="overflow-hidden rounded-xl2 border border-line bg-card shadow-soft">
            {perBean.map((row, i) => (
              <Link
                key={row.bean.id}
                href={`/beans/${row.bean.id}`}
                className={`flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-ink-50/40 ${
                  i > 0 ? "border-t border-line" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-display text-base tracking-tightish text-ink-800">
                    <span className="truncate">{row.bean.name}</span>
                    {row.gift && <GiftBadge />}
                  </p>
                  <p className="numeric mt-0.5 text-xs text-ink-400">
                    {row.counted} {row.counted === 1 ? "shot" : "shots"} ·{" "}
                    {formatEuro(row.perShot)}/shot
                    {row.starCost !== undefined &&
                      ` · ${formatEuro(row.starCost)}/ster`}
                  </p>
                </div>
                <span
                  className={`numeric shrink-0 font-display text-lg tracking-tightish ${
                    row.gift ? "text-ink-300 line-through" : "text-ink-800"
                  }`}
                >
                  {formatEuro(row.total)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!nothingYet && (
        <section>
          <h2 className="mb-4 font-display text-lg tracking-tightish text-ink-800">
            Per maand
          </h2>
          <div className="space-y-2.5">
            {months.map((m) => (
              <div key={m.label} className="flex items-center gap-3">
                <span className="numeric w-20 shrink-0 text-xs uppercase tracking-wider text-ink-400">
                  {m.label}
                </span>
                <div className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line/60">
                  {m.beanCost > 0 && (
                    <div
                      className="h-full bg-barista-400 transition-[width] duration-500 ease-out"
                      style={{ width: barWidth(m.beanCost) }}
                    />
                  )}
                  {m.expenseCost > 0 && (
                    <div
                      className="h-full bg-clay-400 transition-[width] duration-500 ease-out"
                      style={{ width: barWidth(m.expenseCost) }}
                    />
                  )}
                </div>
                <span className="numeric w-20 shrink-0 text-right text-sm font-medium text-ink-800">
                  {m.total > 0 ? formatEuro(m.total) : "—"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-ink-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-barista-400" />
              Bonen
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-clay-400" />
              Onderhoud &amp; spullen
            </span>
          </div>
        </section>
      )}

      {equipment.length > 0 && (
        <section>
          <h2 className="mb-1 font-display text-lg tracking-tightish text-ink-800">
            Apparatuur
          </h2>
          <p className="mb-4 text-xs text-ink-400">
            Eenmalige investeringen. Deze tellen niet mee in je maandcijfers of
            in de prijs per shot.
          </p>
          <div className="overflow-hidden rounded-xl2 border border-line bg-card shadow-soft">
            {equipment.map((e, i) => (
              <ExpenseRow
                key={e.id}
                expense={e}
                first={i === 0}
                deleting={deletingId === e.id}
                onEdit={() => {
                  setShowForm(false);
                  setEditing(e);
                }}
                onDelete={() => handleDelete(e)}
              />
            ))}
            <div className="flex items-center justify-between border-t border-line bg-kraft/40 px-5 py-3">
              <span className="text-xs uppercase tracking-[0.14em] text-ink-400">
                Geïnvesteerd
              </span>
              <span className="numeric font-display text-base tracking-tightish text-ink-800">
                {formatEuro(invested)}
              </span>
            </div>
          </div>
        </section>
      )}

      {all.counted < shots.length && (
        <p className="text-xs text-ink-400">
          Bonenkosten op basis van {all.counted} van de {shots.length} shots —
          bonen zonder prijs of zakgewicht en cadeau-bonen tellen niet mee.
        </p>
      )}
    </div>
  );
}

function ExpenseRow({
  expense,
  first,
  deleting,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  first: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-5 py-4 ${
        first ? "" : "border-t border-line"
      }`}
    >
      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 text-left transition hover:opacity-70"
      >
        <p className="flex items-center gap-1.5 font-display text-base tracking-tightish text-ink-800">
          <span className="truncate">{expense.description}</span>
          <ExpenseCategoryBadge category={expense.category} />
        </p>
        <p className="numeric mt-0.5 text-xs text-ink-400">
          {formatDateOnly(expense.purchasedAt)}
          {expense.notes && ` · ${expense.notes}`}
        </p>
      </button>
      <span className="numeric shrink-0 font-display text-lg tracking-tightish text-ink-800">
        {formatEuro(expense.amountEuros)}
      </span>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        aria-label={`${expense.description} verwijderen`}
        className="shrink-0 rounded-lg px-2 py-1 text-xs text-ink-300 transition hover:bg-clay-400/10 hover:text-clay-500 disabled:opacity-50"
      >
        {deleting ? "…" : "×"}
      </button>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-5 text-center">
      <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
        {label}
      </p>
      <p className="numeric mt-1 font-display text-2xl tracking-tightish text-ink-800">
        {value}
      </p>
    </div>
  );
}
