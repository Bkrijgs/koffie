"use client";

import { useState } from "react";
import type { Rating } from "@/lib/types";

type Props = {
  value: Rating | 0;
  onChange?: (value: Rating) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
  ariaLabel?: string;
};

const sizeMap = {
  sm: "text-sm",
  md: "text-xl",
  lg: "text-3xl",
};

export function StarRating({
  value,
  onChange,
  size = "md",
  readOnly = false,
  ariaLabel,
}: Props) {
  const [hover, setHover] = useState<number>(0);
  const display = hover || value;

  return (
    <div
      className="inline-flex items-center gap-0.5"
      role={readOnly ? "img" : "radiogroup"}
      aria-label={ariaLabel ?? `Rating ${value} van 5`}
    >
      {[1, 2, 3, 4, 5].map((slot) => {
        const fill = Math.max(0, Math.min(1, display - (slot - 1)));
        return (
          <Star
            key={slot}
            slot={slot}
            fill={fill}
            sizeClass={sizeMap[size]}
            readOnly={readOnly}
            current={value}
            onHover={setHover}
            onPick={(v) => onChange?.(v)}
          />
        );
      })}
    </div>
  );
}

function Star({
  slot,
  fill,
  sizeClass,
  readOnly,
  current,
  onHover,
  onPick,
}: {
  slot: number;
  fill: number;
  sizeClass: string;
  readOnly: boolean;
  current: Rating | 0;
  onHover: (v: number) => void;
  onPick: (v: Rating) => void;
}) {
  const half = (slot - 0.5) as Rating;
  const full = slot as Rating;

  const visual = (
    <span className={`relative inline-block leading-none ${sizeClass}`}>
      <span className="text-ink-100" aria-hidden>
        ★
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden text-gold-400"
        style={{ width: `${fill * 100}%` }}
      >
        ★
      </span>
    </span>
  );

  if (readOnly) return visual;

  return (
    <span className="relative inline-block">
      {visual}
      <button
        type="button"
        role="radio"
        aria-checked={current === half}
        aria-label={`${half} sterren`}
        onMouseEnter={() => onHover(half)}
        onMouseLeave={() => onHover(0)}
        onFocus={() => onHover(half)}
        onBlur={() => onHover(0)}
        onClick={() => onPick(half)}
        className="absolute inset-y-0 left-0 w-1/2 cursor-pointer rounded-l focus:outline-none focus-visible:ring-2 focus-visible:ring-barista-400"
      />
      <button
        type="button"
        role="radio"
        aria-checked={current === full}
        aria-label={`${full} sterren`}
        onMouseEnter={() => onHover(full)}
        onMouseLeave={() => onHover(0)}
        onFocus={() => onHover(full)}
        onBlur={() => onHover(0)}
        onClick={() => onPick(full)}
        className="absolute inset-y-0 right-0 w-1/2 cursor-pointer rounded-r focus:outline-none focus-visible:ring-2 focus-visible:ring-barista-400"
      />
    </span>
  );
}
