"use client";

import { useEffect, useState } from "react";
import { Barista } from "./Barista";

type Stage = { label: string };

const STAGES: Stage[] = [
  { label: "Bonen wegen" },
  { label: "Maalgraad instellen" },
  { label: "Espresso tappen" },
  { label: "Crema controleren" },
];

const FILL_MS = 1100; // duur van de liquid-fill keyframe
const CONTENT_DELAY_MS = 950; // content verschijnt vlak vóór de fill klaar is
const STAGE_MS = 300;
const POST_DELAY_MS = 350;
const FADE_MS = 350;
const TYPE_MS = 55;

function greeting(now = new Date()): { hi: string; sub: string } {
  const h = now.getHours();
  if (h < 5) return { hi: "Nog wakker?", sub: "Espresso om dit uur — durf" };
  if (h < 12) return { hi: "Goedemorgen", sub: "Eerste shot van de dag" };
  if (h < 17) return { hi: "Goedemiddag", sub: "Espresso-systeem online" };
  if (h < 22) return { hi: "Goedenavond", sub: "Tijd voor een afsluiter" };
  return { hi: "Late shot?", sub: "Decaf is ook een optie" };
}

export function BootSplash() {
  const [stage, setStage] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"filling" | "content" | "leaving" | "gone">(
    "filling",
  );
  const [{ hi, sub }] = useState(greeting);

  // Content komt in beeld zodra de liquid bijna boven is.
  useEffect(() => {
    const t = window.setTimeout(() => setPhase("content"), CONTENT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Typewriter — start zodra de content phase begint
  useEffect(() => {
    if (phase === "filling") return;
    if (typed.length >= hi.length) return;
    const t = window.setTimeout(
      () => setTyped(hi.slice(0, typed.length + 1)),
      TYPE_MS,
    );
    return () => window.clearTimeout(t);
  }, [phase, typed, hi]);

  // Stage cycling
  useEffect(() => {
    if (phase !== "content") return;
    if (stage >= STAGES.length) {
      const fade = window.setTimeout(() => setPhase("leaving"), POST_DELAY_MS);
      const gone = window.setTimeout(
        () => setPhase("gone"),
        POST_DELAY_MS + FADE_MS,
      );
      return () => {
        window.clearTimeout(fade);
        window.clearTimeout(gone);
      };
    }
    const t = window.setTimeout(() => setStage((s) => s + 1), STAGE_MS);
    return () => window.clearTimeout(t);
  }, [phase, stage]);

  if (phase === "gone") return null;

  const showContent = phase === "content" || phase === "leaving";

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-paper transition-opacity duration-300 ease-out"
      style={{
        opacity: phase === "leaving" ? 0 : 1,
        pointerEvents: phase === "leaving" ? "none" : "auto",
      }}
      aria-hidden={phase === "leaving"}
    >
      {/* De vloeistof — barista-500 die als een glas wordt gevuld van onder
          naar boven. Een subtiele lichtere strook bovenaan vormt de
          "menisk" / cremalaag die meebeweegt met het oppervlak. */}
      <div
        className="anim-liquid-fill absolute inset-0 will-change-transform"
        style={{ animationDuration: `${FILL_MS}ms` }}
      >
        <div className="absolute inset-0 bg-barista-500" />
        <div className="absolute inset-x-0 top-0 h-3 overflow-hidden">
          <div className="anim-liquid-shimmer h-full w-full bg-gradient-to-b from-barista-300 via-barista-400 to-transparent" />
        </div>
      </div>

      {/* Content — verschijnt zodra de vloeistof boven is */}
      <div
        className={`relative flex h-full w-full items-center justify-center px-6 transition-opacity duration-300 ${
          showContent ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex w-full max-w-sm flex-col items-center gap-6 text-paper">
          <Barista size={120} mood="wave" />

          <div className="flex flex-col items-center gap-1.5 text-center">
            <h1 className="font-display text-3xl tracking-tighter2 text-paper">
              {typed}
              <span className="ml-0.5 inline-block w-[2px] bg-paper align-middle animate-blink">
                &nbsp;
              </span>
            </h1>
            <p
              className="text-xs uppercase tracking-[0.18em] text-paper/60 anim-fade-in"
              style={{ animationDelay: "0.4s" }}
            >
              {sub}
            </p>
          </div>

          <ul className="w-full space-y-1.5 font-mono text-[11px] uppercase tracking-wider">
            {STAGES.map((s, i) => {
              const done = i < stage;
              const active = i === stage;
              return (
                <li
                  key={s.label}
                  className="flex items-center gap-2 transition-colors duration-150"
                  style={{
                    color: done
                      ? "rgba(244, 246, 251, 0.5)"
                      : active
                      ? "rgb(244, 246, 251)"
                      : "rgba(244, 246, 251, 0.25)",
                  }}
                >
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                    {done ? (
                      <svg viewBox="0 0 12 12" className="h-3 w-3 fill-paper">
                        <path d="M10.2 2.4 4.6 8 1.8 5.2.4 6.6l4.2 4.2L11.6 3.8z" />
                      </svg>
                    ) : active ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-paper animate-pulse" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-paper/30" />
                    )}
                  </span>
                  <span>{s.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
