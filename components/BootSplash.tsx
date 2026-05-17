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

const STAGE_MS = 320;
const POST_DELAY_MS = 380;
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

type Props = {
  /** Override of session-tracking. Pass `true` om altijd te tonen (debug). */
  force?: boolean;
};

export function BootSplash({ force = false }: Props) {
  const [shouldShow, setShouldShow] = useState(false);
  const [stage, setStage] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"running" | "leaving" | "gone">("running");
  const [{ hi, sub }] = useState(greeting);

  // Beslis bij mount of we deze sessie de splash al hebben gehad.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.sessionStorage.getItem("koffie:booted");
    if (force || !seen) {
      setShouldShow(true);
      window.sessionStorage.setItem("koffie:booted", String(Date.now()));
    } else {
      setPhase("gone");
    }
  }, [force]);

  // Typewriter
  useEffect(() => {
    if (!shouldShow || typed.length >= hi.length) return;
    const t = window.setTimeout(
      () => setTyped(hi.slice(0, typed.length + 1)),
      TYPE_MS,
    );
    return () => window.clearTimeout(t);
  }, [shouldShow, typed, hi]);

  // Stage cycling
  useEffect(() => {
    if (!shouldShow) return;
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
  }, [shouldShow, stage]);

  if (!shouldShow || phase === "gone") return null;

  const progress = Math.min(1, (stage + 1) / STAGES.length);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-paper transition-opacity duration-300 ease-out"
      style={{ opacity: phase === "leaving" ? 0 : 1, pointerEvents: phase === "leaving" ? "none" : "auto" }}
      aria-hidden={phase === "leaving"}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-6 px-6">
        <Barista size={120} mood="wave" />

        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="font-display text-3xl tracking-tighter2 text-ink-800">
            {typed}
            <span className="ml-0.5 inline-block w-[2px] bg-ink-800 align-middle animate-blink">
              &nbsp;
            </span>
          </h1>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-400 anim-fade-in" style={{ animationDelay: "0.4s" }}>
            {sub}
          </p>
        </div>

        <ul className="w-full space-y-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-400">
          {STAGES.map((s, i) => {
            const done = i < stage;
            const active = i === stage;
            return (
              <li
                key={s.label}
                className="flex items-center gap-2 transition-colors duration-150"
                style={{
                  color: done
                    ? "rgb(36 26 16 / 0.55)"
                    : active
                    ? "rgb(36 26 16)"
                    : "rgb(36 26 16 / 0.25)",
                }}
              >
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                  {done ? (
                    <svg viewBox="0 0 12 12" className="h-3 w-3 fill-barista-400">
                      <path d="M10.2 2.4 4.6 8 1.8 5.2.4 6.6l4.2 4.2L11.6 3.8z" />
                    </svg>
                  ) : active ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-barista-400 animate-pulse" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-200" />
                  )}
                </span>
                <span>{s.label}</span>
              </li>
            );
          })}
        </ul>

        <div className="h-0.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full bg-barista-400 transition-[width] duration-300 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
