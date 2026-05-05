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
  const dimmed = shot.dialIn ? "opacity-70" : "";
  return (
    <article className="group relative cursor-pointer rounded-xl2 border border-line bg-card p-5 shadow-soft transition hover:shadow-lift">
      {/* Stretched link overlay: covers the entire card so clicks anywhere
          open the shot for editing. The bean name uses `position: relative`
          to sit above this overlay and keep its own destination. */}
      <Link
        href={`/shots/${shot.id}/edit`}
        aria-label={`Shot van ${bean?.name ?? "boon"} op ${formatDate(shot.createdAt)} openen`}
        className="absolute inset-0 z-10 rounded-xl2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-barista-400"
      >
        <span className="sr-only">Openen</span>
      </Link>

      {shot.dialIn && (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-300">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-300" aria-hidden />
          Dial-in
        </span>
      )}

      <header
        className={`flex items-start justify-between gap-3 ${shot.dialIn ? "pr-20" : ""}`}
      >
        <div className="min-w-0">
          {showBean && bean && (
            <Link
              href={`/beans/${bean.id}`}
              className="relative z-20 inline-block font-display text-base tracking-tightish text-ink-800 hover:underline"
            >
              {bean.name}
            </Link>
          )}
          <p className="numeric text-xs text-ink-300">
            {formatDate(shot.createdAt)}
          </p>
        </div>
        {!shot.dialIn && (
          <StarRating value={shot.rating} readOnly size="sm" />
        )}
      </header>

      <dl
        className={`mt-4 grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-5 ${dimmed}`}
      >
        <Stat label="Maalgraad" value={shot.grindSize} />
        <Stat label="Dose" value={`${formatNum(shot.doseGrams)} g`} />
        <Stat label="Yield" value={`${formatNum(shot.yieldGrams)} g`} />
        <Stat label="Ratio" value={`1:${shot.brewRatio.toFixed(2)}`} />
        <Stat label="Tijd" value={`${shot.extractionTimeSeconds}s`} />
      </dl>

      {(shot.notes || shot.nextAdjustment) && (
        <div
          className={`mt-4 space-y-1.5 border-t border-line pt-3 text-sm ${dimmed}`}
        >
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
