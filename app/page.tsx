"use client";

import Link from "next/link";
import { useKoffie } from "@/lib/useKoffie";
import { ShotCard } from "@/components/ShotCard";
import { EmptyState } from "@/components/EmptyState";
import { BaristaTips } from "@/components/BaristaTips";
import { ShotHeatmap } from "@/components/ShotHeatmap";
import { BootSplash } from "@/components/BootSplash";
import { average, effectiveShots } from "@/lib/utils";
import { globalTips } from "@/lib/tips";
import { useCountUp } from "@/lib/useCountUp";

// Boot-splash duurt ~3.1s. Tellers starten kort voor het fade-out
// moment zodat de count-up zichtbaar afloopt zodra de splash wegvalt.
const COUNT_DELAY = 2700;

export default function DashboardPage() {
  const { ready, beans, shots } = useKoffie();

  if (!ready) {
    return <p className="text-sm text-ink-300">Laden…</p>;
  }

  const beanById = new Map(beans.map((b) => [b.id, b]));
  const effective = effectiveShots(shots);
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
      <section className="flex items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-3xl tracking-tighter2 text-ink-800 sm:text-4xl">
            Dial-in log
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            {shots.length} shots · {beans.length} bonen
          </p>
        </div>
        <Link
          href="/shots/new"
          className="hidden rounded-lg bg-ink-800 px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-700 sm:inline-block"
        >
          Nieuwe shot
        </Link>
      </section>

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
          <ShotHeatmap shots={shots} />
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
