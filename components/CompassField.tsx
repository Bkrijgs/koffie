"use client";

import { useId } from "react";
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

/**
 * Smaakwoorden op de plek waar je ze proeft, naar het voorbeeld van de
 * Espresso Compass: linksboven kort en sterk (zuur, zout, overweldigend),
 * rechtsonder lang en slap (droog, poederig, leeg), en daartussen het
 * groene midden. Posities in SVG-eenheden.
 */
const WORDS: { x: number; y: number; t: string }[] = [
  // zuur + zwaar: te weinig eruit gehaald, te geconcentreerd
  { x: 46, y: 33, t: "overweldigend" },
  { x: 62, y: 47, t: "zout" },
  { x: 36, y: 60, t: "intens" },
  { x: 40, y: 76, t: "scherp" },
  // zwaar
  { x: 100, y: 37, t: "sterk" },
  { x: 84, y: 60, t: "stevig" },
  { x: 118, y: 54, t: "dik" },
  // bitter + zwaar
  { x: 160, y: 36, t: "branderig" },
  { x: 156, y: 54, t: "wrang" },
  // rond het midden
  { x: 70, y: 86, t: "vol" },
  { x: 134, y: 80, t: "fruitig" },
  { x: 138, y: 108, t: "romig" },
  { x: 68, y: 116, t: "rijp" },
  // zuur + waterig: weinig eruit gehaald en dun
  { x: 38, y: 132, t: "vlak" },
  { x: 58, y: 146, t: "flauw" },
  { x: 42, y: 162, t: "korte afdronk" },
  { x: 78, y: 166, t: "dun" },
  // waterig
  { x: 100, y: 142, t: "licht" },
  { x: 126, y: 156, t: "delicaat" },
  // bitter + waterig: te veel eruit gehaald en slap
  { x: 162, y: 126, t: "droog" },
  { x: 156, y: 142, t: "poederig" },
  { x: 166, y: 160, t: "leeg" },
];

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
  const uid = useId();
  const zone = (name: string) => `${uid}-${name}`;

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
      {/* Kleurzones zoals op de Espresso Compass: geel = kort en sterk,
          groen = raak, rood = lang en slap. */}
      <defs>
        <radialGradient id={zone("geel")} cx="0" cy="0" r="0.85">
          <stop offset="0" stopColor="#f4e04d" stopOpacity="0.6" />
          <stop offset="1" stopColor="#f4e04d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={zone("groen")} cx="0.5" cy="0.5" r="0.42">
          <stop offset="0" stopColor="#5cc08a" stopOpacity="0.6" />
          <stop offset="1" stopColor="#5cc08a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={zone("rood")} cx="1" cy="1" r="0.85">
          <stop offset="0" stopColor="#ee8273" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ee8273" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g pointerEvents="none">
        <rect width={SIZE} height={SIZE} fill={`url(#${zone("geel")})`} />
        <rect width={SIZE} height={SIZE} fill={`url(#${zone("rood")})`} />
        <rect width={SIZE} height={SIZE} fill={`url(#${zone("groen")})`} />
      </g>

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
        r={REACH * ON_TARGET_RADIUS}
        fill="#5cc08a"
        fillOpacity="0.28"
        stroke="#3f9d6b"
        strokeWidth="0.7"
      />
      <g pointerEvents="none" className="fill-ink-700">
        <text x={HALF} y={HALF - 1} textAnchor="middle" fontSize="6.4" fontWeight="600">
          zoet
        </text>
        <text x={HALF} y={HALF + 6.5} textAnchor="middle" fontSize="5.6">
          in balans
        </text>
      </g>

      {/* Smaakwoorden */}
      <g pointerEvents="none" className="fill-ink-500">
        {WORDS.map((w) => (
          <text key={w.t} x={w.x} y={w.y} textAnchor="middle" fontSize="6.2">
            {w.t}
          </text>
        ))}
      </g>

      {/* As-labels */}
      <AxisLabel x={PAD - 6} y={HALF - 3} anchor="start" title="ZUUR" />
      <AxisLabel x={SIZE - PAD + 6} y={HALF - 3} anchor="end" title="BITTER" />
      <AxisLabel x={HALF} y={PAD + 4} anchor="middle" title="ZWAAR" />
      <AxisLabel x={HALF} y={SIZE - PAD + 4} anchor="middle" title="WATERIG" />

      {/* Spoor van eerdere shots */}
      {linePts.length > 1 && (
        <polyline
          points={linePts.map((p) => `${p.cx},${p.cy}`).join(" ")}
          className="fill-none stroke-ink-400"
          strokeWidth="0.7"
          strokeDasharray="2 1.6"
          opacity="0.6"
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
}: {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  title: string;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize="7"
      fontWeight="700"
      pointerEvents="none"
      className="fill-ink-800"
      style={{ letterSpacing: "0.1em" }}
    >
      {title}
    </text>
  );
}

/** Legenda bij de kleurzones van het kompas. */
export function CompassLegend() {
  const items = [
    { color: "#f4e04d", label: "kort en sterk" },
    { color: "#5cc08a", label: "raak" },
    { color: "#ee8273", label: "lang en slap" },
  ];
  return (
    <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-ink-400">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: i.color }}
            aria-hidden
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
