"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useKoffie } from "@/lib/useKoffie";
import { ShotCard } from "@/components/ShotCard";
import { StarRating } from "@/components/StarRating";
import { EmptyState } from "@/components/EmptyState";
import { BaristaTips } from "@/components/BaristaTips";
import { CoachCard } from "@/components/CoachCard";
import { RatingCurve } from "@/components/RatingCurve";
import { average, effectiveShots, formatDateOnly, mode } from "@/lib/utils";
import { tipsForBean } from "@/lib/tips";
import type { ShotLog } from "@/lib/types";

type SortKey = "date" | "rating" | "time";

export default function BeanDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { ready, beans, shots, setup } = useKoffie();
  const [sortBy, setSortBy] = useState<SortKey>("date");

  const bean = useMemo(() => beans.find((b) => b.id === id), [beans, id]);
  const beanShots = useMemo(
    () => (id ? shots.filter((s) => s.beanId === id) : []),
    [shots, id],
  );

  const sorted = useMemo(() => {
    const arr = [...beanShots];
    if (sortBy === "rating") {
      arr.sort(
        (a, b) =>
          (a.dialIn ? 1 : 0) - (b.dialIn ? 1 : 0) ||
          b.rating - a.rating ||
          +new Date(b.createdAt) - +new Date(a.createdAt),
      );
    } else if (sortBy === "time") {
      arr.sort((a, b) => a.extractionTimeSeconds - b.extractionTimeSeconds);
    } else {
      arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    return arr;
  }, [beanShots, sortBy]);

  if (!ready) return <p className="text-sm text-ink-300">Laden…</p>;
  if (!bean) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-500">Boon niet gevonden.</p>
        <Link href="/beans" className="text-sm text-ink-700 underline">
          ← Bonen
        </Link>
      </div>
    );
  }

  const effective = effectiveShots(beanShots);
  const dialInCount = beanShots.length - effective.length;
  const avg = average(effective.map((s) => s.rating));
  const bestShots = [...effective].sort((a, b) => b.rating - a.rating);
  const top = bestShots[0];
  const bestGrind = mode(bestShots.slice(0, 3).map((s) => s.grindSize));
  const lastAdjustment = beanShots.find((s) => s.nextAdjustment);
  const tips = tipsForBean(bean, beanShots);

  return (
    <div className="space-y-8">
      <Link
        href="/beans"
        className="text-sm text-ink-300 hover:text-ink-700"
      >
        ← Bonen
      </Link>

      <header>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-3xl tracking-tighter2 text-ink-800 sm:text-4xl">
              {bean.name}
            </h1>
            {bean.roaster && (
              <p className="mt-1 text-sm text-ink-400">{bean.roaster}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/beans/${bean.id}/edit`}
              className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-50/40"
            >
              Bewerk
            </Link>
            <Link
              href={`/shots/new?beanId=${bean.id}`}
              className="rounded-lg bg-ink-800 px-3 py-2 text-sm font-medium text-paper transition hover:bg-ink-700"
            >
              Shot
            </Link>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Meta label="Herkomst" value={bean.origin} />
          <Meta label="Soort" value={bean.blend} />
          <Meta label="Branddatum" value={formatDateOnly(bean.roastDate)} numeric />
          <Meta
            label="Shots"
            value={String(beanShots.length)}
            sub={dialInCount > 0 ? `${dialInCount} dial-in` : undefined}
            numeric
          />
          <Meta
            label="Gem."
            value={effective.length > 0 ? avg.toFixed(1) : "—"}
            numeric
          />
        </dl>

        {bean.notes && (
          <p className="mt-5 border-l-2 border-line pl-4 text-sm italic text-ink-500">
            {bean.notes}
          </p>
        )}
      </header>

      <BaristaTips tips={tips} />

      {beanShots.length >= 2 && (
        <CoachCard bean={bean} setup={setup} shots={beanShots} />
      )}

      {beanShots.length > 0 && (
        <section>
          <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-ink-300">
            Rating-curve
          </p>
          <RatingCurve shots={beanShots} roastDate={bean.roastDate} />
        </section>
      )}

      {beanShots.length > 0 && (
        <section className="rounded-xl2 border border-line bg-card p-5 shadow-soft">
          <h2 className="font-display text-base tracking-tightish text-ink-800">
            Beste tot nu toe
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Highlight label="Maalgraad" value={bestGrind ?? "—"} numeric />
            <Highlight
              label="Top"
              value={
                top ? (
                  <span className="flex items-center gap-2">
                    <StarRating value={top.rating} readOnly size="sm" />
                    <span className="numeric text-ink-500">
                      1:{top.brewRatio.toFixed(2)}
                    </span>
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Highlight
              label="Laatste aanpassing"
              value={lastAdjustment?.nextAdjustment ?? "—"}
            />
          </div>
        </section>
      )}

      <section>
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg tracking-tightish text-ink-800">
            Shots
          </h2>
          {beanShots.length > 1 && (
            <SortControl value={sortBy} onChange={setSortBy} />
          )}
        </header>
        {sorted.length === 0 ? (
          <EmptyState
            title="Geen shots"
            description="Log er een voor deze boon."
            ctaHref={`/shots/new?beanId=${bean.id}`}
            ctaLabel="Nieuwe shot"
          />
        ) : (
          <div className="space-y-3">
            {sorted.map((s: ShotLog) => (
              <ShotCard key={s.id} shot={s} bean={bean} showBean={false} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Meta({
  label,
  value,
  sub,
  numeric = false,
}: {
  label: string;
  value?: string;
  sub?: string;
  numeric?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-ink-300">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm font-medium text-ink-800 ${numeric ? "numeric" : ""}`}
      >
        {value || "—"}
      </dd>
      {sub && (
        <p className="text-[10px] uppercase tracking-[0.16em] text-ink-300">
          {sub}
        </p>
      )}
    </div>
  );
}

function Highlight({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: React.ReactNode;
  numeric?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.16em] text-ink-300">
        {label}
      </p>
      <p
        className={`mt-1.5 text-sm text-ink-800 ${numeric ? "numeric font-medium" : ""}`}
      >
        {value}
      </p>
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
    { key: "date", label: "Datum" },
    { key: "rating", label: "Rating" },
    { key: "time", label: "Tijd" },
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
