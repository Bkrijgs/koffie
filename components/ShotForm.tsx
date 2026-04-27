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
    if (!grindSize.trim()) return setError("Maalgraad is verplicht");
    if (!isFinite(dose) || dose <= 0) return setError("Dose is verplicht");
    if (!isFinite(yld) || yld <= 0) return setError("Yield is verplicht");
    if (!isFinite(time) || time <= 0) return setError("Tijd is verplicht");
    if (!rating) return setError("Geef een rating");

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
    return <p className="text-sm text-espresso-400">Laden…</p>;
  }

  if (showNewBean) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-espresso-700">
          Nieuwe boon toevoegen
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
      <div className="rounded-2xl border border-dashed border-crema-200 bg-white/50 p-6 text-center">
        <p className="text-espresso-600">
          Voeg eerst een boon toe voordat je een shot kunt loggen.
        </p>
        <button
          type="button"
          onClick={() => setShowNewBean(true)}
          className="mt-4 rounded-full bg-espresso-600 px-4 py-2 text-sm font-medium text-crema-50 hover:bg-espresso-700"
        >
          + Nieuwe boon
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
            className="whitespace-nowrap rounded-xl border border-crema-200 px-3 text-sm font-medium text-espresso-600 hover:bg-crema-50"
          >
            + Nieuw
          </button>
        </div>
      </Field>

      <Field label="Maalgraad" htmlFor="shot-grind" required>
        <input
          id="shot-grind"
          className={inputClass}
          value={grindSize}
          onChange={(e) => setGrindSize(e.target.value)}
          placeholder="Bv. 6 of 6.5"
          inputMode="text"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Dose (g)" htmlFor="shot-dose" required>
          <input
            id="shot-dose"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            className={inputClass}
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
            className={inputClass}
            value={yieldGrams}
            onChange={(e) => setYieldGrams(e.target.value)}
          />
        </Field>
      </div>

      <div className="rounded-xl bg-crema-50 px-4 py-3 text-sm text-espresso-600">
        <span className="font-medium">Brew ratio: </span>
        {ratio > 0 ? `1 : ${ratio.toFixed(2)}` : "—"}
      </div>

      <Field label="Doorlooptijd (sec.)" htmlFor="shot-time" required>
        <input
          id="shot-time"
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          className={inputClass}
          value={extractionTimeSeconds}
          onChange={(e) => setExtractionTime(e.target.value)}
        />
      </Field>

      <Field label="Rating" required>
        <StarRating
          value={rating}
          onChange={(v) => setRating(v)}
          size="lg"
        />
      </Field>

      <Field label="Smaaknotities" htmlFor="shot-notes">
        <textarea
          id="shot-notes"
          className={`${inputClass} min-h-[70px]`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Bv. fruitig, zuur, balans"
        />
      </Field>

      <Field label="Aanpassing volgende keer" htmlFor="shot-adjust">
        <textarea
          id="shot-adjust"
          className={`${inputClass} min-h-[60px]`}
          value={nextAdjustment}
          onChange={(e) => setNextAdjustment(e.target.value)}
          placeholder="Bv. fijner malen, iets minder dose"
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-espresso-600 px-4 py-3 text-base font-medium text-crema-50 transition hover:bg-espresso-700 disabled:opacity-50"
      >
        {submitting ? "Opslaan…" : "Shot opslaan"}
      </button>
    </form>
  );
}
