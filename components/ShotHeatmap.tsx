"use client";

import { useEffect, useRef, useState } from "react";
import type { ShotLog } from "@/lib/types";
import { effectiveShots, formatDateOnly, localDateKey } from "@/lib/utils";

type Props = {
  shots: ShotLog[];
  selectedDateKey?: string | null;
  onSelectDay?: (dateKey: string) => void;
};

const MIN_WEEKS = 4;
const MAX_WEEKS = 40;
const CELL_PX = 16;
const GAP_PX = 4;
const COL_PX = CELL_PX + GAP_PX;
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
  if (count === 1) return "bg-barista-300/50";
  if (count === 2) return "bg-barista-400";
  return "bg-barista-500";
}

export function ShotHeatmap({ shots, selectedDateKey, onSelectDay }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [weeks, setWeeks] = useState(MIN_WEEKS);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      // Hoeveel kolommen passen er binnen de beschikbare breedte? Iets
      // conservatief (− GAP_PX) zodat sub-pixel rendering niet alsnog
      // overflow geeft.
      const fits = Math.floor((w - GAP_PX) / COL_PX);
      setWeeks(Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, fits)));
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const effective = effectiveShots(shots);
  if (effective.length === 0) return null;

  const today = startOfDay(new Date());
  const dow = (today.getDay() + 6) % 7;

  const firstMonday = new Date(today);
  firstMonday.setDate(today.getDate() - dow - (weeks - 1) * 7);

  const countByKey = new Map<string, number>();
  let total = 0;
  const windowStart = +firstMonday;
  const windowEnd = +today;
  for (const s of effective) {
    const d = startOfDay(new Date(s.createdAt));
    if (+d < windowStart || +d > windowEnd) continue;
    const key = localDateKey(d);
    countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
    total += 1;
  }

  const columns: {
    date: Date;
    count: number;
    future: boolean;
    monthLabel: string | null;
  }[][] = [];
  let lastLabeledMonth = -1;
  for (let c = 0; c < weeks; c++) {
    const col: {
      date: Date;
      count: number;
      future: boolean;
      monthLabel: string | null;
    }[] = [];
    for (let r = 0; r < 7; r++) {
      const d = new Date(firstMonday);
      d.setDate(firstMonday.getDate() + c * 7 + r);
      const key = localDateKey(d);
      col.push({
        date: d,
        count: countByKey.get(key) ?? 0,
        future: +d > +today,
        monthLabel: null,
      });
    }
    const colMonth = col[0].date.getMonth();
    if (colMonth !== lastLabeledMonth) {
      col[0] = { ...col[0], monthLabel: MONTHS_NL[colMonth] };
      lastLabeledMonth = colMonth;
    }
    columns.push(col);
  }

  return (
    <div>
      <p className="mb-3 text-xs text-ink-400">
        <span className="numeric text-ink-700">{total}</span>{" "}
        {total === 1 ? "shot" : "shots"} in {weeks}{" "}
        {weeks === 1 ? "week" : "weken"}
      </p>

      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1 pt-5 text-[10px] uppercase tracking-wider text-ink-300">
          <span className="h-4 leading-4">ma</span>
          <span className="h-4 leading-4">di</span>
          <span className="h-4 leading-4">wo</span>
          <span className="h-4 leading-4">do</span>
          <span className="h-4 leading-4">vr</span>
          <span className="h-4 leading-4">za</span>
          <span className="h-4 leading-4">zo</span>
        </div>
        <div ref={gridRef} className="min-w-0 flex-1 overflow-hidden">
          <div className="flex justify-end gap-1">
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-1">
                <div className="h-4 text-[10px] uppercase tracking-wider text-ink-400">
                  {col[0].monthLabel ?? ""}
                </div>
                {col.map((cell, ri) => {
                  if (cell.future) return <div key={ri} className="h-4 w-4" />;
                  const key = localDateKey(cell.date);
                  const isSelected = selectedDateKey === key;
                  const baseCls = `h-4 w-4 rounded-sm transition-transform duration-150 ${bucketClass(cell.count)}`;
                  const ringCls = isSelected
                    ? " ring-2 ring-ink-800 ring-offset-1 ring-offset-paper"
                    : "";
                  const title = `${formatDateOnly(cell.date.toISOString())} — ${
                    cell.count
                  } shot${cell.count !== 1 ? "s" : ""}`;
                  if (cell.count === 0 || !onSelectDay) {
                    return (
                      <div
                        key={ri}
                        className={`${baseCls} hover:scale-150${ringCls}`}
                        title={title}
                      />
                    );
                  }
                  return (
                    <button
                      key={ri}
                      type="button"
                      onClick={() => onSelectDay(key)}
                      className={`${baseCls} cursor-pointer hover:scale-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-barista-400${ringCls}`}
                      title={title}
                      aria-label={title}
                      aria-pressed={isSelected}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-300">
        <span>Minder</span>
        <span className="h-3 w-3 rounded-sm bg-line" />
        <span className="h-3 w-3 rounded-sm bg-barista-300/50" />
        <span className="h-3 w-3 rounded-sm bg-barista-400" />
        <span className="h-3 w-3 rounded-sm bg-barista-500" />
        <span>Meer</span>
      </div>
    </div>
  );
}
