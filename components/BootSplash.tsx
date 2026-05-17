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
      {/* Stijgende vloeistof. Crème bovenin, espresso onderin — als een
          shot dat zich onder de crema-laag opbouwt. Veel zachter dan de
          vorige vol-saturated indigo. */}
      <div
        className="anim-liquid-fill absolute inset-0 will-change-transform"
        style={{ animationDuration: `${FILL_MS}ms` }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to top, #3340c0 0%, #5b66ed 45%, #97a3ee 85%, #c4cbf3 100%)",
          }}
        />

        {/* Surface ripples — twee SVG-paths op het oppervlak die
            horizontaal schuiven via CSS keyframes. SVG is 200% breed
            zodat de translate van 0 → -50% naadloos loopt; de wave
            pattern herhaalt zich elke 100 viewBox-units zodat de
            cyclus klopt. Twee snelheden + tegengestelde richtingen
            geven parallax. Geen SMIL = betrouwbaar op iOS. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-10 overflow-hidden"
          style={{ transform: "translateY(-50%)" }}
          aria-hidden
        >
          <svg
            viewBox="0 0 200 30"
            preserveAspectRatio="none"
            className="anim-wave-back absolute inset-y-0 left-0 h-full"
            style={{ width: "200%" }}
          >
            <path
              d="M0 15 Q25 5 50 15 T100 15 T150 15 T200 15 V30 H0 Z"
              fill="rgba(244, 246, 251, 0.22)"
            />
          </svg>
          <svg
            viewBox="0 0 200 30"
            preserveAspectRatio="none"
            className="anim-wave-front absolute inset-y-0 left-0 h-full"
            style={{ width: "200%" }}
          >
            <path
              d="M0 18 Q25 26 50 18 T100 18 T150 18 T200 18 V30 H0 Z"
              fill="rgba(244, 246, 251, 0.36)"
            />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div
        className={`relative flex h-full w-full items-center justify-center px-6 transition-opacity duration-400 ${
          showContent ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex w-full max-w-sm flex-col items-center gap-7 text-paper">
          {/* Statische SVG i.p.v. video — geen wit frame om weg te
              blenden, geen iOS Safari flicker. Bob-animatie zit
              ingebakken in de SVG class. */}
          <Barista size={120} />

          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="font-display text-3xl tracking-tighter2 text-paper">
              {typed}
              {!typingDone && (
                <span
                  className="ml-0.5 inline-block animate-blink"
                  aria-hidden
                >
                  |
                </span>
              )}
            </h1>
            <p
              className="text-xs uppercase tracking-[0.18em] text-paper/65 anim-fade-in"
              style={{ animationDelay: "0.35s" }}
            >
              {sub}
            </p>
          </div>

          <ul className="w-full space-y-2.5 font-mono text-[11px] uppercase tracking-wider">
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
                            stroke="#3340c0"
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
