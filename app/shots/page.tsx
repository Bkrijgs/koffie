"use client";

import { useMemo, useState } from "react";
import { useKoffie } from "@/lib/useKoffie";
import { ShotCard } from "@/components/ShotCard";
import { EmptyState } from "@/components/EmptyState";

const PAGE_SIZE = 15;

export default function ShotsPage() {
  const { ready, beans, shots } = useKoffie();
  const [page, setPage] = useState(0);

  const sorted = useMemo(
    () =>
      [...shots].sort(
        (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      ),
    [shots],
  );

  if (!ready) return <p className="text-sm text-ink-300">Laden…</p>;

  const beanById = new Map(beans.map((b) => [b.id, b]));
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = sorted.slice(
    current * PAGE_SIZE,
    (current + 1) * PAGE_SIZE,
  );

  function goTo(p: number) {
    setPage(p);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl tracking-tighter2 text-ink-800 sm:text-4xl">
          Shots
        </h1>
        <p className="numeric mt-1 text-sm text-ink-400">{shots.length}</p>
      </header>

      {sorted.length === 0 ? (
        <EmptyState
          title="Geen shots"
          description="Voeg je eerste shot toe."
          ctaHref="/shots/new"
          ctaLabel="Nieuwe shot"
        />
      ) : (
        <>
          <div className="space-y-3">
            {visible.map((s) => (
              <ShotCard key={s.id} shot={s} bean={beanById.get(s.beanId)} />
            ))}
          </div>

          {pageCount > 1 && (
            <nav
              className="flex items-center justify-between"
              aria-label="Paginering"
            >
              <button
                type="button"
                onClick={() => goTo(current - 1)}
                disabled={current === 0}
                className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-50/40 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                ← Nieuwer
              </button>
              <span className="numeric text-xs uppercase tracking-[0.14em] text-ink-400">
                Pagina {current + 1} van {pageCount}
              </span>
              <button
                type="button"
                onClick={() => goTo(current + 1)}
                disabled={current >= pageCount - 1}
                className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-50/40 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Ouder →
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
