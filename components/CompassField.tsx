"use client";

import { ON_TARGET_RADIUS, type TastePoint } from "@/lib/compass";

type Props = {
  /** De plek van de shot die je nu invult of bekijkt. */
  value?: TastePoint | null;
  /** Eerdere shots van dezelfde boon, oudste eerst. */
  trail?: TastePoint[];
  /** Ontbreekt deze, dan is het veld alleen-lezen. */
  onChange?: (point: TastePoint) => void;
  className?: string;
};

// Het veld is 200x200 in SVG-eenheden; de bruikbare ruimte loopt van
// PAD tot 200 - PAD zodat een punt op de rand nog helemaal zichtbaar is.
const SIZE = 200;
const PAD = 14;
const HALF = SIZE / 2;
const REACH = HALF - PAD;

function toSvg(p: TastePoint): { cx: number; cy: number } {
  return { cx: HALF + p.x * REACH, cy: HALF - p.y * REACH };
}

function clamp(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

/**
 * Het smaakkompas als tikbaar veld. Links zuur, rechts bitter, boven zwaar,
 * onder waterig; het midden is raak. Tik op de plek waar de shot zat.
 */
export function CompassField({ value, trail = [], onChange, className }: Props) {
  const interactive = Boolean(onChange);

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!onChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * SIZE;
    const sy = ((e.clientY - rect.top) / rect.height) * SIZE;
    onChange({
      x: Math.round(clamp((sx - HALF) / REACH) * 100) / 100,
      y: Math.round(clamp((HALF - sy) / REACH) * 100) / 100,
    });
  }

  const trailPts = trail.map(toSvg);
  const current = value ? toSvg(value) : null;
  // Lijn van het spoor, doorgetrokken naar de huidige plek als die er is.
  const linePts = current ? [...trailPts, current] : trailPts;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role={interactive ? "application" : "img"}
      aria-label={
        interactive
          ? "Smaakkompas: tik waar deze shot zat. Links zuur, rechts bitter, boven zwaar, onder waterig."
          : "Smaakkompas met je eerdere shots"
      }
      onClick={handleClick}
      className={`no-touch-select block aspect-square w-full rounded-xl2 border border-line bg-paper ${
        interactive ? "cursor-crosshair" : ""
      } ${className ?? ""}`}
    >
      {/* Assen */}
      <line
        x1={PAD}
        y1={HALF}
        x2={SIZE - PAD}
        y2={HALF}
        className="stroke-line"
        strokeWidth="0.6"
      />
      <line
        x1={HALF}
        y1={PAD}
        x2={HALF}
        y2={SIZE - PAD}
        className="stroke-line"
        strokeWidth="0.6"
      />

      {/* Doel: het midden is raak */}
      <circle
        cx={HALF}
        cy={HALF}
        r={REACH * 0.62}
        className="fill-none stroke-line"
        strokeWidth="0.4"
        strokeDasharray="1.5 2.5"
      />
      <circle
        cx={HALF}
        cy={HALF}
        r={REACH * ON_TARGET_RADIUS}
        className="fill-barista-100 stroke-barista-300"
        strokeWidth="0.6"
      />
      <text
        x={HALF}
        y={HALF + 2.2}
        textAnchor="middle"
        fontSize="6"
        className="fill-barista-500"
        style={{ letterSpacing: "0.08em" }}
      >
        RAAK
      </text>

      {/* As-labels */}
      <AxisLabel x={PAD + 2} y={HALF - 4} anchor="start" title="ZUUR" sub="scherp, zout" />
      <AxisLabel x={SIZE - PAD - 2} y={HALF - 4} anchor="end" title="BITTER" sub="droog, wrang" />
      <AxisLabel x={HALF} y={PAD + 5} anchor="middle" title="ZWAAR" sub="stroperig, te sterk" />
      <AxisLabel x={HALF} y={SIZE - PAD - 8} anchor="middle" title="WATERIG" sub="dun, leeg" />

      {/* Spoor van eerdere shots */}
      {linePts.length > 1 && (
        <polyline
          points={linePts.map((p) => `${p.cx},${p.cy}`).join(" ")}
          className="fill-none stroke-ink-200"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
      )}
      {trailPts.map((p, i) => {
        const isLast = i === trailPts.length - 1;
        // Oudere shots vervagen; de meest recente is het duidelijkst.
        const opacity = 0.25 + (0.6 * (i + 1)) / trailPts.length;
        return (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={isLast && !current ? 4 : 2.6}
            className={
              isLast && !current
                ? "fill-ink-800 stroke-paper"
                : "fill-ink-400 stroke-paper"
            }
            strokeWidth="0.8"
            opacity={isLast && !current ? 1 : opacity}
          />
        );
      })}

      {current && (
        <>
          <circle
            cx={current.cx}
            cy={current.cy}
            r="8"
            className="fill-barista-400"
            opacity="0.18"
          />
          <circle
            cx={current.cx}
            cy={current.cy}
            r="4.5"
            className="fill-barista-400 stroke-paper"
            strokeWidth="1.2"
          />
        </>
      )}
    </svg>
  );
}

function AxisLabel({
  x,
  y,
  anchor,
  title,
  sub,
}: {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  title: string;
  sub: string;
}) {
  return (
    <g pointerEvents="none">
      <text
        x={x}
        y={y}
        textAnchor={anchor}
        fontSize="6.5"
        fontWeight="600"
        className="fill-ink-500"
        style={{ letterSpacing: "0.1em" }}
      >
        {title}
      </text>
      <text
        x={x}
        y={y + 6.5}
        textAnchor={anchor}
        fontSize="5"
        className="fill-ink-300"
      >
        {sub}
      </text>
    </g>
  );
}
