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
    <article className="rounded-2xl border border-crema-100 bg-white p-5 shadow-soft">
      <header className="flex items-start justify-between gap-3">
        <div>
          {showBean && bean && (
            <Link
              href={`/beans/${bean.id}`}
              className="text-sm font-semibold text-espresso-700 hover:text-crema-500"
            >
              {bean.name}
            </Link>
          )}
          <p className="text-xs text-espresso-400">
            {formatDate(shot.createdAt)}
          </p>
        </div>
        <StarRating value={shot.rating} readOnly size="sm" />
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-espresso-600 sm:grid-cols-4">
        <Stat label="Maalgraad" value={shot.grindSize} />
        <Stat label="Dose" value={`${shot.doseGrams} g`} />
        <Stat label="Yield" value={`${shot.yieldGrams} g`} />
        <Stat label="Ratio" value={`1 : ${shot.brewRatio.toFixed(2)}`} />
        <Stat label="Tijd" value={`${shot.extractionTimeSeconds} s`} />
      </dl>

      {(shot.notes || shot.nextAdjustment) && (
        <div className="mt-3 space-y-2 border-t border-crema-100 pt-3 text-sm">
          {shot.notes && (
            <p className="text-espresso-600">
              <span className="font-medium text-espresso-500">Notities:</span>{" "}
              {shot.notes}
            </p>
          )}
          {shot.nextAdjustment && (
            <p className="text-espresso-600">
              <span className="font-medium text-espresso-500">
                Volgende keer:
              </span>{" "}
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
      <dt className="text-[11px] uppercase tracking-wide text-espresso-400">
        {label}
      </dt>
      <dd className="font-medium text-espresso-700">{value}</dd>
    </div>
  );
}
