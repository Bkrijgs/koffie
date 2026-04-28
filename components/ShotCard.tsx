import Link from "next/link";
import type { Bean, ShotLog } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { StarRating } from "./StarRating";

type Props = {
  shot: ShotLog;
  bean?: Bean;
  showBean?: boolean;
};

export function ShotCard({ shot, bean, showBean = true }: Props) {
  const ribbon =
    shot.rating >= 4
      ? "bg-gold-400"
      : shot.rating >= 3
        ? "bg-gold-300"
        : "bg-ink-100";

  return (
    <article className="relative rounded-xl2 border border-line bg-card p-5 pl-7 shadow-soft transition hover:shadow-lift">
      <span
        aria-hidden
        className={`absolute inset-y-3 left-0 w-1 rounded-r ${ribbon}`}
      />
      <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-400">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-700" aria-hidden />
        Shot
      </span>

      <header className="flex items-start justify-between gap-3 pr-14">
        <div className="min-w-0">
          {showBean && bean && (
            <Link
              href={`/beans/${bean.id}`}
              className="font-display text-base tracking-tightish text-ink-800 hover:underline"
            >
              {bean.name}
            </Link>
          )}
          <p className="numeric text-xs text-ink-300">
            {formatDate(shot.createdAt)}
          </p>
        </div>
        <StarRating value={shot.rating} readOnly size="sm" />
      </header>

      <dl className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-5">
        <Stat label="Maalgraad" value={shot.grindSize} />
        <Stat label="Dose" value={`${formatNum(shot.doseGrams)} g`} />
        <Stat label="Yield" value={`${formatNum(shot.yieldGrams)} g`} />
        <Stat label="Ratio" value={`1:${shot.brewRatio.toFixed(2)}`} />
        <Stat label="Tijd" value={`${shot.extractionTimeSeconds}s`} />
      </dl>

      {(shot.notes || shot.nextAdjustment) && (
        <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
          {shot.notes && (
            <p className="text-ink-600">
              <span className="text-ink-400">Smaak.</span> {shot.notes}
            </p>
          )}
          {shot.nextAdjustment && (
            <p className="text-ink-600">
              <span className="text-ink-400">Volgende.</span>{" "}
              {shot.nextAdjustment}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <Link
          href={`/shots/${shot.id}/edit`}
          className="text-xs text-ink-300 transition hover:text-ink-700"
          aria-label="Shot bewerken"
        >
          Bewerken →
        </Link>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-ink-300">
        {label}
      </dt>
      <dd className="numeric mt-0.5 text-sm font-medium text-ink-800">
        {value}
      </dd>
    </div>
  );
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
