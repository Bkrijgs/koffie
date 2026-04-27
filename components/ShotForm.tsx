"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useKoffie } from "@/lib/useKoffie";
import { calcBrewRatio } from "@/lib/utils";
import type { Rating } from "@/lib/types";
import { Field, inputClass } from "./Field";
import { StarRating } from "./StarRating";
import { BeanForm } from "./BeanForm";

type Props = {
  initialBeanId?: string;
};

export function ShotForm({ initialBeanId }: Props) {
  const router = useRouter();
  const { beans, addShot, ready } = useKoffie();

  const [beanId, setBeanId] = useState<string>(initialBeanId ?? "");
  const [showNewBean, setShowNewBean] = useState(false);
  const [grindSize, setGrindSize] = useState("");
  const [doseGrams, setDoseGrams] = useState<string>("18");
  const [yieldGrams, setYieldGrams] = useState<string>("36");
  const [extractionTimeSeconds, setExtractionTime] = useState<string>("28");
  const [rating, setRating] = useState<Rating | 0>(0);
  const [notes, setNotes] = useState("");
  const [nextAdjustment, setNextAdjustment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await addShot({
        beanId,
        grindSize: grindSize.trim(),
        doseGrams: dose,
        yieldGrams: yld,
        extractionTimeSeconds: time,
        rating,
        notes: notes.trim() || undefined,
        nextAdjustment: nextAdjustment.trim() || undefined,
      });
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
        className="w-full rounded-lg bg-ink-800 px-4 py-3 text-sm font-medium text-paper transition hover:bg-ink-700 disabled:opacity-50"
      >
        {submitting ? "…" : "Opslaan"}
      </button>
    </form>
  );
}
