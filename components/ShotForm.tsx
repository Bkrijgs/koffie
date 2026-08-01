"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useKoffie } from "@/lib/useKoffie";
import { calcBrewRatio, effectiveShots } from "@/lib/utils";
import type { Rating, ShotLog } from "@/lib/types";
import { Field, inputClass } from "./Field";
import { StarRating } from "./StarRating";
import { BeanForm } from "./BeanForm";
import { Barista } from "./Barista";
import { TASTE_TAGS } from "@/lib/tags";

type Props = {
  initialBeanId?: string;
  shot?: ShotLog;
};

const HARD_DEFAULTS = {
  grindSize: "5",
  doseGrams: "18",
  yieldGrams: "36",
  extractionTimeSeconds: "28",
};

const RATIO_PRESETS = [
  {
    label: "Ristretto",
    ratio: 1.5,
    description:
      "Kort getrokken, geconcentreerd. Veel body en zoetheid, weinig zuur — intens en siroopachtig.",
  },
  {
    label: "Espresso",
    ratio: 2,
    description:
      "De klassieke verhouding. Balans tussen body, zoet en zuur — het standaard-recept.",
  },
  {
    label: "Normale",
    ratio: 2.5,
    description:
      "Iets langer doorgetrokken. Meer helderheid en aroma, lichter in body. Werkt goed bij lichter gebrande bonen.",
  },
  {
    label: "Lungo",
    ratio: 3,
    description:
      "Lange shot. Lichter en meer caffeine, kan richting bitter gaan bij te ver doortrekken.",
  },
] as const;

