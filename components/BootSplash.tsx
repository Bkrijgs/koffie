"use client";

import { useEffect, useState } from "react";
import { Barista } from "./Barista";
import { AnimatedGradientBackground } from "./AnimatedGradientBackground";

type Stage = { label: string };

const STAGES: Stage[] = [
  { label: "Bonen wegen" },
  { label: "Maalgraad instellen" },
  { label: "Espresso tappen" },
  { label: "Crema controleren" },
];

const CONTENT_REVEAL_MS = 350;
const STAGE_MS = 380;
const POST_DELAY_MS = 500;
const FADE_MS = 600;
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
  const [phase, setPhase] = useState<"reveal" | "content" | "leaving" | "gone">(
    "reveal",
  );
  const [{ hi, sub }] = useState(greeting);

  useEffect(() => {
    const t = window.setTimeout(() => setPhase("content"), CONTENT_REVEAL_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase === "reveal") return;
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
      className="fixed inset-0 z-50 overflow-hidden bg-paper transition-opacity ease-out"
      style={{
        opacity: phase === "leaving" ? 0 : 1,
        pointerEvents: phase === "leaving" ? "none" : "auto",
        transitionDuration: `${FADE_MS}ms`,
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-hidden={phase === "leaving"}
    >
      {/* Warp-style achtergrond (Framer Vortex-preset): paper-basis met
          barista-blauwe rivieren door de polar swirl. Op 15% opacity
          zodat 'ie subtiel achter de content blijft. */}
      <div className="pointer-events-none absolute inset-0 opacity-15">
        <AnimatedGradientBackground />
      </div>

      {/* Scanline */}
      <div
        className="anim-scan-line pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-barista-400/50 to-transparent"
        aria-hidden
      />

      {/* Corner widgets — Jarvis-vibe in donkerblauw op de lichte bg */}
      <div
        className="pointer-events-none absolute inset-0 font-mono uppercase tracking-wider text-ink-400 anim-fade-in"
        style={{ animationDelay: "0.5s" }}
        aria-hidden
      >
        <div className="absolute left-4 top-4 flex flex-col gap-1 text-[9px]">
          <StatusDot label="PWR" delay={0} />
          <StatusDot label="NET" delay={0.25} />
          <StatusDot label="RDY" delay={0.5} />
        </div>

        <div className="absolute right-4 top-4 w-20 text-[8px]">
          <div className="flex items-center justify-between text-ink-400">
            <span>SYS.LOAD</span>
            <span className="numeric text-barista-400">RUN</span>
          </div>
          <div className="mt-1 h-px w-full bg-ink-200">
            <div className="anim-bar-fill h-full bg-barista-400" />
          </div>
        </div>

        <div className="absolute bottom-4 left-4 w-24 text-[8px]">
          <div className="flex items-center gap-1.5 text-ink-400">
            <span className="h-1 w-1 rounded-full bg-barista-400 animate-pulse" />
            <span>DIAL-IN OK</span>
          </div>
          <div className="mt-1 h-px w-full overflow-hidden bg-ink-200">
            <div className="anim-bar-pulse h-full w-1/3 bg-barista-400" />
          </div>
        </div>

        <div className="absolute bottom-4 right-4 text-[9px] text-ink-400">
          <BootTimer />
        </div>
      </div>

      {/* Content */}
      <div
        className="relative flex h-full w-full items-center justify-center px-6 transition-all ease-out"
        style={{
          opacity: showContent ? 1 : 0,
          transform: showContent ? "translateY(0)" : "translateY(8px)",
          transitionDuration: "700ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="flex w-full max-w-sm flex-col items-center gap-6 text-ink-800">
          <Barista size={120} />

          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="flex items-baseline gap-2 font-display text-3xl tracking-tighter2 text-ink-800">
              <span className="text-ink-300">[</span>
              <span>
                {typed}
                {!typingDone && (
                  <span
                    className="ml-0.5 inline-block animate-blink text-ink-700"
                    aria-hidden
                  >
                    |
                  </span>
                )}
              </span>
              <span className="text-ink-300">]</span>
            </h1>
            <p
              className="text-[11px] uppercase tracking-[0.22em] text-ink-500 anim-fade-in"
              style={{ animationDelay: "0.35s" }}
            >
              {sub}
            </p>
          </div>

          <div
            className="flex items-center gap-1.5 anim-fade-in"
            style={{ animationDelay: "0.5s" }}
            aria-hidden
          >
            {Array.from({ length: CHASE_DOTS }, (_, i) => (
              <span
                key={i}
                className="anim-chase h-1 w-1 rounded-full bg-barista-400"
                style={{ animationDelay: `${i * 0.13}s` }}
              />
            ))}
          </div>

          <ul className="flex w-full flex-col items-center space-y-2.5 font-mono text-[11px] uppercase tracking-wider">
            {STAGES.map((s, i) => {
              const done = i < stage;
              const active = i === stage;
              return (
                <li
                  key={s.label}
                  className="anim-fade-up flex items-center justify-center gap-3 transition-colors duration-300 ease-out"
                  style={{
                    color: done
                      ? "rgb(148, 156, 178)"
                      : active
                      ? "rgb(36, 26, 16)"
                      : "rgb(207, 213, 232)",
                    animationDelay: `${0.55 + i * 0.1}s`,
                  }}
                >
                  <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
                    {done ? (
                      <span className="anim-curve-point absolute inset-0 flex items-center justify-center rounded-full bg-barista-400">
                        <svg
                          viewBox="0 0 16 16"
                          className="h-2.5 w-2.5"
                          aria-hidden
                        >
                          <path
                            d="M3.5 8 L6.8 11 L12.5 5.6"
                            fill="none"
                            stroke="#f4f6fb"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="anim-check-draw"
                          />
                        </svg>
                      </span>
                    ) : active ? (
                      <>
                        <span className="absolute inset-0 rounded-full border-2 border-barista-400" />
                        <span className="absolute inset-0 rounded-full border-2 border-barista-400 opacity-60 animate-ping" />
                      </>
                    ) : (
                      <span className="absolute inset-0 rounded-full border border-ink-200" />
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

function StatusDot({ label, delay }: { label: string; delay: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="anim-chase h-1 w-1 rounded-full bg-barista-400"
        style={{ animationDelay: `${delay}s` }}
      />
      <span>{label}</span>
    </div>
  );
}

function BootTimer() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor(performance.now() - start));
    }, 80);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="numeric">
      T+{String(elapsed).padStart(4, "0")}MS
    </span>
  );
}
