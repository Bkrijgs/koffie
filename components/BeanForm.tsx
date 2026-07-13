"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useKoffie } from "@/lib/useKoffie";
import type { Bean } from "@/lib/types";
import { parseDecimal } from "@/lib/utils";
import { Field, inputClass } from "./Field";

type Props = {
  bean?: Bean;
  onCreated?: (id: string) => void;
  onUpdated?: (id: string) => void;
  onCancel?: () => void;
};

export function BeanForm({ bean, onCreated, onUpdated, onCancel }: Props) {
  const { addBean, updateBean } = useKoffie();
  const router = useRouter();
  const isEdit = Boolean(bean);

  const [name, setName] = useState(bean?.name ?? "");
  const [roaster, setRoaster] = useState(bean?.roaster ?? "");
  const [origin, setOrigin] = useState(bean?.origin ?? "");
  const [blend, setBlend] = useState(bean?.blend ?? "");
  const [roastDate, setRoastDate] = useState(bean?.roastDate ?? "");
  const [price, setPrice] = useState(
    bean?.priceEuros != null ? String(bean.priceEuros).replace(".", ",") : "",
  );
  const [bagWeight, setBagWeight] = useState(
    bean?.bagWeightGrams != null ? String(bean.bagWeightGrams) : "",
  );
  const [notes, setNotes] = useState(bean?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Naam vereist");
      return;
    }
    const priceEuros = parseDecimal(price);
    if (price.trim() && priceEuros === undefined) {
      setError("Ongeldige prijs");
      return;
    }
    const bagWeightGrams = parseDecimal(bagWeight);
    if (bagWeight.trim() && bagWeightGrams === undefined) {
      setError("Ongeldig zakgewicht");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        roaster: roaster.trim() || undefined,
        origin: origin.trim() || undefined,
        blend: blend.trim() || undefined,
        roastDate: roastDate || undefined,
        priceEuros,
        bagWeightGrams,
        notes: notes.trim() || undefined,
      };
      if (bean) {
        await updateBean(bean.id, payload);
        if (onUpdated) {
          onUpdated(bean.id);
        } else {
          router.push(`/beans/${bean.id}`);
        }
      } else {
        const created = await addBean(payload);
        if (onCreated) {
          onCreated(created.id);
        } else {
          router.push(`/beans/${created.id}`);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Naam" htmlFor="bean-name" required>
        <input
          id="bean-name"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ethiopia Yirgacheffe"
          autoFocus
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Brander" htmlFor="bean-roaster">
          <input
            id="bean-roaster"
            className={inputClass}
            value={roaster}
            onChange={(e) => setRoaster(e.target.value)}
            placeholder="Friedhats"
          />
        </Field>
        <Field label="Herkomst" htmlFor="bean-origin">
          <input
            id="bean-origin"
            className={inputClass}
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="Ethiopië, Sidamo"
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Soort" htmlFor="bean-blend">
          <input
            id="bean-blend"
            className={inputClass}
            value={blend}
            onChange={(e) => setBlend(e.target.value)}
            placeholder="100% arabica / blend"
          />
        </Field>
        <Field label="Branddatum" htmlFor="bean-roast-date">
          <input
            id="bean-roast-date"
            type="date"
            className={inputClass}
            value={roastDate}
            onChange={(e) => setRoastDate(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Prijs (€ per zak)" htmlFor="bean-price">
          <input
            id="bean-price"
            type="text"
            inputMode="decimal"
            className={`${inputClass} numeric`}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="9,50"
          />
        </Field>
        <Field label="Zakgewicht (g)" htmlFor="bean-bag-weight">
          <input
            id="bean-bag-weight"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            className={`${inputClass} numeric`}
            value={bagWeight}
            onChange={(e) => setBagWeight(e.target.value)}
            placeholder="250"
          />
        </Field>
      </div>

      <Field label="Opmerkingen" htmlFor="bean-notes">
        <textarea
          id="bean-notes"
          className={`${inputClass} min-h-[80px]`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Smaakprofiel"
        />
      </Field>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-ink-800 px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-ink-700 disabled:opacity-50"
        >
          {submitting ? "…" : isEdit ? "Bijwerken" : "Opslaan"}
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
