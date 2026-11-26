"use client";

import { useState } from "react";
import type { ShotLog } from "@/lib/types";
import { beanSweetSpot } from "@/lib/tips";
import { effectiveShots } from "@/lib/utils";

type Props = {
  shots: ShotLog[];
  /** Hoeveel beoordeelde shots er als punt in de grafiek komen. */
  limit?: number;
};

const VIEW_W = 320;
const VIEW_H = 190;
const PAD_L = 30;
const PAD_R = 10;
const PAD_T = 12;
const PAD_B = 24;

/**
 * Waar zaten je shots ten opzichte van de sweet spot van déze boon?
 *
 * De band komt uit `beanSweetSpot()`: die leert de goede tijd- en ratio-range
 * uit de ≥4★ shots van deze boon zelf, en valt terug op de algemene
 * espresso-vuistregels zolang er te weinig van zijn. Bewust alleen "waar sta
 * je" — wat je moet veranderen zegt de CoachCard eronder al.
 */
export function SweetSpotChart({ shots, limit = 10 }: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  const effective = effectiveShots(shots);
  const spot = beanSweetSpot(effective);

  if (effective.length === 0) {
    return (
      <p className="text-xs text-ink-300">
        Nog geen beoordeelde shots voor deze boon.
      </p>
    );
  }

  // Nieuwste eerst binnenkomen, oudste eerst tekenen zodat de nieuwste shot
  // bovenop ligt en zijn ring niet onder een ouder punt verdwijnt.
  const points = effective
    .slice(0, limit)
    .map((shot) => ({ shot }))
    .reverse();
  const latest = points[points.length - 1].shot;

  const times = points.map((p) => p.shot.extractionTimeSeconds);
  const ratios = points.map((p) => p.shot.brewRatio);
  const xLo = Math.min(spot.timeLow, ...times) - 2;
  const xHi = Math.max(spot.timeHigh, ...times) + 2;
  const yLo = Math.min(spot.ratioLow, ...ratios) - 0.15;
  const yHi = Math.max(spot.ratioHigh, ...ratios) + 0.15;

  const xFor = (t: number) =>
    PAD_L + ((t - xLo) / (xHi - xLo)) * (VIEW_W - PAD_L - PAD_R);
  const yFor = (r: number) =>
    VIEW_H - PAD_B - ((r - yLo) / (yHi - yLo)) * (VIEW_H - PAD_T - PAD_B);

  const bandX = xFor(spot.timeLow);
  const bandW = xFor(spot.timeHigh) - bandX;
  const bandY = yFor(spot.ratioHigh);
  const bandH = yFor(spot.ratioLow) - bandY;

  const shown = selected !== null ? points[selected].shot : latest;

  return (
    <div className="space-y-4">
      <BalanceReadout shot={latest} spot={spot} />

      <div>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full"
          role="img"
          aria-label={`Extractietijd tegen brew ratio van de laatste ${points.length} beoordeelde shots, met de sweet spot van deze boon`}
        >
          {/* De sweet spot als vlak eróchter: "mik hierin" leest sneller dan
              een lijn die je moet interpreteren. */}
          <rect
            x={bandX}
            y={bandY}
            width={bandW}
            height={bandH}
            className="fill-barista-100"
            opacity={spot.learned ? 0.9 : 0.5}
          />
          <rect
            x={bandX}
            y={bandY}
            width={bandW}
            height={bandH}
            fill="none"
            className="stroke-barista-300"
            strokeWidth="0.6"
            strokeDasharray={spot.learned ? undefined : "2 2"}
          />

          {/* Assen */}
          <line
            x1={PAD_L}
            x2={VIEW_W - PAD_R}
            y1={VIEW_H - PAD_B}
            y2={VIEW_H - PAD_B}
            className="stroke-line"
            strokeWidth="0.8"
          />
          <line
            x1={PAD_L}
            x2={PAD_L}
            y1={PAD_T}
            y2={VIEW_H - PAD_B}
            className="stroke-line"
            strokeWidth="0.8"
          />

          <AxisLabels
            xLo={xLo}
            xHi={xHi}
            yLo={yLo}
            yHi={yHi}
            xFor={xFor}
            yFor={yFor}
          />

          {points.map((p, i) => {
            const cx = xFor(p.shot.extractionTimeSeconds);
            const cy = yFor(p.shot.brewRatio);
            const isLatest = p.shot.id === latest.id;
            const isSelected = selected === i;
            return (
              <g key={p.shot.id}>
                {isLatest && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="7"
                    fill="none"
                    className="anim-curve-point stroke-ink-800"
                    strokeWidth="1"
                    style={{ animationDelay: "0.45s" }}
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={dotRadius(p.shot.rating) + (isSelected ? 1.5 : 0)}
                  className={`anim-curve-point ${dotClass(p.shot.rating)}`}
                  style={{
                    animationDelay: `${0.3 + i * 0.05}s`,
                    transition: "r 0.15s ease-out",
                  }}
                />
                {/* Ruime, onzichtbare trefzone: op een telefoon is een punt
                    van 3px niet te raken. */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="10"
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => setSelected(isSelected ? null : i)}
                  onMouseEnter={() => setSelected(i)}
                  onMouseLeave={() => setSelected(null)}
                />
              </g>
            );
          })}
        </svg>

        <div className="mt-1 flex items-baseline justify-between gap-3 text-[11px] text-ink-400">
          <span className="numeric">
            {shown === latest ? "Laatste shot" : "Shot"} ·{" "}
            {shown.extractionTimeSeconds} s · 1:
            {shown.brewRatio.toFixed(1).replace(".", ",")} · maling{" "}
            {fmtGrind(shown.grindSize)} ·{" "}
            {shown.rating.toFixed(1).replace(".", ",")}★
          </span>
          <span className="whitespace-nowrap text-ink-300">
            {points.length} van {effective.length}
          </span>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-ink-300">
        {spot.learned
          ? `Het vlak is de sweet spot van deze boon, geleerd uit je shots van 4★ en hoger: ${fmt(spot.obsTimeLow)}–${fmt(spot.obsTimeHigh)} s.`
          : "Het vlak is nog de algemene vuistregel. Vanaf drie shots van 4★ of hoger leert hij de range van deze boon zelf."}
      </p>
    </div>
  );
}

function dotRadius(rating: number): number {
  return 2 + rating * 0.7;
}

function dotClass(rating: number): string {
  if (rating >= 4.5) return "fill-barista-500";
  if (rating >= 3.5) return "fill-barista-400";
  if (rating >= 2.5) return "fill-barista-300";
  return "fill-ink-300";
}

/** Maalgraad zonder overbodige komma; een halve stap blijft "5,5". Zelfde
 *  patroon als fmtNum in lib/tips.ts en formatNum in RatingCurve. */
function fmtGrind(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

function fmt(n: number): string {
  return String(Math.round(n));
}

/**
 * Waar zat de laatste shot ten opzichte van de tijd-range? Nadrukkelijk een
 * uitlezing en geen schuifregelaar: er valt niets te verslepen.
 */
function BalanceReadout({
  shot,
  spot,
}: {
  shot: ShotLog;
  spot: ReturnType<typeof beanSweetSpot>;
}) {
  const center = (spot.timeLow + spot.timeHigh) / 2;
  const half = Math.max(1, (spot.timeHigh - spot.timeLow) / 2);
  // Binnen de band beslaat de middelste helft van het balkje; daarbuiten
  // loopt het door tot de randen en klemt daar vast.
  const offset = Math.max(-2, Math.min(2, (shot.extractionTimeSeconds - center) / half));
  const pos = 50 + (offset / 2) * 50;

  const under = shot.extractionTimeSeconds < spot.timeLow;
  const over = shot.extractionTimeSeconds > spot.timeHigh;
  const label = under
    ? "Te snel — richting zuur"
    : over
      ? "Te langzaam — richting bitter"
      : "In balans";

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-ink-300">
          Laatste shot
        </p>
        <p
          className={`text-xs font-medium ${
            under || over ? "text-clay-500" : "text-barista-400"
          }`}
        >
          {label}
        </p>
      </div>

      {/* Een aanwijzer op een schaal, nadrukkelijk geen schuifregelaar: een
          gevulde balk met een knop nodigt uit tot slepen, en er valt hier
          niets te bedienen. */}
      <div className="relative h-7">
        <div
          className="absolute top-0 -translate-x-1/2 text-ink-800"
          style={{ left: `${pos}%` }}
          aria-hidden
        >
          <svg viewBox="0 0 10 6" className="h-1.5 w-2.5" fill="currentColor">
            <path d="M0 0h10L5 6z" />
          </svg>
        </div>

        <div className="absolute inset-x-0 top-3 h-px bg-ink-100" />
        <div className="absolute inset-x-1/4 top-2 h-2 bg-barista-100" />
        <div className="absolute left-1/4 top-1.5 h-3 w-px bg-barista-300" />
        <div className="absolute left-3/4 top-1.5 h-3 w-px bg-barista-300" />
      </div>

      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.14em] text-ink-300">
        <span>Te snel</span>
        <span className="numeric">
          {fmt(spot.timeLow)}–{fmt(spot.timeHigh)} s
        </span>
        <span>Te langzaam</span>
      </div>
    </div>
  );
}

