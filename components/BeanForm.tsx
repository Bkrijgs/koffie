"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useKoffie } from "@/lib/useKoffie";
import { Field, inputClass } from "./Field";

type Props = {
  onCreated?: (id: string) => void;
  onCancel?: () => void;
};

export function BeanForm({ onCreated, onCancel }: Props) {
  const { addBean } = useKoffie();
  const router = useRouter();
  const [name, setName] = useState("");
  const [roaster, setRoaster] = useState("");
  const [origin, setOrigin] = useState("");
  const [roastDate, setRoastDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Naam vereist");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const bean = await addBean({
        name: name.trim(),
        roaster: roaster.trim() || undefined,
        origin: origin.trim() || undefined,
        roastDate: roastDate || undefined,
        notes: notes.trim() || undefined,
      });
      if (onCreated) {
        onCreated(bean.id);
      } else {
        router.push(`/beans/${bean.id}`);
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

      <Field label="Branddatum" htmlFor="bean-roast-date">
        <input
          id="bean-roast-date"
          type="date"
          className={inputClass}
          value={roastDate}
          onChange={(e) => setRoastDate(e.target.value)}
        />
      </Field>

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
          {submitting ? "…" : "Opslaan"}
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
