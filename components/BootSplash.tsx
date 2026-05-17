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
      {/* De vloeistof — als een glas dat zich vult. Lichter blauw met een
          subtiel gradient voor diepte, en twee parallax-waves op het
          oppervlak die met verschillende snelheden over elkaar schuiven
          zodat het echt bewegend water voelt. */}
      <div
        className="anim-liquid-fill absolute inset-0 will-change-transform"
        style={{ animationDuration: `${FILL_MS}ms` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-barista-300 to-barista-400" />
        <div
          className="pointer-events-none absolute inset-x-0 -top-2 h-8 overflow-hidden"
          aria-hidden
        >
          <svg
            viewBox="0 0 400 60"
            preserveAspectRatio="none"
            className="anim-wave-back absolute inset-y-0 left-0 h-full w-[200%]"
          >
            <path
              d="M0 32 Q25 18 50 32 T100 32 T150 32 T200 32 T250 32 T300 32 T350 32 T400 32 V60 H0 Z"
              className="fill-paper/15"
            />
          </svg>
          <svg
            viewBox="0 0 400 60"
            preserveAspectRatio="none"
            className="anim-wave-front absolute inset-y-0 left-0 h-full w-[200%]"
          >
            <path
              d="M0 40 Q25 26 50 40 T100 40 T150 40 T200 40 T250 40 T300 40 T350 40 T400 40 V60 H0 Z"
              className="fill-paper/25"
            />
          </svg>
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

          <ul className="w-full space-y-2 font-mono text-[11px] uppercase tracking-wider">
            {STAGES.map((s, i) => {
              const done = i < stage;
              const active = i === stage;
              return (
                <li
                  key={s.label}
                  className="flex items-center gap-3 transition-colors duration-200"
                  style={{
                    color: done
                      ? "rgba(244, 246, 251, 0.55)"
                      : active
                      ? "rgb(244, 246, 251)"
                      : "rgba(244, 246, 251, 0.3)",
                  }}
                >
                  <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
                    {done ? (
                      <span className="anim-curve-point absolute inset-0 flex items-center justify-center rounded-full bg-paper">
                        <svg
                          viewBox="0 0 16 16"
                          className="h-2.5 w-2.5"
                          aria-hidden
                        >
                          <path
                            d="M3.5 8 L6.8 11 L12.5 5.6"
                            fill="none"
                            stroke="#1e2ceb"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="anim-check-draw"
                          />
                        </svg>
                      </span>
                    ) : active ? (
                      <>
                        <span className="absolute inset-0 rounded-full border-2 border-paper" />
                        <span className="absolute inset-0 rounded-full border-2 border-paper opacity-60 animate-ping" />
                      </>
                    ) : (
                      <span className="absolute inset-0 rounded-full border border-paper/30" />
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
