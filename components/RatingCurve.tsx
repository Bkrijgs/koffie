import type { ShotLog } from "@/lib/types";
import { effectiveShots } from "@/lib/utils";

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
  const best = [...points]
    .filter((p) => p.rating === bestRating)
    .pop();

  function pointClass(rating: number): string {
    if (rating >= 4.5) return "fill-barista-500";
    if (rating >= 3.5) return "fill-barista-400";
    if (rating >= 2.5) return "fill-barista-300";
    return "fill-ink-300";
  }

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Rating verloop van deze boon"
    >
      <defs>
        <linearGradient id="rating-curve-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2ceb" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#1e2ceb" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Horizontale referentielijnen op ★1 t/m ★4 */}
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

      {/* Verticale degassing-markers */}
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

      {/* Gradient onder de curve */}
      <polygon points={areaPoints} fill="url(#rating-curve-fill)" />

      {/* De curve zelf */}
      <polyline
        points={linePoints}
        fill="none"
        className="stroke-barista-400"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Ring om de beste shot */}
      {best && (
        <circle
          cx={xFor(best.day)}
          cy={yFor(best.rating)}
          r="6"
          fill="none"
          className="stroke-barista-500"
          strokeWidth="1.2"
        />
      )}

      {/* Punten gekleurd op rating */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={xFor(p.day)}
          cy={yFor(p.rating)}
          r="2.8"
          className={pointClass(p.rating)}
        >
          <title>
            {p.rating}★ — dag {Math.round(p.day)}
          </title>
        </circle>
      ))}

      {/* Y-as labels: 5★ boven, 1★ onder */}
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

      {/* X-as labels */}
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

      {/* Degassing-labels boven de verticale markers */}
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
  );
}
