"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isSkinOn, setSkin } from "./SkinToggle";

/** Extra's voor de tijdelijke Windows 98-skin: taakbalk met startmenu en
 *  klok, plus klikgeluid en (op telefoons) een trilletje bij elke druk op
 *  een knop. Alles hier doet niets zolang de skin uit staat. */

const MUTE_KEY = "koffie:skin:mute";
const PRESSABLE =
  "button, a, select, summary, label, input[type='checkbox'], input[type='radio'], article";

let audio: AudioContext | null = null;

function tick(freq: number, ms: number) {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.035, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + ms / 1000);
  } catch {
    // Geen audio beschikbaar: dan blijft het stil.
  }
}

export function SkinChrome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState("");
  const mutedRef = useRef(false);

  useEffect(() => {
    try {
      const m = window.localStorage.getItem(MUTE_KEY) === "1";
      mutedRef.current = m;
      setMuted(m);
    } catch {}

    const updateClock = () =>
      setTime(
        new Date().toLocaleTimeString("nl-NL", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    updateClock();
    const clock = window.setInterval(updateClock, 10_000);

    const pressable = (e: Event) =>
      isSkinOn() &&
      e.target instanceof Element &&
      e.target.closest(PRESSABLE) !== null;

    const onDown = (e: PointerEvent) => {
      if (!pressable(e)) return;
      if (!mutedRef.current) tick(170, 28);
      navigator.vibrate?.(8);
    };
    const onUp = (e: PointerEvent) => {
      if (!pressable(e)) return;
      if (!mutedRef.current) tick(300, 18);
    };

    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp, true);
    return () => {
      window.clearInterval(clock);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
    };
  }, []);

  function toggleMute() {
    const next = !muted;
    mutedRef.current = next;
    setMuted(next);
    try {
      window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {}
  }

  const close = () => setMenuOpen(false);

  return (
    <>
      {menuOpen && (
        <div className="w98-only w98-menu" role="menu">
          <div className="w98-menu-side">Koffie 98</div>
          <ul>
            <li>
              <Link href="/shots/new" onClick={close} role="menuitem">
                Nieuwe shot
              </Link>
            </li>
            <li>
              <Link href="/" onClick={close} role="menuitem">
                Shots
              </Link>
            </li>
            <li>
              <Link href="/beans" onClick={close} role="menuitem">
                Bonen
              </Link>
            </li>
            <li>
              <Link href="/instellingen" onClick={close} role="menuitem">
                Instellingen
              </Link>
            </li>
            <li className="w98-sep">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  setSkin(false);
                }}
              >
                Afsluiten…
              </button>
            </li>
          </ul>
        </div>
      )}
      <div className="w98-only w98-taskbar">
        <button
          type="button"
          className="w98-btn w98-start"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="w98-logo" aria-hidden />
          Start
        </button>
        <div className="w98-btn w98-task">
          <span>Koffie Dial-in Manager</span>
        </div>
        <div className="w98-tray">
          <button
            type="button"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? "Geluid aanzetten" : "Geluid uitzetten"}
            title={muted ? "Geluid aan" : "Geluid uit"}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M1 5h3l3-3v10l-3-3H1z" fill="#000" />
              {muted ? (
                <path d="M9 5l4 4M13 5l-4 4" stroke="#c00000" strokeWidth="1.5" />
              ) : (
                <path
                  d="M9 4.5c1.3 1.3 1.3 3.7 0 5M10.8 3c2.2 2.2 2.2 5.8 0 8"
                  stroke="#000"
                  fill="none"
                />
              )}
            </svg>
          </button>
          <span>{time}</span>
        </div>
      </div>
    </>
  );
}
