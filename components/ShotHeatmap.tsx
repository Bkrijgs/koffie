import type { ShotLog } from "@/lib/types";
import { effectiveShots, formatDateOnly } from "@/lib/utils";

type Props = {
  shots: ShotLog[];
};

const MIN_WEEKS = 4;
const MAX_WEEKS = 12;
const MONTHS_NL = [
  "jan",
  "feb",
  "mrt",
  "apr",
  "mei",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

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
  const dow = (today.getDay() + 6) % 7; // 0 = Monday

  // Schaal het venster naar je oudste shot, met een buffer-week vóór die
  // datum zodat de eerste cel niet helemaal in de hoek staat. Zo blijft de
  // heatmap compact voor nieuwe gebruikers en groeit hij mee tot 12 weken.
  const oldestMs = Math.min(
    ...effective.map((s) => +startOfDay(new Date(s.createdAt))),
  );
  const daysSinceOldest = Math.floor((+today - oldestMs) / (1000 * 60 * 60 * 24));
  const weeksSpan = Math.ceil((daysSinceOldest + 1) / 7) + 1;
  const WEEKS = Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, weeksSpan));

  const firstMonday = new Date(today);
  firstMonday.setDate(today.getDate() - dow - (WEEKS - 1) * 7);

  const countByKey = new Map<string, number>();
  let total = 0;
  const windowStart = +firstMonday;
  const windowEnd = +today;
  for (const s of effective) {
    const d = startOfDay(new Date(s.createdAt));
    if (+d < windowStart || +d > windowEnd) continue;
    const key = d.toISOString().slice(0, 10);
    countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
    total += 1;
  }

  const columns: {
    date: Date;
    count: number;
    future: boolean;
    monthLabel: string | null;
  }[][] = [];
  for (let c = 0; c < WEEKS; c++) {
    const col: {
      date: Date;
      count: number;
      future: boolean;
      monthLabel: string | null;
    }[] = [];
    for (let r = 0; r < 7; r++) {
      const d = new Date(firstMonday);
      d.setDate(firstMonday.getDate() + c * 7 + r);
      const key = d.toISOString().slice(0, 10);
      col.push({
        date: d,
        count: countByKey.get(key) ?? 0,
        future: +d > +today,
        monthLabel: null,
      });
    }
    // Label the column with its month if this is the first column to
    // contain the 1st day of that month (or the very first column).
    const firstOfMonthInCol = col.find((cell) => cell.date.getDate() <= 7);
    if (firstOfMonthInCol) {
      const prevCol = columns[columns.length - 1];
      const prevMonth = prevCol
        ? prevCol[0].date.getMonth()
        : -1;
      if (firstOfMonthInCol.date.getMonth() !== prevMonth) {
        col[0] = {
          ...col[0],
          monthLabel: MONTHS_NL[firstOfMonthInCol.date.getMonth()],
        };
      }
    }
    columns.push(col);
  }

  return (
    <div>
      <p className="mb-3 text-xs text-ink-400">
        <span className="numeric text-ink-700">{total}</span>{" "}
        {total === 1 ? "shot" : "shots"} in {WEEKS}{" "}
        {WEEKS === 1 ? "week" : "weken"}
      </p>

      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1 pt-5 text-[10px] uppercase tracking-wider text-ink-300">
          <span className="h-4 leading-4">ma</span>
          <span className="h-4 leading-4">&nbsp;</span>
          <span className="h-4 leading-4">wo</span>
          <span className="h-4 leading-4">&nbsp;</span>
          <span className="h-4 leading-4">vr</span>
          <span className="h-4 leading-4">&nbsp;</span>
          <span className="h-4 leading-4">zo</span>
        </div>
        <div className="min-w-0 overflow-x-auto">
          <div className="flex gap-1">
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-1">
                <div className="h-4 text-[10px] uppercase tracking-wider text-ink-400">
                  {col[0].monthLabel ?? ""}
                </div>
                {col.map((cell, ri) =>
                  cell.future ? (
                    <div key={ri} className="h-4 w-4" />
                  ) : (
                    <div
                      key={ri}
                      className={`h-4 w-4 rounded-sm ${bucketClass(cell.count)}`}
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
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-300">
        <span>Minder</span>
        <span className="h-3 w-3 rounded-sm bg-line" />
        <span className="h-3 w-3 rounded-sm bg-barista-100" />
        <span className="h-3 w-3 rounded-sm bg-barista-300" />
        <span className="h-3 w-3 rounded-sm bg-barista-400" />
        <span>Meer</span>
      </div>
    </div>
  );
}
