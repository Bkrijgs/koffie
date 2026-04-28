import Link from "next/link";
import type { Bean, Rating, ShotLog } from "@/lib/types";
import { average, formatDateOnly } from "@/lib/utils";
import { StarRating } from "./StarRating";

type Props = {
  bean: Bean;
  shots: ShotLog[];
};

export function BeanCard({ bean, shots }: Props) {
  const avg = average(shots.map((s) => s.rating));
  return (
    <Link
      href={`/beans/${bean.id}`}
      className="group relative block rounded-xl2 border-2 border-line bg-paper p-5 transition hover:border-ink-200"
    >
      <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-400">
        <span className="h-1.5 w-1.5 rounded-full bg-gold-400" aria-hidden />
        Boon
      </span>

      <div className="pr-14">
        <h3 className="font-display text-lg tracking-tightish text-ink-800 group-hover:underline">
          {bean.name}
        </h3>
        {bean.roaster && (
          <p className="text-sm italic text-ink-400">{bean.roaster}</p>
        )}
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
            <dt className="text-ink-300">Brand</dt>
            <dd className="numeric text-ink-600">
              {formatDateOnly(bean.roastDate)}
            </dd>
          </>
        )}
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-3">
        <span className="numeric text-xs text-ink-400">
          {shots.length} {shots.length === 1 ? "shot" : "shots"}
        </span>
        {shots.length > 0 ? (
          <span className="flex items-center gap-2">
            <StarRating value={roundHalf(avg)} readOnly size="sm" />
            <span className="numeric text-xs text-ink-400">
              {avg.toFixed(1)}
            </span>
          </span>
        ) : (
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-300">
            Nog niet gedialed
          </span>
        )}
      </div>
    </Link>
  );
}

function roundHalf(n: number): Rating | 0 {
  const v = Math.round(n * 2) / 2;
  if (v <= 0) return 0;
  if (v >= 5) return 5;
  return v as Rating;
}
