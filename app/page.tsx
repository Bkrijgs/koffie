"use client";

import Link from "next/link";
import { useKoffie } from "@/lib/useKoffie";
import { ShotCard } from "@/components/ShotCard";
import { EmptyState } from "@/components/EmptyState";

export default function DashboardPage() {
  const { ready, beans, shots } = useKoffie();

  if (!ready) {
    return <p className="text-sm text-espresso-400">Laden…</p>;
  }

  const beanById = new Map(beans.map((b) => [b.id, b]));
  const recent = shots.slice(0, 5);
  const best = [...shots]
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    })
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-espresso-600 to-espresso-700 p-6 text-crema-50 shadow-soft sm:p-8">
        <p className="text-xs uppercase tracking-widest text-crema-200">
          Sage Barista Express
        </p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
          Hoe was je shot vandaag?
        </h1>
        <p className="mt-2 text-sm text-crema-100">
          Log je espresso, ontdek je beste maalgraad per boon en wat je
          volgende keer wilt aanpassen.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/shots/new"
            className="rounded-full bg-crema-50 px-4 py-2 text-sm font-medium text-espresso-700 hover:bg-crema-100"
          >
            + Nieuwe shot loggen
          </Link>
          <Link
            href="/beans"
            className="rounded-full border border-crema-200/30 px-4 py-2 text-sm font-medium text-crema-50 hover:bg-espresso-500"
          >
            Bonen beheren
          </Link>
        </div>
      </section>

      <section>
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-espresso-700">
            Laatste shots
          </h2>
          {shots.length > 5 && (
            <Link
              href="/beans"
              className="text-sm text-espresso-500 hover:text-crema-500"
            >
              Alles bekijken →
            </Link>
          )}
        </header>
        {recent.length === 0 ? (
          <EmptyState
            title="Nog geen shots"
            description="Log je eerste espresso om te beginnen met je dial-in."
            ctaHref="/shots/new"
            ctaLabel="+ Nieuwe shot"
          />
        ) : (
          <div className="space-y-3">
            {recent.map((s) => (
              <ShotCard key={s.id} shot={s} bean={beanById.get(s.beanId)} />
            ))}
          </div>
        )}
      </section>

      {best.length > 0 && (
        <section>
          <header className="mb-3">
            <h2 className="text-lg font-semibold text-espresso-700">
              Hoogst beoordeeld
            </h2>
          </header>
          <div className="space-y-3">
            {best.map((s) => (
              <ShotCard key={s.id} shot={s} bean={beanById.get(s.beanId)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
