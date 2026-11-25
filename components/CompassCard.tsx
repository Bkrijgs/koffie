"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  compassAdvice,
  describeTaste,
  tasteOf,
  tasteTrail,
} from "@/lib/compass";
import type { Bean, Setup, ShotLog } from "@/lib/types";
import { formatDateOnly } from "@/lib/utils";
import { CompassField } from "./CompassField";

type Props = {
  bean: Bean;
  /** Alle shots van deze boon. */
  shots: ShotLog[];
  setup: Setup;
  /** Toon de naam van de boon als kop (op het dashboard). */
  showBean?: boolean;
};

/**
 * Het kompas van één boon: waar zaten je laatste shots, en wat doe je bij de
 * volgende. Dit is het startpunt van de app: smaak eerst, techniek volgt.
 */
export function CompassCard({ bean, shots, setup, showBean = false }: Props) {
  const trail = useMemo(() => tasteTrail(shots), [shots]);
  const latest = trail[trail.length - 1];
  const advice = latest ? compassAdvice(latest, setup) : null;
  const latestPoint = latest ? tasteOf(latest) : null;

  return (
    <section className="rounded-xl2 border border-line bg-card p-5 shadow-soft">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
            Smaakkompas
          </p>
          {showBean ? (
            <Link
              href={`/beans/${bean.id}`}
              className="font-display text-lg tracking-tightish text-ink-800 hover:underline"
            >
              {bean.name}
            </Link>
          ) : (
            <h2 className="font-display text-lg tracking-tightish text-ink-800">
              Waar zit deze boon?
            </h2>
          )}
        </div>
        <Link
          href={`/shots/new?beanId=${bean.id}`}
          className="shrink-0 rounded-lg bg-ink-800 px-3 py-2 text-sm font-medium text-paper transition hover:bg-ink-700"
        >
          Shot loggen
        </Link>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 sm:items-center">
        <CompassField trail={trail.map((s) => tasteOf(s)!)} />

        <div className="min-w-0">
          {latest && latestPoint && advice ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
                Volgende shot
              </p>
              <p className="mt-1 font-display text-2xl tracking-tightish text-ink-800">
                {advice.title}
              </p>
              {advice.change && (
                <p className="numeric mt-1 text-base font-medium text-barista-400">
                  {advice.change}
                </p>
              )}
              <p className="mt-2 text-sm text-ink-500">{advice.reason}</p>
              <p className="numeric mt-3 text-xs text-ink-300">
                Laatste shot: {describeTaste(latestPoint)} ·{" "}
                {formatDateOnly(latest.createdAt)} · stand {latest.grindSize} ·
                1:{latest.brewRatio.toFixed(2)} ·{" "}
                {latest.extractionTimeSeconds}s
              </p>
              {trail.length > 1 && (
                <p className="mt-1 text-xs text-ink-300">
                  De lijn laat je laatste {trail.length} shots zien, van vaag
                  naar donker.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="font-display text-lg tracking-tightish text-ink-800">
                Nog geen shots op het kompas
              </p>
              <p className="mt-2 text-sm text-ink-500">
                Log een shot en tik op het kompas waar hij zat: zuur of
                bitter, waterig of zwaar. De app zegt dan wat je bij de
                volgende shot verandert.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
