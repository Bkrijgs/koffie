"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useKoffie } from "@/lib/useKoffie";
import { ShotCard } from "@/components/ShotCard";
import { StarRating } from "@/components/StarRating";
import { EmptyState } from "@/components/EmptyState";
import { average, formatDateOnly, mode } from "@/lib/utils";
import type { ShotLog } from "@/lib/types";

type SortKey = "date" | "rating" | "time";

export default function BeanDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { ready, beans, shots } = useKoffie();
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
          b.rating - a.rating || +new Date(b.createdAt) - +new Date(a.createdAt),
      );
    } else if (sortBy === "time") {
      arr.sort((a, b) => a.extractionTimeSeconds - b.extractionTimeSeconds);
    } else {
      arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    return arr;
  }, [beanShots, sortBy]);

  if (!ready) return <p className="text-sm text-espresso-400">Laden…</p>;
  if (!bean) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-espresso-500">Boon niet gevonden.</p>
        <Link href="/beans" className="text-sm text-crema-500 underline">
          ← Terug naar bonen
        </Link>
      </div>
    );
  }

  const avg = average(beanShots.map((s) => s.rating));
  const bestShots = [...beanShots].sort((a, b) => b.rating - a.rating);
  const top = bestShots[0];
  const bestGrind = mode(bestShots.slice(0, 3).map((s) => s.grindSize));
  const lastAdjustment = beanShots.find((s) => s.nextAdjustment);

  return (
    <div className="space-y-6">
      <Link
        href="/beans"
        className="text-sm text-espresso-400 hover:text-crema-500"
      >
        ← Bonen
      </Link>

      <header className="rounded-2xl border border-crema-100 bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-espresso-700">
              {bean.name}
            </h1>
            {bean.roaster && (
              <p className="text-sm text-espresso-500">{bean.roaster}</p>
            )}
          </div>
          <Link
            href={`/shots/new?beanId=${bean.id}`}
            className="whitespace-nowrap rounded-full bg-espresso-600 px-3 py-1.5 text-sm font-medium text-crema-50 hover:bg-espresso-700"
          >
            + Shot
          </Link>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Meta label="Herkomst" value={bean.origin} />
          <Meta label="Branddatum" value={formatDateOnly(bean.roastDate)} />
          <Meta label="Shots" value={String(beanShots.length)} />
          <Meta
            label="Gem. rating"
            value={beanShots.length > 0 ? avg.toFixed(1) : "—"}
          />
        </dl>

        {bean.notes && (
          <p className="mt-4 rounded-xl bg-crema-50 px-3 py-2 text-sm text-espresso-600">
            {bean.notes}
          </p>
        )}
      </header>

      {beanShots.length > 0 && (
        <section className="rounded-2xl border border-crema-100 bg-white p-5 shadow-soft">
          <h2 className="text-base font-semibold text-espresso-700">
            Beste instellingen tot nu toe
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Highlight label="Beste maalgraad" value={bestGrind ?? "—"} />
            <Highlight
              label="Top shot"
              value={
                top ? (
                  <span className="flex items-center gap-2">
                    <StarRating value={top.rating} readOnly size="sm" />
                    <span>1 : {top.brewRatio.toFixed(2)}</span>
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
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-espresso-700">
            Shotgeschiedenis
          </h2>
          {beanShots.length > 1 && (
            <SortControl value={sortBy} onChange={setSortBy} />
          )}
        </header>
        {sorted.length === 0 ? (
          <EmptyState
            title="Nog geen shots"
            description="Log een eerste shot voor deze boon."
            ctaHref={`/shots/new?beanId=${bean.id}`}
            ctaLabel="+ Nieuwe shot"
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

function Meta({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-espresso-400">
        {label}
      </dt>
      <dd className="font-medium text-espresso-700">{value || "—"}</dd>
    </div>
  );
}

function Highlight({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-crema-50 px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-espresso-400">
        {label}
      </p>
      <p className="mt-1 font-medium text-espresso-700">{value}</p>
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
    <div className="inline-flex rounded-full border border-crema-200 bg-white p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded-full px-3 py-1 transition ${
            value === o.key
              ? "bg-espresso-600 text-crema-50"
              : "text-espresso-500 hover:text-espresso-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
