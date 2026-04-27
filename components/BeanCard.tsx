import Link from "next/link";
import type { Bean, ShotLog } from "@/lib/types";
import { average, formatDateOnly } from "@/lib/utils";
import { StarRating } from "./StarRating";

type Props = {
  bean: Bean;
  shots: ShotLog[];
};

export function BeanCard({ bean, shots }: Props) {
  const avg = average(shots.map((s) => s.rating));
  const rounded = Math.round(avg) as 0 | 1 | 2 | 3 | 4 | 5;
  return (
    <Link
      href={`/beans/${bean.id}`}
      className="group block rounded-xl2 border border-line bg-card p-5 shadow-soft transition hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base tracking-tightish text-ink-800 group-hover:underline">
            {bean.name}
          </h3>
          {bean.roaster && (
            <p className="text-sm text-ink-400">{bean.roaster}</p>
          )}
        </div>
        <span className="numeric shrink-0 text-xs text-ink-300">
          {shots.length} {shots.length === 1 ? "shot" : "shots"}
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
            <dt className="text-ink-300">Brand</dt>
            <dd className="numeric text-ink-600">
              {formatDateOnly(bean.roastDate)}
            </dd>
          </>
        )}
      </dl>

      {shots.length > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <StarRating value={rounded} readOnly size="sm" />
          <span className="numeric text-xs text-ink-400">
            {avg.toFixed(1)}
          </span>
        </div>
      )}
    </Link>
  );
}
