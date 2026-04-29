"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useKoffie } from "@/lib/useKoffie";
import { calcBrewRatio } from "@/lib/utils";
import type { Rating, ShotLog } from "@/lib/types";
import { Field, inputClass } from "./Field";
import { StarRating } from "./StarRating";
import { BeanForm } from "./BeanForm";
import { Barista } from "./Barista";

type Props = {
  initialBeanId?: string;
  shot?: ShotLog;
};

export function ShotForm({ initialBeanId, shot }: Props) {
  const router = useRouter();
  const { beans, shots, addShot, updateShot, ready } = useKoffie();
  const isEdit = Boolean(shot);

  const [beanId, setBeanId] = useState<string>(
    shot?.beanId ?? initialBeanId ?? "",
  );
  const [showNewBean, setShowNewBean] = useState(false);
  const [grindSize, setGrindSize] = useState(shot?.grindSize ?? "");
  const [doseGrams, setDoseGrams] = useState<string>(
    shot ? String(shot.doseGrams) : "18",
  );
  const [yieldGrams, setYieldGrams] = useState<string>(
    shot ? String(shot.yieldGrams) : "36",
  );
  const [extractionTimeSeconds, setExtractionTime] = useState<string>(
    shot ? String(shot.extractionTimeSeconds) : "28",
  );
  const [rating, setRating] = useState<Rating | 0>(shot?.rating ?? 0);
  const [notes, setNotes] = useState(shot?.notes ?? "");
  const [nextAdjustment, setNextAdjustment] = useState(
    shot?.nextAdjustment ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filledForBean, setFilledForBean] = useState<string | null>(null);

  // When creating a new shot, prefill the metric inputs from the best
  // existing shot for the selected bean (highest rating, ties broken by
  // recency). Only does this once per bean so we don't clobber edits.
  useEffect(() => {
    if (isEdit) return;
    if (!beanId || filledForBean === beanId) return;
    const beanShots = shots.filter((s) => s.beanId === beanId);
    if (beanShots.length === 0) return;
    const best = [...beanShots].sort(
      (a, b) =>
        b.rating - a.rating ||
        +new Date(b.createdAt) - +new Date(a.createdAt),
    )[0];
    setGrindSize(best.grindSize);
    setDoseGrams(String(best.doseGrams));
    setYieldGrams(String(best.yieldGrams));
    setExtractionTime(String(best.extractionTimeSeconds));
    setFilledForBean(beanId);
  }, [beanId, shots, isEdit, filledForBean]);

  const dose = parseFloat(doseGrams);
  const yld = parseFloat(yieldGrams);
  const time = parseFloat(extractionTimeSeconds);
  const ratio = useMemo(
    () => (isFinite(dose) && isFinite(yld) ? calcBrewRatio(yld, dose) : 0),
    [dose, yld],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!beanId) return setError("Kies een boon");
    if (!grindSize.trim()) return setError("Maalgraad vereist");
    if (!isFinite(dose) || dose <= 0) return setError("Dose vereist");
    if (!isFinite(yld) || yld <= 0) return setError("Yield vereist");
    if (!isFinite(time) || time <= 0) return setError("Tijd vereist");
    if (!rating) return setError("Rating vereist");

    setSubmitting(true);
    try {
      const payload = {
        beanId,
        grindSize: grindSize.trim(),
        doseGrams: dose,
        yieldGrams: yld,
        extractionTimeSeconds: time,
        rating,
        notes: notes.trim() || undefined,
        nextAdjustment: nextAdjustment.trim() || undefined,
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
            {beans.map((b) => (
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

      <Field label="Maalgraad" htmlFor="shot-grind" required>
        <input
          id="shot-grind"
          className={inputClass}
          value={grindSize}
          onChange={(e) => setGrindSize(e.target.value)}
          placeholder="6"
          inputMode="text"
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
          />
        </Field>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-line bg-card px-4 py-3 text-sm">
        <span className="text-[11px] uppercase tracking-[0.14em] text-ink-400">
          Brew ratio
        </span>
        <span className="numeric font-display text-lg tracking-tightish text-ink-800">
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
        />
      </Field>

      <Field label="Rating" required>
        <StarRating value={rating} onChange={(v) => setRating(v)} size="lg" />
      </Field>

      <Field label="Smaak" htmlFor="shot-notes">
        <textarea
          id="shot-notes"
          className={`${inputClass} min-h-[70px]`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Fruitig, zuur, balans"
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

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink-800 px-4 py-3 text-sm font-medium text-paper transition hover:bg-ink-700 disabled:opacity-50"
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
    </form>
  );
}
