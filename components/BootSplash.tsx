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

const FILL_MS = 1300;
const CONTENT_DELAY_MS = 1050;
const STAGE_MS = 320;
const POST_DELAY_MS = 400;
const FADE_MS = 400;
const TYPE_MS = 55;

const CHASE_DOTS = 9;

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

  useEffect(() => {
    const t = window.setTimeout(() => setPhase("content"), CONTENT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase === "filling") return;
    if (typed.length >= hi.length) return;
    const t = window.setTimeout(
      () => setTyped(hi.slice(0, typed.length + 1)),
      TYPE_MS,
    );
    return () => window.clearTimeout(t);
  }, [phase, typed, hi]);

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
  const typingDone = typed.length >= hi.length;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-paper transition-opacity duration-400 ease-out"
      style={{
        opacity: phase === "leaving" ? 0 : 1,
        pointerEvents: phase === "leaving" ? "none" : "auto",
      }}
      aria-hidden={phase === "leaving"}
    >
      {/* Vloeistof stort van bovenaf naar beneden — espresso die in de
          cup wordt gegoten. Donkere navy bovenin, helderder blauw onder.
          Subtiele radial highlight + grid-pattern voor een Jarvis-achtige
          console-vibe. */}
      <div
        className="anim-liquid-fill absolute inset-0 will-change-transform"
        style={{ animationDuration: `${FILL_MS}ms` }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(220, 228, 255, 0.18), transparent 70%), linear-gradient(to bottom, #1a2056 0%, #2c3a8a 45%, #4757d8 85%, #6c7be8 100%)",
          }}
        />

        {/* Subtiele tech-grid — alleen voelbaar, niet opdringerig */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Scanline die één keer van boven naar beneden veegt — Jarvis */}
        <div className="anim-scan-line pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-paper to-transparent" />

        {/* Waves aan de ONDERkant van de afdalende vloeistof — de
            leading edge die over het scherm zakt. Twee SVGs naast elkaar
            in een 200%-brede container; CSS translate van 0 → -50%
            schuift de tiles naadloos door. Werkt betrouwbaar op iOS. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 overflow-hidden"
          style={{ transform: "translateY(50%)" }}
          aria-hidden
        >
          <div
            className="anim-wave-back absolute inset-y-0 left-0 flex h-full"
            style={{ width: "200%" }}
          >
            <WaveSvg amplitude="low" />
            <WaveSvg amplitude="low" />
          </div>
          <div
            className="anim-wave-front absolute inset-y-0 left-0 flex h-full"
            style={{ width: "200%" }}
          >
            <WaveSvg amplitude="high" />
            <WaveSvg amplitude="high" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        className={`relative flex h-full w-full items-center justify-center px-6 transition-opacity duration-400 ${
          showContent ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex w-full max-w-sm flex-col items-center gap-6 text-paper">
          <Barista size={120} />

          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="flex items-baseline gap-2 font-display text-3xl tracking-tighter2 text-paper">
              <span className="text-paper/35">[</span>
              <span>
                {typed}
                {!typingDone && (
                  <span
                    className="ml-0.5 inline-block animate-blink"
                    aria-hidden
                  >
                    |
                  </span>
                )}
              </span>
              <span className="text-paper/35">]</span>
            </h1>
            <p
              className="text-[11px] uppercase tracking-[0.22em] text-paper/65 anim-fade-in"
              style={{ animationDelay: "0.35s" }}
            >
              {sub}
            </p>
          </div>

          {/* Chase-light bar — sequenced pulse, Jarvis-style */}
          <div
            className="flex items-center gap-1.5 anim-fade-in"
            style={{ animationDelay: "0.5s" }}
            aria-hidden
          >
            {Array.from({ length: CHASE_DOTS }, (_, i) => (
              <span
                key={i}
                className="anim-chase h-1 w-1 rounded-full bg-paper"
                style={{ animationDelay: `${i * 0.13}s` }}
              />
            ))}
          </div>

          {/* Stages — gecentreerd, mono-spaced, met fade-up per regel */}
          <ul className="flex w-full flex-col items-center space-y-2.5 font-mono text-[11px] uppercase tracking-wider">
            {STAGES.map((s, i) => {
              const done = i < stage;
              const active = i === stage;
              return (
                <li
                  key={s.label}
                  className="anim-fade-up flex items-center justify-center gap-3 transition-colors duration-200"
                  style={{
                    color: done
                      ? "rgba(244, 246, 251, 0.55)"
                      : active
                      ? "rgb(244, 246, 251)"
                      : "rgba(244, 246, 251, 0.3)",
                    animationDelay: `${0.55 + i * 0.1}s`,
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
                            stroke="#1a2056"
                            strokeWidth="2.4"
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

function WaveSvg({ amplitude }: { amplitude: "low" | "high" }) {
  const path =
    amplitude === "high"
      ? "M0 18 Q25 26 50 18 T100 18 V30 H0 Z"
      : "M0 15 Q25 5 50 15 T100 15 V30 H0 Z";
  const fill =
    amplitude === "high"
      ? "rgba(244, 246, 251, 0.32)"
      : "rgba(244, 246, 251, 0.18)";
  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className="h-full"
      style={{ width: "50%" }}
    >
      <path d={path} fill={fill} />
    </svg>
  );
}
