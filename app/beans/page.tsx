"use client";

import { useState } from "react";
import { useKoffie } from "@/lib/useKoffie";
import { BeanCard } from "@/components/BeanCard";
import { BeanForm } from "@/components/BeanForm";
import { EmptyState } from "@/components/EmptyState";

export default function BeansPage() {
  const { ready, beans, shots } = useKoffie();
  const [showForm, setShowForm] = useState(false);

  if (!ready) {
    return <p className="text-sm text-espresso-400">Laden…</p>;
  }

  const shotsByBean = new Map<string, typeof shots>();
  for (const s of shots) {
    const list = shotsByBean.get(s.beanId) ?? [];
    list.push(s);
    shotsByBean.set(s.beanId, list);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-espresso-700">Bonen</h1>
          <p className="text-sm text-espresso-400">
            {beans.length} {beans.length === 1 ? "boon" : "bonen"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-espresso-600 px-4 py-2 text-sm font-medium text-crema-50 hover:bg-espresso-700"
        >
          {showForm ? "Sluiten" : "+ Nieuwe boon"}
        </button>
      </header>

      {showForm && (
        <div className="rounded-2xl border border-crema-100 bg-white p-5 shadow-soft">
          <h2 className="mb-4 text-lg font-semibold text-espresso-700">
            Nieuwe boon
          </h2>
          <BeanForm
            onCreated={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {beans.length === 0 ? (
        <EmptyState
          title="Nog geen bonen"
          description="Voeg je eerste zak koffie toe om shots te kunnen loggen."
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
