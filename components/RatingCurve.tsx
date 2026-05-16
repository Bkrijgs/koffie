import type { ShotLog } from "@/lib/types";
import { effectiveShots } from "@/lib/utils";

type Props = {
  shots: ShotLog[];
  roastDate?: string;
};

const VIEW_W = 300;
const VIEW_H = 80;
const PAD_L = 6;
const PAD_R = 6;
const PAD_T = 6;
const PAD_B = 14;

export function RatingCurve({ shots, roastDate }: Props) {
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
    day: Math.max(0, (+new Date(s.createdAt) - origin) / (1000 * 60 * 60 * 24)),
    rating: s.rating,
  }));

  const maxDay = Math.max(...points.map((p) => p.day), 1);
  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;

  const xFor = (day: number) =>
    PAD_L + (maxDay > 0 ? (day / maxDay) * innerW : 0);
  const yFor = (rating: number) => PAD_T + (1 - rating / 5) * innerH;

  const poly = points.map((p) => `${xFor(p.day)},${yFor(p.rating)}`).join(" ");

  const showDegassing = !!roastDate && maxDay >= 5;
  const showStale = !!roastDate && maxDay >= 35;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Rating verloop van deze boon"
    >
      {showDegassing && (
        <line
          x1={xFor(5)}
          x2={xFor(5)}
          y1={PAD_T}
          y2={PAD_T + innerH}
          className="stroke-line"
          strokeDasharray="2 3"
        />
      )}
      {showStale && (
        <line
          x1={xFor(35)}
          x2={xFor(35)}
          y1={PAD_T}
          y2={PAD_T + innerH}
          className="stroke-line"
          strokeDasharray="2 3"
        />
      )}

      <polyline
        points={poly}
        fill="none"
        className="stroke-barista-400"
        strokeWidth="1.5"
      />

      {points.map((p, i) => (
        <circle
          key={i}
          cx={xFor(p.day)}
          cy={yFor(p.rating)}
          r="2.5"
          className="fill-ink-800"
        >
          <title>
            {p.rating}★ — dag {Math.round(p.day)}
          </title>
        </circle>
      ))}

      <text
        x={PAD_L}
        y={VIEW_H - 3}
        className="fill-ink-300"
        style={{ fontSize: "9px" }}
      >
        dag 0
      </text>
      <text
        x={VIEW_W - PAD_R}
        y={VIEW_H - 3}
        textAnchor="end"
        className="fill-ink-300"
        style={{ fontSize: "9px" }}
      >
        dag {Math.round(maxDay)}
      </text>
      {showDegassing && (
        <text
          x={xFor(5)}
          y={PAD_T + 8}
          textAnchor="middle"
          className="fill-ink-300"
          style={{ fontSize: "8px" }}
        >
          5d
        </text>
      )}
      {showStale && (
        <text
          x={xFor(35)}
          y={PAD_T + 8}
          textAnchor="middle"
          className="fill-ink-300"
          style={{ fontSize: "8px" }}
        >
          35d
        </text>
      )}
    </svg>
  );
}