function fmtGrams(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// De meter loopt iets ruimer dan de presets (1.5–3.0), zodat een ratio net
// buiten het aanbevolen bereik nog zichtbaar aan de rand uitslaat i.p.v. eraf.
const METER_MIN = 1.25;
const METER_MAX = 3.25;
const RATIO_LOW = RATIO_PRESETS[0].ratio;
const RATIO_HIGH = RATIO_PRESETS[RATIO_PRESETS.length - 1].ratio;

function ratioToPct(r: number): number {
  const pct = ((r - METER_MIN) / (METER_MAX - METER_MIN)) * 100;
  return Math.max(0, Math.min(100, pct));
}

export function ShotForm({ initialBeanId, shot }: Props) {
  const router = useRouter();
  const { beans, shots, setup, addShot, updateShot, ready } = useKoffie();
  const isEdit = Boolean(shot);

  const [beanId, setBeanId] = useState<string>(
    shot?.beanId ?? initialBeanId ?? "",
  );
  const [showNewBean, setShowNewBean] = useState(false);
  const [grindSize, setGrindSize] = useState<string>(
    shot ? String(shot.grindSize) : "",
  );
  const [doseGrams, setDoseGrams] = useState<string>(
    shot ? String(shot.doseGrams) : "",
  );
  const [yieldGrams, setYieldGrams] = useState<string>(
    shot ? String(shot.yieldGrams) : "",
  );
  const [extractionTimeSeconds, setExtractionTime] = useState<string>(
    shot ? String(shot.extractionTimeSeconds) : "",
  );
  const [rating, setRating] = useState<Rating | 0>(shot?.rating ?? 0);
  const [notes, setNotes] = useState(shot?.notes ?? "");
  const [nextAdjustment, setNextAdjustment] = useState(
    shot?.nextAdjustment ?? "",
  );
  const [dialIn, setDialIn] = useState<boolean>(shot?.dialIn ?? false);
  const [tags, setTags] = useState<string[]>(shot?.tags ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Alleen bonen die op voorraad staan in het keuzemenu. De al-gekozen boon
  // blijft zichtbaar (bv. bij het bewerken van een oude shot van een boon die
  // inmiddels op is), zodat de selectie niet stilletjes wegvalt.
  const availableBeans = useMemo(
    () => beans.filter((b) => b.inStock || b.id === beanId),
    [beans, beanId],
  );

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  // Long-press op een verhouding-cel toont de uitleg-tooltip; release
  // verbergt 'm weer. Korte tap (<450ms) vult het yield-veld in.
  const [tooltipFor, setTooltipFor] = useState<string | null>(null);
  const pressTimerRef = useRef<number | null>(null);
  const wasLongPressRef = useRef(false);

  function startPress(label: string) {
    wasLongPressRef.current = false;
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
    }
    pressTimerRef.current = window.setTimeout(() => {
      setTooltipFor(label);
      wasLongPressRef.current = true;
    }, 450);
  }

  function endPress() {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    setTooltipFor(null);
  }

  function handleRatioClick(target: string) {
    if (wasLongPressRef.current) {
      wasLongPressRef.current = false;
      return;
    }
    setYieldGrams(target);
  }

  // Bij een verse nieuwe shot zonder URL-param: pak de boon van de meest
  // recente shot. Zo opent het formulier nooit met een lege dropdown en
  // de placeholders zijn meteen boon-specifiek i.p.v. de Sage default.
  useEffect(() => {
    if (isEdit || beanId || !ready || shots.length === 0) return;
    const latest = [...shots].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    )[0];
    if (latest && beans.some((b) => b.id === latest.beanId && b.inStock)) {
      setBeanId(latest.beanId);
    }
  }, [isEdit, beanId, ready, shots, beans]);

  // Suggested values shown only as placeholders. Pulled from the bean's best
  // non-dial-in shot, otherwise the bean's most recent shot (so dial-in-only
  // beans still get bean-specific hints), otherwise the Sage Barista Express
  // baseline.
  const placeholders = useMemo(() => {
    if (!beanId) return HARD_DEFAULTS;
    const beanShots = shots.filter((s) => s.beanId === beanId);
    if (beanShots.length === 0) return HARD_DEFAULTS;
    const rated = effectiveShots(beanShots);
    const source = rated.length > 0
      ? [...rated].sort(
          (a, b) =>
            b.rating - a.rating ||
            +new Date(b.createdAt) - +new Date(a.createdAt),
        )[0]
      : [...beanShots].sort(
          (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
        )[0];
    return {
      grindSize: String(source.grindSize),
      doseGrams: String(source.doseGrams),
      yieldGrams: String(source.yieldGrams),
      extractionTimeSeconds: String(source.extractionTimeSeconds),
    };
  }, [beanId, shots]);

  // Feedback-loop: toon wat je bij de vorige shot voor deze boon van
  // plan was, zodat je het niet vergeet. Alleen bij een nieuwe shot.
  const lastAdjustment = useMemo(() => {
    if (isEdit || !beanId) return null;
    const recent = shots
      .filter((s) => s.beanId === beanId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
    return recent?.nextAdjustment ?? null;
  }, [isEdit, beanId, shots]);

  // For the live ratio preview and submit fallback, fall through to the
  // placeholder when an input is empty.
  const dose = parseFloat(doseGrams || placeholders.doseGrams);
  const yld = parseFloat(yieldGrams || placeholders.yieldGrams);
  const time = parseFloat(
    extractionTimeSeconds || placeholders.extractionTimeSeconds,
  );
  const ratio = useMemo(
    () => (isFinite(dose) && isFinite(yld) ? calcBrewRatio(yld, dose) : 0),
    [dose, yld],
  );

  // Compacte verhouding-tabel: gegeven de huidige (of placeholder-)dose
  // laten zien hoeveel er uit zou moeten komen voor de standaard
  // verhoudingen. Klikken vult het yield-veld in.
  const ratioTargets = useMemo(() => {
    if (!isFinite(dose) || dose <= 0) return null;
    return RATIO_PRESETS.map((p) => ({
      label: p.label,
      ratio: p.ratio,
      yield: dose * p.ratio,
    }));
  }, [dose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const grind = parseFloat(grindSize || placeholders.grindSize);

    if (!beanId) return setError("Kies een boon");
    if (!isFinite(grind) || grind <= 0) return setError("Maalgraad vereist");
    if (!isFinite(dose) || dose <= 0) return setError("Dose vereist");
    if (!isFinite(yld) || yld <= 0) return setError("Yield vereist");
    if (!isFinite(time) || time <= 0) return setError("Tijd vereist");
    if (!dialIn && !rating) return setError("Rating vereist");

    setSubmitting(true);
    try {
      const payload = {
        beanId,
        grindSize: grind,
        doseGrams: dose,
        yieldGrams: yld,
        extractionTimeSeconds: time,
        rating,
        dialIn,
        notes: notes.trim() || undefined,
        nextAdjustment: nextAdjustment.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
      };
      if (shot) {
        await updateShot(shot.id, payload);
      } else {
        await addShot(payload);
      }
      router.push(`/beans/${beanId}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <p className="text-sm text-ink-300">Laden…</p>;
  }

  if (showNewBean) {
    return (
      <div className="space-y-5">
        <h2 className="font-display text-lg tracking-tightish text-ink-800">
          Nieuwe boon
        </h2>
        <BeanForm
          onCreated={(id) => {
            setBeanId(id);
            setShowNewBean(false);
          }}
          onCancel={() => setShowNewBean(false)}
        />
      </div>
    );
  }

  if (beans.length === 0) {
    return (
      <div className="rounded-xl2 border border-dashed border-line bg-card/40 p-6 text-center">
        <p className="text-ink-600">Eerst een boon toevoegen.</p>
        <button
          type="button"
          onClick={() => setShowNewBean(true)}
          className="mt-4 rounded-lg bg-ink-800 px-4 py-2 text-sm font-medium text-paper hover:bg-ink-700"
        >
          Nieuwe boon
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Boon" htmlFor="shot-bean" required>
        <div className="flex gap-2">
          <select
            id="shot-bean"
            className={inputClass}
            value={beanId}
            onChange={(e) => setBeanId(e.target.value)}
          >
            <option value="">Kies een boon…</option>
            {availableBeans.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.roaster ? ` — ${b.roaster}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowNewBean(true)}
            className="whitespace-nowrap rounded-lg border border-line px-3 text-sm font-medium text-ink-600 hover:bg-ink-50/40"
          >
            Nieuw
          </button>
        </div>
      </Field>

      {lastAdjustment && (
        <div className="anim-fade-up flex gap-2.5 rounded-lg border border-barista-100 bg-card px-4 py-3 text-sm">
          <span
            className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-barista-400"
            aria-hidden
          />
          <span className="min-w-0">
            <span className="text-ink-400">Vorige keer was je plan:</span>{" "}
            <span className="text-ink-700">{lastAdjustment}</span>
          </span>
        </div>
      )}

      <Field
        label="Maalgraad"
        htmlFor="shot-grind"
        hint={`${setup.grinder} · schaal ${setup.grindMin}–${setup.grindMax}`}
        required
      >
        <input
          id="shot-grind"
          type="number"
          inputMode="decimal"
          step={setup.grindStep}
          min={setup.grindMin}
          max={setup.grindMax}
          className={`${inputClass} numeric`}
          value={grindSize}
          onChange={(e) => setGrindSize(e.target.value)}
          placeholder={placeholders.grindSize}
        />
      </Field>

      <div className="grid grid-cols-2 gap-5">
        <Field label="Dose (g)" htmlFor="shot-dose" required>
          <input
            id="shot-dose"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            className={`${inputClass} numeric`}
            value={doseGrams}
            onChange={(e) => setDoseGrams(e.target.value)}
            placeholder={placeholders.doseGrams}
          />
        </Field>
        <Field label="Yield (g)" htmlFor="shot-yield" required>
          <input
            id="shot-yield"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            className={`${inputClass} numeric`}
            value={yieldGrams}
            onChange={(e) => setYieldGrams(e.target.value)}
            placeholder={placeholders.yieldGrams}
          />
        </Field>
      </div>

      {ratioTargets && (
        <div className="relative">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">
              Verhoudingen
            </span>
            <span className="numeric text-[10px] uppercase tracking-wider text-ink-300">
              vanaf {fmtGrams(dose)} g · houd ingedrukt voor uitleg
            </span>
          </div>
          {/* Meter: laat zien waar de huidige brew ratio valt op de schaal
              ristretto → lungo, i.p.v. losse blokken die alleen bij een
              exacte match oplichten. */}
          {(() => {
            const ratioInRange = ratio >= RATIO_LOW && ratio <= RATIO_HIGH;
            return (
              <div className="px-1 pt-7">
                {/* Baan met preset-ticks en de live knop */}
                <div className="relative h-2.5 rounded-full bg-gradient-to-r from-barista-100 via-barista-300/55 to-barista-400/80">
                  {ratioTargets.map((t) => (
                    <span
                      key={t.label}
                      aria-hidden
                      className="absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper/80"
                      style={{ left: `${ratioToPct(t.ratio)}%` }}
                    />
                  ))}
                  {ratio > 0 && (
                    <div
                      className="absolute top-1/2 z-10 -translate-y-1/2 transition-[left] duration-300 ease-out"
                      style={{ left: `${ratioToPct(ratio)}%` }}
                    >
                      <div
                        className={`absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium shadow-soft numeric ${
                          ratioInRange
                            ? "bg-barista-400 text-paper"
                            : "bg-clay-400 text-paper"
                        }`}
                      >
                        1:{ratio.toFixed(2)}
                      </div>
                      <div
                        className={`-translate-x-1/2 h-4 w-4 rounded-full border-2 bg-paper shadow-soft ${
                          ratioInRange ? "border-barista-400" : "border-clay-400"
                        }`}
                      />
                    </div>
                  )}
                </div>

                {/* Labels onder de baan, uitgelijnd met de ticks. Tik vult het
                    yield-veld; ingedrukt houden toont de uitleg. */}
                <div className="mt-2.5 grid grid-cols-4">
                  {ratioTargets.map((t) => {
                    const preset = RATIO_PRESETS.find(
                      (p) => p.label === t.label,
                    );
                    const target = fmtGrams(Number(t.yield.toFixed(1)));
                    const isActive = yieldGrams === target;
                    return (
                      <button
                        key={t.label}
                        type="button"
                        title={preset?.description}
                        onPointerDown={() => startPress(t.label)}
                        onPointerUp={endPress}
                        onPointerLeave={endPress}
                        onPointerCancel={endPress}
                        onContextMenu={(e) => e.preventDefault()}
                        onClick={() => handleRatioClick(target)}
                        className="no-touch-select flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-barista-400/40"
                      >
                        <span
                          className={`text-[10px] font-medium uppercase tracking-wider ${
                            isActive
                              ? "text-barista-400"
                              : "text-ink-500"
                          }`}
                        >
                          {t.label}
                        </span>
                        <span
                          className={`numeric text-[10px] ${
                            isActive ? "text-barista-400/75" : "text-ink-300"
                          }`}
                        >
                          1:{t.ratio}
                        </span>
                        <span
                          className={`numeric font-display text-sm tracking-tightish ${
                            isActive ? "text-barista-400" : "text-ink-800"
                          }`}
                        >
                          {fmtGrams(t.yield)} g
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {tooltipFor && (
            <div
              className="anim-fade-up pointer-events-none absolute left-0 right-0 top-full z-20 mt-2 rounded-lg bg-ink-800 px-3.5 py-2.5 text-[12px] leading-snug text-paper shadow-lift"
              role="tooltip"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-display text-sm tracking-tightish text-paper">
                  {tooltipFor}
                </span>
                <span className="numeric text-[10px] uppercase tracking-wider text-paper/55">
                  1:
                  {RATIO_PRESETS.find((p) => p.label === tooltipFor)?.ratio}
                </span>
              </div>
              <p className="mt-1 text-paper/85">
                {RATIO_PRESETS.find((p) => p.label === tooltipFor)?.description}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-barista-100 bg-card px-4 py-3 text-sm">
        <span className="text-[11px] uppercase tracking-[0.14em] text-ink-400">
          Brew ratio
        </span>
        <span className="numeric font-display text-lg tracking-tightish text-barista-400">
          {ratio > 0 ? `1 : ${ratio.toFixed(2)}` : "—"}
        </span>
      </div>

      <Field label="Tijd (sec.)" htmlFor="shot-time" required>
        <input
          id="shot-time"
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          className={`${inputClass} numeric`}
          value={extractionTimeSeconds}
          onChange={(e) => setExtractionTime(e.target.value)}
          placeholder={placeholders.extractionTimeSeconds}
        />
      </Field>

      <Field label="Rating" required={!dialIn}>
        <StarRating value={rating} onChange={(v) => setRating(v)} size="lg" />
      </Field>

      <label className="flex items-start gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-sm">
        <input
          id="shot-dial-in"
          type="checkbox"
          checked={dialIn}
          onChange={(e) => setDialIn(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-ink-800"
        />
        <span className="min-w-0 flex-1">
          <span className="font-medium text-ink-800">Dial-in shot</span>
          <span className="block text-xs text-ink-400">
            Telt niet mee in gemiddeldes en top-shots — voor shots waarbij
            je nog aan het instellen was.
          </span>
        </span>
      </label>

      <div>
        <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">
          Smaakprofiel
        </span>
        <div className="flex flex-wrap gap-1.5">
          {TASTE_TAGS.map((tag) => {
            const selected = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-all duration-150 ease-out active:scale-90 ${
                  selected
                    ? "border-ink-800 bg-ink-800 text-paper scale-105"
                    : "border-line text-ink-500 hover:bg-ink-50/40 hover:scale-105"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <Field label="Smaak" htmlFor="shot-notes">
        <textarea
          id="shot-notes"
          className={`${inputClass} min-h-[70px]`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Extra: balans, body, afdronk"
        />
      </Field>

      <Field label="Volgende keer" htmlFor="shot-adjust">
        <textarea
          id="shot-adjust"
          className={`${inputClass} min-h-[60px]`}
          value={nextAdjustment}
          onChange={(e) => setNextAdjustment(e.target.value)}
          placeholder="Fijner malen"
        />
      </Field>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {/* Op mobiel plakt de knop rechtsonder in beeld (dicht bij de
          rechterduim) terwijl je door het lange formulier scrolt; op
          desktop de vertrouwde knop over de volle breedte. */}
      {/* pointer-events-none op de container: alleen de knop zelf vangt
          tikken, zodat velden náást de zwevende knop bereikbaar blijven. */}
      <div className="pointer-events-none sticky bottom-4 z-30 flex justify-end sm:static sm:bottom-auto">
        <button
          type="submit"
          disabled={submitting}
          className="pointer-events-auto flex items-center justify-center gap-2 rounded-full bg-ink-800 px-7 py-3.5 text-sm font-medium text-paper shadow-lift transition hover:bg-ink-700 disabled:opacity-50 sm:w-full sm:rounded-lg sm:px-4 sm:py-3 sm:shadow-none"
        >
          {submitting ? (
            <>
              <Barista mood="pour" size={22} />
              <span>Aan het zetten…</span>
            </>
          ) : (
            <span>{isEdit ? "Bijwerken" : "Opslaan"}</span>
          )}
        </button>
      </div>
    </form>
  );
}
