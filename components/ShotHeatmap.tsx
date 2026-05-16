import type { ShotLog } from "@/lib/types";
import { effectiveShots, formatDateOnly } from "@/lib/utils";

type Props = {
  shots: ShotLog[];
};

const WEEKS = 12;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function bucketClass(count: number): string {
  if (count === 0) return "bg-line";
  if (count === 1) return "bg-barista-100";
  if (count === 2) return "bg-barista-300";
  return "bg-barista-400";
}

export function ShotHeatmap({ shots }: Props) {
  const effective = effectiveShots(shots);
  if (effective.length === 0) return null;

  const today = startOfDay(new Date());
  // dow = 0 for Monday, 6 for Sunday
  const dow = (today.getDay() + 6) % 7;

  // Anchor: Monday of the current week, then go back WEEKS-1 weeks.
  const firstMonday = new Date(today);
  firstMonday.setDate(today.getDate() - dow - (WEEKS - 1) * 7);

  const countByKey = new Map<string, number>();
  for (const s of effective) {
    const d = startOfDay(new Date(s.createdAt));
    const key = d.toISOString().slice(0, 10);
    countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
  }

  const columns: { date: Date; count: number; future: boolean }[][] = [];
  for (let c = 0; c < WEEKS; c++) {
    const col: { date: Date; count: number; future: boolean }[] = [];
    for (let r = 0; r < 7; r++) {
      const d = new Date(firstMonday);
      d.setDate(firstMonday.getDate() + c * 7 + r);
      const key = d.toISOString().slice(0, 10);
      col.push({
        date: d,
        count: countByKey.get(key) ?? 0,
        future: +d > +today,
      });
    }
    columns.push(col);
  }

  return (
    <div className="flex items-start gap-1.5">
      <div className="flex flex-col gap-[2px] pt-[2px] text-[9px] uppercase tracking-wider text-ink-300">
        <span className="h-3 leading-3">M</span>
        <span className="h-3 leading-3">&nbsp;</span>
        <span className="h-3 leading-3">W</span>
        <span className="h-3 leading-3">&nbsp;</span>
        <span className="h-3 leading-3">V</span>
        <span className="h-3 leading-3">&nbsp;</span>
        <span className="h-3 leading-3">Z</span>
      </div>
      <div className="flex gap-[2px]">
        {columns.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[2px]">
            {col.map((cell, ri) =>
              cell.future ? (
                <div key={ri} className="h-3 w-3" />
              ) : (
                <div
                  key={ri}
                  className={`h-3 w-3 rounded-sm ${bucketClass(cell.count)}`}
                  title={`${formatDateOnly(cell.date.toISOString())} — ${
                    cell.count
                  } shot${cell.count !== 1 ? "s" : ""}`}
                />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
