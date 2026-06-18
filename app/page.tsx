"use client";

import Link from "next/link";
import { useState } from "react";
import { useKoffie } from "@/lib/useKoffie";
import { ShotCard } from "@/components/ShotCard";
import { EmptyState } from "@/components/EmptyState";
import { BaristaTips } from "@/components/BaristaTips";
import { ShotHeatmap } from "@/components/ShotHeatmap";
import { BootSplash } from "@/components/BootSplash";
import { average, effectiveShots, formatDateOnly } from "@/lib/utils";
import { globalTips } from "@/lib/tips";
import { useCountUp } from "@/lib/useCountUp";

// Boot-splash duurt ~2.4s (geen rising fill meer). Tellers starten
// kort voor het fade-out moment zodat ze zichtbaar aflopen terwijl
// de splash wegfade.
const COUNT_DELAY = 2200;

export default function DashboardPage() {
  const { ready, error, beans, shots } = useKoffie();
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  if (!ready) {
    return <p className="text-sm text-ink-300">Laden…</p>;
  }

  const beanById = new Map(beans.map((b) => [b.id, b]));
  const effective = effectiveShots(shots);
  const selectedDayShots = selectedDateKey
    ? [...shots]
        .filter((s) => s.createdAt.slice(0, 10) === selectedDateKey)
        .sort(
          (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
        )
    : [];
  const dialInCount = shots.length - effective.length;
  const recent = shots.slice(0, 5);
  const top = [...effective]
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    })
    .slice(0, 3);

  const avgRating = average(effective.map((s) => s.rating));
  const tips = globalTips(beans, shots);

  return (
    <div className="space-y-10">
      <BootSplash />
      {error && (
        <div className="rounded-xl2 border border-clay-400 bg-card p-4 text-sm text-clay-500">
          <p className="font-medium">Data kon niet geladen worden</p>
          <p className="mt-1 break-words text-ink-300">{error}</p>
        </div>
      )}
      {shots.length > 0 && (
        <section className="grid grid-cols-3 gap-px overflow-hidden rounded-xl2 border border-line bg-line">
          <CountStat
            label="Shots"
            target={shots.length}
            sub={dialInCount > 0 ? `${dialInCount} dial-in` : undefined}
          />
          <CountStat label="Bonen" target={beans.length} />
          <CountStat
            label="Gem. rating"
            target={avgRating}
            decimals={1}
            fallback="—"
          />
        </section>
      )}

      <BaristaTips tips={tips} />

      {shots.length > 0 && (
        <section>
          <SectionHeader title="Activiteit" />
          <ShotHeatmap
            shots={shots}
            selectedDateKey={selectedDateKey}
            onSelectDay={(key) =>
              setSelectedDateKey((cur) => (cur === key ? null : key))
            }
          />
          {selectedDateKey && selectedDayShots.length > 0 && (
            <div className="anim-fade-up mt-5 rounded-xl2 border border-line bg-card p-5 shadow-soft">
              <header className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
                    Geselecteerde dag
                  </p>
                  <h3 className="font-display text-base tracking-tightish text-ink-800">
                    {formatDateOnly(selectedDateKey)} —{" "}
                    {selectedDayShots.length}{" "}
                    {selectedDayShots.length === 1 ? "shot" : "shots"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDateKey(null)}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-500 transition hover:bg-ink-50/40"
                >
                  Sluiten
                </button>
              </header>
              <div className="space-y-3">
                {selectedDayShots.map((s) => (
                  <ShotCard
                    key={s.id}
                    shot={s}
                    bean={beanById.get(s.beanId)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section>
        <SectionHeader
          title="Laatste shots"
          action={
            shots.length > 5 ? (
              <Link href="/beans" className="text-ink-400 hover:text-ink-700">
                Alles →
              </Link>
            ) : null
          }
        />
        {recent.length === 0 ? (
          <EmptyState
            title="Geen shots"
            description="Voeg je eerste shot toe."
            ctaHref="/shots/new"
            ctaLabel="Nieuwe shot"
          />
        ) : (
          <div className="space-y-3">
            {recent.map((s) => (
              <ShotCard key={s.id} shot={s} bean={beanById.get(s.beanId)} />
            ))}
          </div>
        )}
      </section>

      {top.length > 0 && (
        <section>
          <SectionHeader title="Top shots" />
          <div className="space-y-3">
            {top.map((s) => (
              <ShotCard key={s.id} shot={s} bean={beanById.get(s.beanId)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex items-baseline justify-between">
      <h2 className="font-display text-lg tracking-tightish text-ink-800">
        {title}
      </h2>
      {action && <div className="text-sm">{action}</div>}
    </header>
  );
}

function CountStat({
  label,
  target,
  sub,
  decimals = 0,
  fallback,
}: {
  label: string;
  target: number;
  sub?: string;
  decimals?: number;
  fallback?: string;
}) {
  const shown = useCountUp(target, {
    delay: COUNT_DELAY,
    duration: 900,
    decimals,
  });
  const display = fallback && target <= 0 ? fallback : shown;
  return (
    <div className="bg-card px-4 py-5 text-center">
      <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
        {label}
      </p>
      <p className="numeric mt-1 font-display text-2xl tracking-tightish text-ink-800">
        {display}
      </p>
      {sub && (
        <p className="numeric mt-0.5 text-[10px] uppercase tracking-[0.18em] text-ink-300">
          {sub}
        </p>
      )}
    </div>
  );
}
