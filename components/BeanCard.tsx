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
      className="block rounded-2xl border border-crema-100 bg-white p-5 shadow-soft transition hover:border-crema-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-espresso-700">
            {bean.name}
          </h3>
          {bean.roaster && (
            <p className="text-sm text-espresso-400">{bean.roaster}</p>
          )}
        </div>
        <span className="rounded-full bg-crema-50 px-3 py-1 text-xs font-medium text-espresso-500">
          {shots.length} {shots.length === 1 ? "shot" : "shots"}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-espresso-400">
        {bean.origin && (
          <>
            <dt className="font-medium text-espresso-500">Herkomst</dt>
            <dd>{bean.origin}</dd>
          </>
        )}
        {bean.roastDate && (
          <>
            <dt className="font-medium text-espresso-500">Branddatum</dt>
            <dd>{formatDateOnly(bean.roastDate)}</dd>
          </>
        )}
      </dl>

      {shots.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <StarRating value={rounded} readOnly size="sm" />
          <span className="text-xs text-espresso-400">
            gem. {avg.toFixed(1)}
          </span>
        </div>
      )}
    </Link>
  );
}
