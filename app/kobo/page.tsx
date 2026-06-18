import Link from "next/link";
import { supabaseBackend } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase";
import { DEFAULT_SETUP } from "@/lib/setup";
import { effectiveShots, formatDateOnly } from "@/lib/utils";
import type { Bean, Setup, ShotLog } from "@/lib/types";

// Server-gerenderde, JS-loze variant voor de oude e-reader-browser (Kobo).
// De data wordt hier op de server (Vercel) uit Supabase gehaald en als kale
// HTML verstuurd; de Kobo hoeft zelf geen JavaScript te draaien en niet met
// Supabase te praten. Loggen gebeurt via een klassiek formulier (/kobo/new).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Koffie · Kobo",
};

function ratio(yieldGrams: number, doseGrams: number): string {
  if (!doseGrams) return "—";
  return "1:" + (yieldGrams / doseGrams).toFixed(2);
}

function ratingLabel(r: number): string {
  if (!r) return "—";
  return "★ " + r.toFixed(1);
}

export default async function KoboPage() {
  if (!isSupabaseConfigured) {
    return (
      <Shell>
        <p className="text-lg text-clay-500">
          Supabase is niet geconfigureerd op de server.
        </p>
      </Shell>
    );
  }

  let beans: Bean[] = [];
  let shots: ShotLog[] = [];
  let setup: Setup = DEFAULT_SETUP;
  let error: string | null = null;
  try {
    [beans, shots, setup] = await Promise.all([
      supabaseBackend.listBeans(),
      supabaseBackend.listShots(),
      supabaseBackend.getSetup(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  // Spiekbriefje: per boon de best beoordeelde (niet-dial-in) shot als
  // referentie-recept naast het apparaat.
  const recipes = beans
    .map((bean) => {
      const beanShots = effectiveShots(
        shots.filter((s) => s.beanId === bean.id),
      );
      if (beanShots.length === 0) return null;
      const best = [...beanShots].sort(
        (a, b) =>
          b.rating - a.rating ||
          +new Date(b.createdAt) - +new Date(a.createdAt),
      )[0];
      return { bean, shot: best };
    })
    .filter((r): r is { bean: Bean; shot: ShotLog } => r !== null);

  const beanById = new Map(beans.map((b) => [b.id, b]));
  const recent = shots.slice(0, 12);

  return (
    <Shell>
      {error && (
        <div className="rounded-lg border border-clay-400 bg-card p-4 text-base text-clay-500">
          <p className="font-medium">Data kon niet geladen worden</p>
          <p className="mt-1 break-words text-ink-400">{error}</p>
        </div>
      )}

      <Link
        href="/kobo/new"
        className="block rounded-lg border-2 border-ink-800 bg-ink-800 px-5 py-4 text-center text-lg font-medium text-paper"
      >
        + Shot loggen
      </Link>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
          Installatie
        </h2>
        <div className="rounded-lg border border-line bg-card p-4 text-base text-ink-700">
          <p className="font-medium text-ink-800">{setup.machine}</p>
          <p className="mt-1 text-ink-500">{setup.grinder}</p>
          <p className="mt-1 text-ink-500">
            Maalschaal {setup.grindMin}–{setup.grindMax} (stap {setup.grindStep})
            · {setup.defaultBasket === "double" ? "dubbele" : "enkele"} basket
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
          Recept per boon
        </h2>
        {recipes.length === 0 ? (
          <p className="text-base text-ink-400">Nog geen beoordeelde shots.</p>
        ) : (
          <ul className="space-y-2">
            {recipes.map(({ bean, shot }) => (
              <li
                key={bean.id}
                className="rounded-lg border border-line bg-card p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-lg font-medium text-ink-800">
                    {bean.name}
                  </span>
                  <span className="numeric text-base text-ink-500">
                    {ratingLabel(shot.rating)}
                  </span>
                </div>
                <p className="numeric mt-1 text-base text-ink-700">
                  Maalgraad <strong>{shot.grindSize}</strong> ·{" "}
                  {shot.doseGrams} g → {shot.yieldGrams} g (
                  {ratio(shot.yieldGrams, shot.doseGrams)}) ·{" "}
                  {shot.extractionTimeSeconds} s
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
          Laatste shots
        </h2>
        {recent.length === 0 ? (
          <p className="text-base text-ink-400">Nog geen shots gelogd.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-card">
            {recent.map((s) => (
              <li key={s.id} className="p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-base font-medium text-ink-800">
                    {beanById.get(s.beanId)?.name ?? "Onbekende boon"}
                    {s.dialIn ? " · dial-in" : ""}
                  </span>
                  <span className="numeric text-sm text-ink-400">
                    {formatDateOnly(s.createdAt)}
                  </span>
                </div>
                <p className="numeric mt-1 text-base text-ink-600">
                  Maalgraad {s.grindSize} · {s.doseGrams} g → {s.yieldGrams} g (
                  {ratio(s.yieldGrams, s.doseGrams)}) · {s.extractionTimeSeconds}{" "}
                  s · {ratingLabel(s.rating)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink-800">Koffie</h1>
      {children}
    </div>
  );
}
