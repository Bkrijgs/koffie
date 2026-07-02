"use client";

import { useState } from "react";
import { useKoffie } from "@/lib/useKoffie";
import { BeanCard } from "@/components/BeanCard";
import { BeanForm } from "@/components/BeanForm";
import { EmptyState } from "@/components/EmptyState";
import { LoadState } from "@/components/LoadState";

export default function BeansPage() {
  const { ready, beans, shots } = useKoffie();
  const [showForm, setShowForm] = useState(false);

  if (!ready) {
    return <LoadState />;
  }

  const shotsByBean = new Map<string, typeof shots>();
  for (const s of shots) {
    const list = shotsByBean.get(s.beanId) ?? [];
    list.push(s);
    shotsByBean.set(s.beanId, list);
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tighter2 text-ink-800 sm:text-4xl">
            Bonen
          </h1>
          <p className="numeric mt-1 text-sm text-ink-400">
            {beans.length}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-ink-800 px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-700"
        >
          {showForm ? "Sluiten" : "Nieuwe boon"}
        </button>
      </header>

      {showForm && (
        <div className="rounded-xl2 border border-line bg-card p-6 shadow-soft">
          <BeanForm
            onCreated={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {beans.length === 0 ? (
        <EmptyState
          title="Geen bonen"
          description="Voeg je eerste boon toe."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {beans.map((b) => (
            <BeanCard
              key={b.id}
              bean={b}
              shots={shotsByBean.get(b.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
