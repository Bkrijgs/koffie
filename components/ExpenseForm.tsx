"use client";

import { useState } from "react";
import { useKoffie } from "@/lib/useKoffie";
import { CATEGORY_LABEL } from "@/lib/expenses";
import { parseDecimal } from "@/lib/utils";
import type { Expense, ExpenseCategory } from "@/lib/types";
import { Field, inputClass } from "./Field";

type Props = {
  /** Meegeven om te bewerken; weglaten voor een nieuwe uitgave. */
  expense?: Expense;
  onSaved?: () => void;
  onCancel?: () => void;
};

const CATEGORIES: ExpenseCategory[] = ["onderhoud", "apparatuur", "overig"];

const CATEGORY_HINT: Record<ExpenseCategory, string> = {
  onderhoud: "Waterfilter, schoonmaakmiddel, ontkalker — telt mee per maand.",
  apparatuur:
    "Machine, molen, tamper — eenmalige investering, blijft buiten je maandcijfers.",
  overig: "Kopjes, bakjes, alles wat verder bij de opstelling hoort.",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseForm({ expense, onSaved, onCancel }: Props) {
  const { addExpense, updateExpense } = useKoffie();
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(
    expense ? String(expense.amountEuros) : "",
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    expense?.category ?? "onderhoud",
  );
  const [purchasedAt, setPurchasedAt] = useState(
    expense?.purchasedAt ?? todayIso(),
  );
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = description.trim();
    if (!trimmed) {
      setError("Omschrijving vereist");
      return;
    }
    const amountEuros = parseDecimal(amount);
    if (amountEuros === undefined) {
      setError("Geldig bedrag vereist");
      return;
    }
    if (!purchasedAt) {
      setError("Datum vereist");
      return;
    }

    const input = {
      description: trimmed,
      amountEuros,
      category,
      purchasedAt,
      notes: notes.trim() || undefined,
    };

    setSubmitting(true);
    try {
      if (expense) {
        await updateExpense(expense.id, input);
      } else {
        await addExpense(input);
      }
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Wat heb je gekocht?" htmlFor="expense-description" required>
        <input
          id="expense-description"
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Waterfilter, Cafiza-tabletten…"
          autoFocus
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bedrag (€)" htmlFor="expense-amount" required>
          <input
            id="expense-amount"
            type="text"
            inputMode="decimal"
            className={`${inputClass} numeric`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="12,95"
          />
        </Field>
        <Field label="Gekocht op" htmlFor="expense-date" required>
          <input
            id="expense-date"
            type="date"
            className={inputClass}
            value={purchasedAt}
            onChange={(e) => setPurchasedAt(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Categorie" hint={CATEGORY_HINT[category]}>
        <div className="inline-flex rounded-lg border border-line bg-card p-0.5 text-xs">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`rounded-md px-2.5 py-1 transition ${
                category === c
                  ? "bg-ink-800 text-paper"
                  : "text-ink-400 hover:text-ink-700"
              }`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Opmerkingen" htmlFor="expense-notes">
        <input
          id="expense-notes"
          className={inputClass}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Gaat 2 maanden mee…"
        />
      </Field>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-ink-800 px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-ink-700 disabled:opacity-50"
        >
          {submitting ? "…" : expense ? "Opslaan" : "Uitgave toevoegen"}
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
