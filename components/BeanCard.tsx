import Link from "next/link";
import type { Bean, Rating, ShotLog } from "@/lib/types";
import {
  average,
  costPerShot,
  costPerStar,
  effectiveShots,
  formatDateOnly,
  formatEuro,
  priceTier,
  pricePerKg,
} from "@/lib/utils";
import { PriceTierBadge } from "./PriceTierBadge";
import { StarRating } from "./StarRating";

type Props = {
  bean: Bean;
  shots: ShotLog[];
};

export function BeanCard({ bean, shots }: Props) {
  const effective = effectiveShots(shots);
  const dialInCount = shots.length - effective.length;
  const avg = average(effective.map((s) => s.rating));
  const perKg = pricePerKg(bean);
  const starCost =
    perKg !== undefined && effective.length > 0
      ? costPerStar(
          average(effective.map((s) => costPerShot(s.doseGrams, perKg))),
          avg,
        )
      : undefined;
  return (
    <Link
      href={`/beans/${bean.id}`}
      className="group block rounded-xl2 bg-kraft p-5 ring-1 ring-line transition-all duration-200 ease-out hover:-translate-y-0.5 hover:ring-barista-300 hover:shadow-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-display text-lg tracking-tightish text-ink-800 group-hover:underline">
            {bean.name}
            {!bean.inStock && (
              <span className="shrink-0 rounded-full bg-ink-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-paper no-underline">
                Op
              </span>
            )}
          </h3>
          {bean.roaster && (
            <p className="text-sm text-ink-500">{bean.roaster}</p>
          )}
        </div>
        <span className="numeric shrink-0 text-right text-xs text-ink-400">
          {shots.length} {shots.length === 1 ? "shot" : "shots"}
          {dialInCount > 0 && (
            <span className="block text-[10px] text-ink-300">
              {dialInCount} dial-in
            </span>
          )}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {bean.origin && (
          <>
            <dt className="text-ink-300">Herkomst</dt>
            <dd className="text-ink-600">{bean.origin}</dd>
          </>
        )}
        {bean.roastDate && (
          <>
            <dt className="text-ink-300">Branddatum</dt>
            <dd className="numeric text-ink-600">
              {formatDateOnly(bean.roastDate)}
            </dd>
          </>
        )}
        {perKg !== undefined && (
          <>
            <dt className="text-ink-300">Prijs</dt>
            <dd className="flex items-center gap-1.5">
              <span className="numeric text-ink-600">
                {formatEuro(perKg)}/kg
              </span>
              <PriceTierBadge tier={priceTier(perKg)} />
            </dd>
          </>
        )}
        {starCost !== undefined && (
          <>
            <dt className="text-ink-300">Waarde</dt>
            <dd className="numeric text-ink-600">
              {formatEuro(starCost)}/ster
            </dd>
          </>
        )}
      </dl>

      {effective.length > 0 ? (
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <StarRating value={roundHalf(avg)} readOnly size="sm" />
          <span className="numeric text-xs text-ink-500">
            {avg.toFixed(1)} gem.
          </span>
        </div>
      ) : (
        <div className="mt-4 border-t border-line pt-3">
          <span className="text-xs text-ink-400">Nog niet gedialed</span>
        </div>
      )}
    </Link>
  );
}

function roundHalf(n: number): Rating | 0 {
  const v = Math.round(n * 2) / 2;
  if (v <= 0) return 0;
  if (v >= 5) return 5;
  return v as Rating;
}
