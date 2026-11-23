"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const SRC = "/kompas/espresso-compass.webp";

/** Zoomfactor bij een tik op de plaat. 2,5x maakt de smaakwoorden op een
 *  telefoon leesbaar zonder dat je de weg kwijtraakt op het diagram. */
const ZOOM = 2.5;

/**
 * De Espresso Compass (BaristaHustle) als pop-up, vanaf een zwevende knop
 * linksonder. Bewust een overlay en geen aparte route: je hebt de kaart nodig
 * terwijl je een shot logt, en wegnavigeren vanuit /shots/new zou het half
 * ingevulde formulier weggooien.
 */
export function CompassPopup() {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const pathname = usePathname();

  const scrollRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  /** Waar op de plaat je tikte, als fractie 0-1. Na het inzoomen scrollen we
   *  daarnaartoe, zodat het punt onder je vinger blijft liggen. */
  const focusPoint = useRef<{ x: number; y: number } | null>(null);

  const close = useCallback(() => {
    // De terugknop van Android sluit hem ook; daarvoor ligt er een
    // history-entry klaar. Ligt die er nog, dan sluiten we via history zodat
    // beide wegen op hetzelfde uitkomen.
    if (typeof window !== "undefined" && window.history.state?.kompas) {
      window.history.back();
    } else {
      setOpen(false);
    }
  }, []);

  const openPopup = useCallback(() => {
    window.history.pushState({ kompas: true }, "");
    setZoomed(false);
    setOpen(true);
  }, []);

  // Terugknop (Android, of swipe-terug) sluit de pop-up i.p.v. de pagina.
  useEffect(() => {
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Escape sluit, en de pagina eronder mag niet meescrollen.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  // Navigeren met de pop-up open kan niet (hij dekt alles af), maar mocht het
  // toch gebeuren, dan blijft hij niet over de nieuwe pagina hangen.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Na het inzoomen naar het aangetikte punt scrollen.
  useEffect(() => {
    const el = scrollRef.current;
    const point = focusPoint.current;
    if (!open || !zoomed || !el || !point) return;

    el.scrollLeft = point.x * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = point.y * el.scrollHeight - el.clientHeight / 2;
    focusPoint.current = null;
  }, [open, zoomed]);

  const toggleZoom = (e: React.MouseEvent<HTMLImageElement>) => {
    if (zoomed) {
      setZoomed(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    focusPoint.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
    setZoomed(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={openPopup}
        aria-label="Espresso Compass openen"
        className="kompas-knop fixed left-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-ink-800 text-paper shadow-lift transition hover:bg-ink-700 active:scale-95"
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="m15.6 8.4-2.2 5-5 2.2 2.2-5z" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <button
            type="button"
            onClick={close}
            aria-label="Sluiten"
            tabIndex={-1}
            className="absolute inset-0 h-full w-full cursor-default bg-ink-900/70"
          />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Espresso Compass"
            tabIndex={-1}
            className="anim-fade-up relative m-auto flex max-h-full w-full max-w-3xl flex-col overflow-hidden bg-card shadow-lift outline-none sm:max-h-[92vh] sm:rounded-xl2"
            style={{
              height: "100%",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <h2 className="font-display text-lg tracking-tightish text-ink-800">
                  Espresso Compass
                </h2>
                <p className="mt-0.5 truncate text-[11px] uppercase tracking-[0.18em] text-ink-300">
                  {zoomed ? "Tik om uit te zoomen" : "Tik om in te zoomen"}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-line text-ink-500 transition hover:bg-ink-50/40"
                aria-label="Sluiten"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </header>

            <div
              ref={scrollRef}
              className={`flex-1 bg-paper ${
                zoomed
                  ? "overflow-auto"
                  : "flex items-center justify-center overflow-hidden"
              }`}
            >
              {!loaded && (
                <p className="p-8 text-center text-sm text-ink-300">Laden…</p>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element -- geen
                  next/image: de plaat moet op ware grootte kunnen scrollen en
                  zoomen, en next/image's layout-wrapper zit dat in de weg. */}
              <img
                src={SRC}
                alt="Espresso Compass: smaak uitgezet tegen extractie en sterkte"
                onLoad={() => setLoaded(true)}
                onClick={toggleZoom}
                draggable={false}
                className={`no-touch-select block cursor-zoom-in ${
                  zoomed
                    ? "h-auto w-[250%] max-w-none cursor-zoom-out"
                    : "mx-auto h-full w-auto max-w-full object-contain"
                } ${loaded ? "" : "hidden"}`}
              />
            </div>

            <footer className="flex-shrink-0 border-t border-line px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-ink-300">
              Bron:{" "}
              <a
                href="https://baristahustle.com"
                target="_blank"
                rel="noreferrer"
                className="text-ink-400 underline underline-offset-2 hover:text-ink-700"
              >
                BaristaHustle.com
              </a>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
