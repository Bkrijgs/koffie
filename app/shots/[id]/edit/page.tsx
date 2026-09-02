"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useKoffie } from "@/lib/useKoffie";
import { ShotForm } from "@/components/ShotForm";
import { BaristaTips } from "@/components/BaristaTips";
import { tipsForShot } from "@/lib/tips";

export default function EditShotPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { ready, beans, shots, deleteShot } = useKoffie();
  const [deleting, setDeleting] = useState(false);

  const shot = useMemo(
    () => (id ? shots.find((s) => s.id === id) : undefined),
    [id, shots],
  );
  const bean = useMemo(
    () => (shot ? beans.find((b) => b.id === shot.beanId) : undefined),
    [beans, shot],
  );
  const beanShots = useMemo(
    () => (shot ? shots.filter((s) => s.beanId === shot.beanId) : []),
    [shots, shot],
  );
  const tips = useMemo(
    () => (shot ? tipsForShot(shot, bean, beanShots) : []),
    [shot, bean, beanShots],
  );

  async function handleDelete() {
    if (!shot) return;
    if (
      !confirm("Deze shot verwijderen? Dit kan niet ongedaan worden gemaakt.")
    )
      return;
    setDeleting(true);
    try {
      const beanId = shot.beanId;
      await deleteShot(shot.id);
      router.push(`/beans/${beanId}`);
    } finally {
      setDeleting(false);
    }
  }

  if (!ready) return <p className="text-sm text-ink-300">Laden…</p>;

  if (!shot) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-500">Shot niet gevonden.</p>
        <Link href="/" className="text-sm text-ink-700 underline">
          ← Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/beans/${shot.beanId}`}
        className="text-sm text-ink-300 hover:text-ink-700"
      >
        ← Boon
      </Link>
      <h1 className="font-display text-3xl tracking-tighter2 text-ink-800 sm:text-4xl">
        {shot.draft ? "Concept afmaken" : "Shot bewerken"}
      </h1>
      {bean?.caffeineMgPerGram !== undefined && (
        <p className="numeric text-sm text-ink-400">
          ±{Math.round(shot.doseGrams * bean.caffeineMgPerGram)} mg cafeïne in
          deze shot
        </p>
      )}

      <BaristaTips tips={tips} />

      <div className="rounded-xl2 border border-line bg-card p-6 shadow-soft">
        <ShotForm shot={shot} />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg border border-clay-300/60 px-4 py-2.5 text-sm font-medium text-clay-500 transition hover:bg-clay-400/10 disabled:opacity-50"
        >
          {deleting ? "Verwijderen…" : "Shot verwijderen"}
        </button>
      </div>
    </div>
  );
}
