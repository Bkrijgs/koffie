import Link from "next/link";
import type { Bean, Rating, ShotLog } from "@/lib/types";
import type { BagStats } from "@/lib/inventory";
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
import { GiftBadge, PriceTierBadge } from "./PriceTierBadge";
import { StarRating } from "./StarRating";

type Props = {
  bean: Bean;
  shots: ShotLog[];
  /** Cijfers van de open zak, als er een geregistreerd is. */
  stock?: BagStats;
};

export function BeanCard({ bean, shots, stock }: Props) {
  const effective = effectiveShots(shots);
  const draftCount = shots.filter((s) => s.draft).length;
  const dialInCount = shots.filter((s) => s.dialIn && !s.draft).length;
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
          {draftCount > 0 && (
            <span className="block text-[10px] text-gold-500">
              {draftCount} concept
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
        {(perKg !== undefined || bean.gift) && (
          <>
            <dt className="text-ink-300">Prijs</dt>
            <dd className="flex flex-wrap items-center gap-1.5">
              {perKg !== undefined && (
                <>
                  <span className="numeric text-ink-600">
                    {formatEuro(perKg)}/kg
                  </span>
                  <PriceTierBadge tier={priceTier(perKg)} />
                </>
              )}
              {bean.gift && <GiftBadge />}
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

      {stock && <StockBar stock={stock} />}

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

/** Open zak: hoeveel er nog in zit en hoe lang je daar nog mee doet. */
function StockBar({ stock }: { stock: BagStats }) {
  const pct =
    stock.bag.grams > 0
      ? Math.round((stock.remainingGrams / stock.bag.grams) * 100)
      : 0;
  const days = stock.projectedDaysLeft;
  // Onder een week wordt het iets om rekening mee te houden.
  const low = days !== null && days <= 7;

  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="numeric text-ink-600">
          ± {Math.round(stock.remainingGrams)} g over
        </span>
        <span className={`numeric ${low ? "text-clay-500" : "text-ink-400"}`}>
          {days === null
            ? "verbruik onbekend"
            : days === 0
              ? "vandaag op"
              : `nog ~${days} ${days === 1 ? "dag" : "dagen"}`}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full ${low ? "bg-clay-400" : "bg-ink-400"}`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
    </div>
  );
}

function roundHalf(n: number): Rating | 0 {
  const v = Math.round(n * 2) / 2;
  if (v <= 0) return 0;
  if (v >= 5) return 5;
  return v as Rating;
}
