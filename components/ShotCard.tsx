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
  const awaitingRating = shot.draft && !shot.rating;
  const badgeCount = (shot.draft ? 1 : 0) + (shot.dialIn ? 1 : 0);
  return (
    <article
      className={`group relative cursor-pointer rounded-xl2 border bg-card p-5 shadow-soft transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lift hover:border-barista-100 ${
        shot.draft ? "border-gold-300/70" : "border-line"
      }`}
    >
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

      {badgeCount > 0 && (
        <span className="absolute right-4 top-4 flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.2em]">
          {shot.draft && (
            <span className="inline-flex items-center gap-1.5 text-gold-500">
              <span
                className="h-1.5 w-1.5 rounded-full bg-gold-400"
                aria-hidden
              />
              Concept
            </span>
          )}
          {shot.dialIn && (
            <span className="inline-flex items-center gap-1.5 text-ink-300">
              <span
                className="h-1.5 w-1.5 rounded-full bg-ink-300"
                aria-hidden
              />
              Dial-in
            </span>
          )}
        </span>
      )}

      <header
        className={`flex items-start justify-between gap-3 ${
          badgeCount > 1 ? "pr-44" : badgeCount === 1 ? "pr-24" : ""
        }`}
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
        {/* Zonder rating tonen we geen sterren: nul sterren leest als een
            slechte shot, terwijl de rating simpelweg nog moet komen. */}
        {!shot.dialIn && !awaitingRating && (
          <StarRating value={shot.rating} readOnly size="sm" />
        )}
      </header>

      <dl
        className={`mt-4 grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-5 ${dimmed}`}
      >
        <Stat label="Maalgraad" value={String(shot.grindSize)} />
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
