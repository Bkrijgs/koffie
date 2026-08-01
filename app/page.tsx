"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useKoffie } from "@/lib/useKoffie";
import { ShotCard } from "@/components/ShotCard";
import { EmptyState } from "@/components/EmptyState";
import { BaristaTips } from "@/components/BaristaTips";
import { ShotHeatmap } from "@/components/ShotHeatmap";
import { BootSplash } from "@/components/BootSplash";
import {
  average,
  effectiveShots,
  formatDateOnly,
  formatEuro,
  isSameMonth,
  shotsCost,
} from "@/lib/utils";
import { globalTips } from "@/lib/tips";
import { useCountUp } from "@/lib/useCountUp";

// Boot-splash duurt ~2.4s (geen rising fill meer). Tellers starten
// kort voor het fade-out moment zodat ze zichtbaar aflopen terwijl
// de splash wegfade.
const COUNT_DELAY = 2200;

export default function DashboardPage() {
  const { ready, error, beans, shots } = useKoffie();
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  // Diagnose: deze effect draait alleen als de client-side React écht
  // hydrateert. Zie je hieronder "JS actief…" dan draait de app-code; blijf je
  // de kale server-tekst "Laden…" zien, dan voert deze Kobo de React-bundle
  // niet uit en is een server-gerenderde variant nodig.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!ready) {
    return (
      <div className="text-sm text-ink-300">
        <p>{hydrated ? "JS actief — verbinden met database…" : "Laden…"}</p>
        {hydrated && error && (
          <p className="mt-2 break-words text-clay-500">{error}</p>
        )}
      </div>
    );
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
  const monthCost = shotsCost(
    shots.filter((s) => isSameMonth(s.createdAt, new Date())),
    beans,
  ).cost;
  // Als de boot-splash deze sessie al is geweest (html.boot-seen, gezet vóór
  // paint) hoeven de tellers niet op het fade-out moment te wachten.
  const splashSkipped =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("boot-seen");
  const countDelay = splashSkipped ? 150 : COUNT_DELAY;

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
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl2 border border-line bg-line sm:grid-cols-4">
          <CountStat
            label="Shots"
            target={shots.length}
            sub={dialInCount > 0 ? `${dialInCount} dial-in` : undefined}
            delay={countDelay}
          />
          <CountStat label="Bonen" target={beans.length} delay={countDelay} />
          <CountStat
            label="Gem. rating"
            target={avgRating}
            decimals={1}
            fallback="—"
            delay={countDelay}
          />
          <Link href="/kosten" className="group block">
            <CountStat
              label="Kosten"
              target={monthCost}
              euro
              fallback="—"
              sub="deze maand →"
              delay={countDelay}
            />
          </Link>
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
              <Link href="/shots" className="text-ink-400 hover:text-ink-700">
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
  euro = false,
  delay = COUNT_DELAY,
}: {
  label: string;
  target: number;
  sub?: string;
  decimals?: number;
  fallback?: string;
  euro?: boolean;
  delay?: number;
}) {
  const shown = useCountUp(target, {
    delay,
    duration: 900,
    decimals: euro ? 2 : decimals,
  });
  const display =
    fallback && target <= 0
      ? fallback
      : euro
        ? formatEuro(parseFloat(shown))
        : shown;
  return (
    <div className="h-full bg-card px-4 py-5 text-center transition group-hover:bg-ink-50/40">
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
