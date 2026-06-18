import Link from "next/link";
import { supabaseBackend } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase";
import { DEFAULT_SETUP } from "@/lib/setup";
import type { Bean, Setup, ShotLog } from "@/lib/types";

// JS-loos log-formulier voor de Kobo. POST't naar de route handler /kobo/log,
// die de shot in Supabase wegschrijft en terug naar /kobo stuurt. Werkt zonder
// client-side JavaScript, dus ook op de oude e-reader-browser.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shot loggen · Kobo",
};

const inputClass =
  "w-full rounded-lg border border-line bg-paper px-4 py-3 text-lg text-ink-800";
const labelClass =
  "block text-sm font-semibold uppercase tracking-wide text-ink-400";

// Rating-opties 0.5 t/m 5 in stappen van 0.5.
const RATINGS = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.5);

export default async function KoboNewPage({
  searchParams,
}: {
  searchParams: { error?: string; beanId?: string };
}) {
  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-ink-800">Shot loggen</h1>
        <p className="text-lg text-clay-500">
          Supabase is niet geconfigureerd op de server.
        </p>
        <Back />
      </div>
    );
  }

  let beans: Bean[] = [];
  let shots: ShotLog[] = [];
  let setup: Setup = DEFAULT_SETUP;
  try {
    [beans, shots, setup] = await Promise.all([
      supabaseBackend.listBeans(),
      supabaseBackend.listShots(),
      supabaseBackend.getSetup(),
    ]);
  } catch {
    // Bij een leesfout tonen we alsnog een (lege) form i.p.v. te crashen.
  }

  const latest = shots[0];
  const selectedBeanId = searchParams.beanId ?? latest?.beanId ?? "";
  const def = {
    grindSize: latest ? String(latest.grindSize) : "5",
    doseGrams: latest ? String(latest.doseGrams) : "18",
    yieldGrams: latest ? String(latest.yieldGrams) : "36",
    extractionTimeSeconds: latest ? String(latest.extractionTimeSeconds) : "28",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink-800">Shot loggen</h1>

      {searchParams.error && (
        <div className="rounded-lg border border-clay-400 bg-card p-4 text-base text-clay-500">
          {searchParams.error}
        </div>
      )}

      {beans.length === 0 ? (
        <p className="text-lg text-ink-500">
          Voeg eerst een boon toe in de volledige app.
        </p>
      ) : (
        <form method="post" action="/kobo/log" className="space-y-5">
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="beanId">
              Boon
            </label>
            <select
              id="beanId"
              name="beanId"
              defaultValue={selectedBeanId}
              className={inputClass}
            >
              <option value="">Kies een boon…</option>
              {beans.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.roaster ? " — " + b.roaster : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="grindSize">
              Maalgraad (schaal {setup.grindMin}–{setup.grindMax})
            </label>
            <input
              id="grindSize"
              name="grindSize"
              type="number"
              step={setup.grindStep}
              min={setup.grindMin}
              max={setup.grindMax}
              defaultValue={def.grindSize}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="doseGrams">
                Dose (g)
              </label>
              <input
                id="doseGrams"
                name="doseGrams"
                type="number"
                step="0.1"
                min="0"
                defaultValue={def.doseGrams}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="yieldGrams">
                Yield (g)
              </label>
              <input
                id="yieldGrams"
                name="yieldGrams"
                type="number"
                step="0.1"
                min="0"
                defaultValue={def.yieldGrams}
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="extractionTimeSeconds">
              Tijd (sec.)
            </label>
            <input
              id="extractionTimeSeconds"
              name="extractionTimeSeconds"
              type="number"
              step="1"
              min="0"
              defaultValue={def.extractionTimeSeconds}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="rating">
              Rating
            </label>
            <select
              id="rating"
              name="rating"
              defaultValue="0"
              className={inputClass}
            >
              <option value="0">— (geen / dial-in)</option>
              {RATINGS.map((r) => (
                <option key={r} value={r}>
                  {r.toFixed(1)} ★
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-lg text-ink-800">
            <input
              type="checkbox"
              name="dialIn"
              value="1"
              className="h-5 w-5"
            />
            Dial-in shot (telt niet mee in gemiddeldes)
          </label>

          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="notes">
              Smaak
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              className={inputClass}
              placeholder="balans, body, afdronk"
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="nextAdjustment">
              Volgende keer
            </label>
            <textarea
              id="nextAdjustment"
              name="nextAdjustment"
              rows={2}
              className={inputClass}
              placeholder="bv. fijner malen"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg border-2 border-ink-800 bg-ink-800 px-5 py-4 text-lg font-medium text-paper"
          >
            Opslaan
          </button>
        </form>
      )}

      <Back />
    </div>
  );
}

function Back() {
  return (
    <Link
      href="/kobo"
      className="block rounded-lg border border-line bg-card px-5 py-3 text-center text-lg text-ink-700"
    >
      ← Terug
    </Link>
  );
}
