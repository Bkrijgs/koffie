"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useKoffie } from "@/lib/useKoffie";
import { EmptyState } from "@/components/EmptyState";
import { GiftBadge } from "@/components/PriceTierBadge";
import type { Bean } from "@/lib/types";
import {
  average,
  costPerShot,
  costPerStar,
  effectiveShots,
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

export default function KostenPage() {
  const { ready, beans, shots } = useKoffie();

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

  const months = useMemo(() => {
    const now = new Date();
    const rows: { label: string; cost: number; counted: number }[] = [];
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
      rows.push({
        label: `${MONTHS_NL[ref.getMonth()]} ${ref.getFullYear()}`,
        cost,
        counted,
      });
    }
    return rows;
  }, [beans, shots]);

  if (!ready) return <p className="text-sm text-ink-300">Laden…</p>;

  const all = shotsCost(shots, beans);
  const thisMonth = months[0];
  const lastMonth = months[1];
  const maxMonthCost = Math.max(...months.map((m) => m.cost), 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl tracking-tighter2 text-ink-800 sm:text-4xl">
          Kosten
        </h1>
        <p className="mt-1 text-sm text-ink-400">
          Wat je espresso&apos;s kosten, per boon en per maand
        </p>
      </header>

      {all.counted === 0 && all.giftCounted === 0 ? (
        <EmptyState
          title="Nog geen kostendata"
          description="Vul bij een boon de prijs en het zakgewicht in — daarna rekent elke shot automatisch mee."
          ctaHref="/beans"
          ctaLabel="Naar bonen"
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl2 border border-line bg-line sm:grid-cols-4">
            <Tile label="Deze maand" value={formatEuro(thisMonth.cost)} />
            <Tile label="Vorige maand" value={formatEuro(lastMonth.cost)} />
            <Tile
              label="Gem. per shot"
              value={formatEuro(all.cost / all.counted)}
            />
            <Tile label="Totaal" value={formatEuro(all.cost)} />
          </section>

          {all.giftCost > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-400">
              <GiftBadge />
              Daarnaast {formatEuro(all.giftCost)} aan cadeau-koffie gedronken
              ({all.giftCounted} {all.giftCounted === 1 ? "shot" : "shots"}) —
              telt niet mee in je uitgaven.
            </p>
          )}

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
                  <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line/60">
                    {m.cost > 0 && maxMonthCost > 0 && (
                      <div
                        className="h-full rounded-full bg-barista-400 transition-[width] duration-500 ease-out"
                        style={{
                          width: `${Math.max(2, (m.cost / maxMonthCost) * 100)}%`,
                        }}
                      />
                    )}
                  </div>
                  <span className="numeric w-20 shrink-0 text-right text-sm font-medium text-ink-800">
                    {m.cost > 0 ? formatEuro(m.cost) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {all.counted < shots.length && (
            <p className="text-xs text-ink-400">
              Uitgaven op basis van {all.counted} van de {shots.length} shots
              — bonen zonder prijs of zakgewicht en cadeau-bonen tellen niet
              mee.
            </p>
          )}
        </>
      )}
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
