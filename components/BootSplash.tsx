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

        {/* Surface ripples — twee paths die hun shape morphen via SMIL
            zodat het oppervlak echt ademt, niet gewoon horizontaal
            schuift. Strak op de menisk, vallen weg naar beneden. */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-1 h-10 w-full"
          viewBox="0 0 200 40"
          preserveAspectRatio="none"
        >
          <path fill="rgba(244, 246, 251, 0.22)">
            <animate
              attributeName="d"
              dur="5.5s"
              repeatCount="indefinite"
              values="
                M0,18 Q50,8 100,18 T200,18 V40 H0 Z;
                M0,18 Q50,24 100,18 T200,18 V40 H0 Z;
                M0,18 Q50,12 100,18 T200,18 V40 H0 Z;
                M0,18 Q50,8 100,18 T200,18 V40 H0 Z
              "
              calcMode="spline"
              keyTimes="0; 0.33; 0.66; 1"
              keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1"
            />
          </path>
          <path fill="rgba(244, 246, 251, 0.32)">
            <animate
              attributeName="d"
              dur="3.8s"
              repeatCount="indefinite"
              values="
                M0,24 Q50,18 100,24 T200,24 V40 H0 Z;
                M0,24 Q50,30 100,24 T200,24 V40 H0 Z;
                M0,24 Q50,20 100,24 T200,24 V40 H0 Z;
                M0,24 Q50,18 100,24 T200,24 V40 H0 Z
              "
              calcMode="spline"
              keyTimes="0; 0.33; 0.66; 1"
              keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1"
            />
          </path>
        </svg>
      </div>

      {/* Content */}
      <div
        className={`relative flex h-full w-full items-center justify-center px-6 transition-opacity duration-400 ${
          showContent ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex w-full max-w-sm flex-col items-center gap-7 text-paper">
          {/* mix-blend-mode multiply maakt het witte videoframe transparant
              zodat de barista direct op de gradient zit i.p.v. in een
              witte box. */}
          <div style={{ mixBlendMode: "multiply" }}>
            <Barista size={120} mood="wave" />
          </div>

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
