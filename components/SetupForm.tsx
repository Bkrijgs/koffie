"use client";

import { useEffect, useState } from "react";
import { useKoffie } from "@/lib/useKoffie";
import type { Setup } from "@/lib/types";
import { errorMessage } from "@/lib/utils";
import { Field, inputClass } from "./Field";
import { LoadState } from "./LoadState";

export function SetupForm() {
  const { setup, updateSetup, ready } = useKoffie();
  const [draft, setDraft] = useState<Setup>(setup);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // useKoffie laadt de echte setup async; zodra die binnen is nemen we
  // 'm over in het formulier.
  useEffect(() => {
    if (ready) setDraft(setup);
  }, [ready, setup]);

  function set<K extends keyof Setup>(key: K, value: Setup[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateSetup({
        ...draft,
        notes: draft.notes?.trim() ? draft.notes.trim() : undefined,
      });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, "Opslaan mislukt. Probeer het opnieuw."));
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return <LoadState />;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-ink-400">
        Deze gegevens voeden de barista-adviezen — hoe nauwkeuriger je setup,
        hoe machine-specifieker de tips.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Machine" htmlFor="setup-machine">
          <input
            id="setup-machine"
            className={inputClass}
            value={draft.machine}
            onChange={(e) => set("machine", e.target.value)}
            placeholder="Sage Barista Express"
          />
        </Field>
        <Field label="Maler" htmlFor="setup-grinder">
          <input
            id="setup-grinder"
            className={inputClass}
            value={draft.grinder}
            onChange={(e) => set("grinder", e.target.value)}
            placeholder="Ingebouwde conische maler"
          />
        </Field>
      </div>

      <div>
        <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">
          Maalgraad-schaal
        </span>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Min" htmlFor="setup-grind-min">
            <input
              id="setup-grind-min"
              type="number"
              step="0.5"
              className={`${inputClass} numeric`}
              value={draft.grindMin}
              onChange={(e) => set("grindMin", Number(e.target.value))}
            />
          </Field>
          <Field label="Max" htmlFor="setup-grind-max">
            <input
              id="setup-grind-max"
              type="number"
              step="0.5"
              className={`${inputClass} numeric`}
              value={draft.grindMax}
              onChange={(e) => set("grindMax", Number(e.target.value))}
            />
          </Field>
          <Field label="Stap" htmlFor="setup-grind-step">
            <input
              id="setup-grind-step"
              type="number"
              step="0.1"
              min="0.1"
              className={`${inputClass} numeric`}
              value={draft.grindStep}
              onChange={(e) => set("grindStep", Number(e.target.value))}
            />
          </Field>
        </div>
        <span className="mt-1 block text-xs text-ink-300">
          Sage Barista Express: buitenring 1–16 (1 = fijn).
        </span>
      </div>

      <Field label="Standaard basket" htmlFor="setup-basket">
        <select
          id="setup-basket"
          className={inputClass}
          value={draft.defaultBasket}
          onChange={(e) =>
            set("defaultBasket", e.target.value as Setup["defaultBasket"])
          }
        >
          <option value="double">Dubbel</option>
          <option value="single">Enkel</option>
        </select>
      </Field>

      <div className="space-y-2">
        <Toggle
          label="Drukmeter aanwezig"
          checked={draft.pressureGauge}
          onChange={(v) => set("pressureGauge", v)}
        />
        <Toggle
          label="Pre-infusion"
          checked={draft.preInfusion}
          onChange={(v) => set("preInfusion", v)}
        />
        <Toggle
          label="PID temperatuurregeling"
          checked={draft.pid}
          onChange={(v) => set("pid", v)}
        />
        <Toggle
          label="Pressurized basket"
          checked={draft.pressurized}
          onChange={(v) => set("pressurized", v)}
        />
        <Toggle
          label="Dose en yield gewogen"
          checked={draft.weighs}
          onChange={(v) => set("weighs", v)}
        />
      </div>

      <Field label="Opmerkingen" htmlFor="setup-notes">
        <textarea
          id="setup-notes"
          className={`${inputClass} min-h-[70px]`}
          value={draft.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Binnenburr-stand, water, bijzonderheden…"
        />
      </Field>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-ink-800 px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-ink-700 disabled:opacity-50"
        >
          {submitting ? "Opslaan…" : "Opslaan"}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 anim-fade-in">
            Opgeslagen
          </span>
        )}
      </div>
    </form>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-ink-800"
      />
      <span className="text-ink-700">{label}</span>
    </label>
  );
}
