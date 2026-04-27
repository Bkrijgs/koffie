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
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= display;
        const star = (
          <span
            className={`${sizeMap[size]} leading-none transition-colors ${
              active ? "text-gold-400" : "text-ink-100"
            }`}
            aria-hidden="true"
          >
            {active ? "★" : "★"}
          </span>
        );
        if (readOnly) return <span key={n}>{star}</span>;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ster${n > 1 ? "ren" : ""}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => onChange?.(n as Rating)}
            className="cursor-pointer rounded p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}
