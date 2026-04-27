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
  sm: "text-base",
  md: "text-2xl",
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
      className="inline-flex items-center gap-1"
      role={readOnly ? "img" : "radiogroup"}
      aria-label={ariaLabel ?? `Rating ${value} of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= display;
        const Star = (
          <span
            className={`${sizeMap[size]} leading-none transition-colors ${
              active ? "text-crema-400" : "text-espresso-200"
            }`}
            aria-hidden="true"
          >
            {active ? "★" : "☆"}
          </span>
        );
        if (readOnly) return <span key={n}>{Star}</span>;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => onChange?.(n as Rating)}
            className="cursor-pointer rounded p-0.5 hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-crema-400"
          >
            {Star}
          </button>
        );
      })}
    </div>
  );
}
