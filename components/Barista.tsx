"use client";

import { useState } from "react";

export type BaristaMood = "happy" | "content" | "wave" | "think" | "concerned";

const moodToFile: Record<BaristaMood, string> = {
  happy: "/barista/happy.mp4",
  content: "/barista/content.mp4",
  wave: "/barista/wave.mp4",
  think: "/barista/think.mp4",
  concerned: "/barista/concerned.mp4",
};

type Props = {
  size?: number;
  mood?: BaristaMood;
  className?: string;
  alt?: string;
};

/**
 * Barista-avatar. When `mood` is set we play /public/barista/<mood>.mp4
 * and fall back to the static SVG if the file is missing or fails to play.
 */
export function Barista({ size = 56, mood, className, alt = "" }: Props) {
  const [failed, setFailed] = useState(false);

  if (mood && !failed) {
    return (
      <video
        src={moodToFile[mood]}
        width={size}
        autoPlay
        loop
        muted
        playsInline
        onError={() => setFailed(true)}
        className={className}
        aria-hidden={alt === "" ? true : undefined}
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/Barista.svg"
      width={size}
      alt={alt}
      className={`barista-anim ${className ?? ""}`.trim()}
      aria-hidden={alt === "" ? true : undefined}
    />
  );
}
