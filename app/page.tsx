"use client";

import Link from "next/link";
import { useKoffie } from "@/lib/useKoffie";
import { ShotCard } from "@/components/ShotCard";
import { EmptyState } from "@/components/EmptyState";
import { BaristaTips } from "@/components/BaristaTips";
import { average } from "@/lib/utils";
import { globalTips } from "@/lib/tips";

export default function DashboardPage() {
  const { ready, beans, shots } = useKoffie();

  if (!ready) {
    return <p className="text-sm text-ink-300">Laden…</p>;
  }

  const beanById = new Map(beans.map((b) => [b.id, b]));
  const recent = shots.slice(0, 5);
  const top = [...shots]
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    })
    .slice(0, 3);

  const avgRating = average(shots.map((s) => s.rating));
  const tips = globalTips(beans, shots);

  return (
    <div className="space-y-10">
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
          <Stat label="Shots" value={String(shots.length)} />
          <Stat label="Bonen" value={String(beans.length)} />
          <Stat
            label="Gem. rating"
            value={avgRating > 0 ? avgRating.toFixed(1) : "—"}
          />
        </section>
      )}

      <BaristaTips tips={tips} />

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

function Stat({ label, value }: { label: string; value: string }) {
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
