"use client";

import { useState } from "react";
import { useKoffie } from "@/lib/useKoffie";
import { Field, inputClass } from "./Field";

type Props = {
  beanId: string;
  onCreated?: () => void;
  onCancel?: () => void;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BagForm({ beanId, onCreated, onCancel }: Props) {
  const { addBag } = useKoffie();
  const [grams, setGrams] = useState("250");
  const [openedAt, setOpenedAt] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const g = parseFloat(grams);
    if (!isFinite(g) || g <= 0) {
      setError("Geldig gewicht (g) vereist");
      return;
    }
    if (!openedAt) {
      setError("Geopend-op datum vereist");
      return;
    }
    setSubmitting(true);
    try {
      await addBag({
        beanId,
        grams: g,
        openedAt,
        notes: notes.trim() || undefined,
      });
      onCreated?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gewicht (g)" htmlFor="bag-grams" required>
          <input
            id="bag-grams"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            className={`${inputClass} numeric`}
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            placeholder="250"
            autoFocus
          />
        </Field>
        <Field label="Geopend op" htmlFor="bag-opened" required>
          <input
            id="bag-opened"
            type="date"
            className={inputClass}
            value={openedAt}
            onChange={(e) => setOpenedAt(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Opmerkingen" htmlFor="bag-notes">
        <input
          id="bag-notes"
          className={inputClass}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Aanbieding, cadeau…"
        />
      </Field>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-ink-800 px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-ink-700 disabled:opacity-50"
        >
          {submitting ? "…" : "Zak openen"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink-600 transition hover:bg-ink-50/40"
          >
            Annuleren
          </button>
        )}
      </div>
    </form>
  );
}
