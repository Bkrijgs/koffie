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
  return (
    <article className="rounded-xl2 border border-line bg-card p-5 shadow-soft transition hover:shadow-lift">
      <header className="flex items-start justify-between gap-3">
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
