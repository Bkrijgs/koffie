"use client";

import { useRef, useState } from "react";
import type { ShotLog } from "@/lib/types";
import { effectiveShots, formatDateOnly } from "@/lib/utils";

type Props = {
  shots: ShotLog[];
  roastDate?: string;
};

const VIEW_W = 320;
const VIEW_H = 110;
const PAD_L = 18;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 18;

export function RatingCurve({ shots, roastDate }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const effective = effectiveShots(shots);
  if (effective.length < 3) {
    return (
      <p className="text-xs text-ink-300">
        Te weinig data voor curve (min 3 shots).
      </p>
    );
  }

  const sorted = [...effective].sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
  );

  const origin = roastDate
    ? +new Date(roastDate)
    : +new Date(sorted[0].createdAt);
  const points = sorted.map((s) => ({
    shot: s,
    day: Math.max(
      0,
      (+new Date(s.createdAt) - origin) / (1000 * 60 * 60 * 24),
    ),
    rating: s.rating,
  }));

  const maxDay = Math.max(...points.map((p) => p.day), 1);
  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;
  const baselineY = PAD_T + innerH;

  const xFor = (day: number) =>
    PAD_L + (maxDay > 0 ? (day / maxDay) * innerW : 0);
  const yFor = (rating: number) => PAD_T + (1 - rating / 5) * innerH;

  const linePoints = points
    .map((p) => `${xFor(p.day)},${yFor(p.rating)}`)
    .join(" ");
  const firstX = xFor(points[0].day);
  const lastX = xFor(points[points.length - 1].day);
  const areaPoints = `${firstX},${baselineY} ${linePoints} ${lastX},${baselineY}`;

  const showDegassing = !!roastDate && maxDay >= 5;
  const showStale = !!roastDate && maxDay >= 35;

  const bestRating = Math.max(...points.map((p) => p.rating));
  const best = [...points].filter((p) => p.rating === bestRating).pop();

  function pointClass(rating: number): string {
    if (rating >= 4.5) return "fill-barista-500";
    if (rating >= 3.5) return "fill-barista-400";
    if (rating >= 2.5) return "fill-barista-300";
    return "fill-ink-300";
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const svgX = xPct * VIEW_W;
    let bestIdx = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(xFor(p.day) - svgX);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    setHoverIdx(bestIdx);
  }

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;
  const tooltipOnLeft = hovered ? xFor(hovered.day) / VIEW_W > 0.65 : false;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Rating verloop van deze boon"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="rating-curve-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e2ceb" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#1e2ceb" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[1, 2, 3, 4].map((r) => (
          <line
            key={r}
            x1={PAD_L}
            x2={VIEW_W - PAD_R}
            y1={yFor(r)}
            y2={yFor(r)}
            className="stroke-line"
            strokeWidth="0.5"
            strokeDasharray="1 3"
          />
        ))}

        {showDegassing && (
          <line
            x1={xFor(5)}
            x2={xFor(5)}
            y1={PAD_T}
            y2={baselineY}
            className="stroke-line"
            strokeDasharray="2 3"
          />
        )}
        {showStale && (
          <line
            x1={xFor(35)}
            x2={xFor(35)}
            y1={PAD_T}
            y2={baselineY}
            className="stroke-line"
            strokeDasharray="2 3"
          />
        )}

        <polygon
          points={areaPoints}
          fill="url(#rating-curve-fill)"
          className="anim-curve-area"
        />

        <polyline
          points={linePoints}
          fill="none"
          className="anim-curve-line stroke-barista-400"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Hover-cursor: verticale lijn op het dichtstbijzijnde punt */}
        {hovered && (
          <line
            x1={xFor(hovered.day)}
            x2={xFor(hovered.day)}
            y1={PAD_T}
            y2={baselineY}
            className="stroke-barista-400"
            strokeWidth="0.8"
            strokeDasharray="2 2"
            opacity="0.6"
          />
        )}

        {best && (
          <circle
            cx={xFor(best.day)}
            cy={yFor(best.rating)}
            r="6"
            fill="none"
            className="anim-curve-point stroke-barista-500"
            strokeWidth="1.2"
            style={{ animationDelay: "0.5s" }}
          />
        )}

        {points.map((p, i) => {
          const isHover = hoverIdx === i;
          return (
            <circle
              key={i}
              cx={xFor(p.day)}
              cy={yFor(p.rating)}
              r={isHover ? 4.5 : 2.8}
              className={`anim-curve-point ${pointClass(p.rating)}`}
              style={{
                animationDelay: `${0.4 + i * 0.04}s`,
                transition: "r 0.15s ease-out",
              }}
            />
          );
        })}

        <text
          x={PAD_L - 4}
          y={yFor(5) + 3}
          textAnchor="end"
          className="fill-ink-300"
          style={{ fontSize: "8px" }}
        >
          5★
        </text>
        <text
          x={PAD_L - 4}
          y={yFor(1) + 3}
          textAnchor="end"
          className="fill-ink-300"
          style={{ fontSize: "8px" }}
        >
          1★
        </text>

        <text
          x={PAD_L}
          y={VIEW_H - 4}
          className="fill-ink-300"
          style={{ fontSize: "9px" }}
        >
          dag {Math.round(points[0].day)}
        </text>
        <text
          x={VIEW_W - PAD_R}
          y={VIEW_H - 4}
          textAnchor="end"
          className="fill-ink-300"
          style={{ fontSize: "9px" }}
        >
          dag {Math.round(maxDay)}
        </text>

        {showDegassing && (
          <text
            x={xFor(5)}
            y={PAD_T + 7}
            textAnchor="middle"
            className="fill-ink-400"
            style={{ fontSize: "8px" }}
          >
            5d
          </text>
        )}
        {showStale && (
          <text
            x={xFor(35)}
            y={PAD_T + 7}
            textAnchor="middle"
            className="fill-ink-400"
            style={{ fontSize: "8px" }}
          >
            35d
          </text>
        )}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute anim-fade-in z-10 min-w-[140px] rounded-lg border border-line bg-paper px-2.5 py-2 text-[11px] leading-tight text-ink-700 shadow-soft"
          style={{
            left: `${(xFor(hovered.day) / VIEW_W) * 100}%`,
            top: `${(yFor(hovered.rating) / VIEW_H) * 100}%`,
            transform: tooltipOnLeft
              ? "translate(-100%, -100%) translate(-8px, -4px)"
              : "translate(0, -100%) translate(8px, -4px)",
          }}
        >
          <div className="flex items-baseline gap-1.5">
            <span className="numeric font-display text-sm text-ink-800">
              {hovered.rating}★
            </span>
            <span className="text-[10px] text-ink-400">
              dag {Math.round(hovered.day)}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-ink-400">
            {formatDateOnly(hovered.shot.createdAt)}
          </div>
          <div className="numeric mt-1.5 text-[10px] text-ink-500">
            maalgraad {hovered.shot.grindSize} · {formatNum(hovered.shot.doseGrams)}g
            → {formatNum(hovered.shot.yieldGrams)}g ·{" "}
            {hovered.shot.extractionTimeSeconds}s
          </div>
          {hovered.shot.tags && hovered.shot.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {hovered.shot.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-line px-1.5 py-px text-[9px] text-ink-500"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