function AxisLabels({
  xLo,
  xHi,
  yLo,
  yHi,
  xFor,
  yFor,
}: {
  xLo: number;
  xHi: number;
  yLo: number;
  yHi: number;
  xFor: (t: number) => number;
  yFor: (r: number) => number;
}) {
  // Ronde waarden binnen het bereik, zodat de as niet met 23,4 s begint.
  const xTicks = ticks(xLo, xHi, 5);
  const yTicks = ticks(yLo, yHi, 0.25);

  return (
    <g className="fill-ink-300" style={{ fontSize: 7 }}>
      {xTicks.map((t) => (
        <text key={t} x={xFor(t)} y={VIEW_H - PAD_B + 9} textAnchor="middle">
          {`${t}s`}
        </text>
      ))}
      {yTicks.map((r) => (
        <text key={r} x={PAD_L - 4} y={yFor(r) + 2.5} textAnchor="end">
          {`1:${r.toFixed(1).replace(".", ",")}`}
        </text>
      ))}
    </g>
  );
}

function ticks(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  const first = Math.ceil(lo / step) * step;
  for (let v = first; v <= hi; v += step) {
    // Drijvende-komma-ruis wegwerken (0.1 + 0.2 problematiek).
    out.push(Math.round(v * 100) / 100);
  }
  // Bij een krappe as niet elk streepje tonen, anders lopen de labels in
  // elkaar over.
  return out.length > 6 ? out.filter((_, i) => i % 2 === 0) : out;
}
