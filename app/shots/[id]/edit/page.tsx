"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useKoffie } from "@/lib/useKoffie";
import { ShotForm } from "@/components/ShotForm";
import { BaristaTips } from "@/components/BaristaTips";
import { tipsForShot } from "@/lib/tips";

export default function EditShotPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { ready, beans, shots } = useKoffie();

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
        Shot bewerken
      </h1>

      <BaristaTips tips={tips} />

      <div className="rounded-xl2 border border-line bg-card p-6 shadow-soft">
        <ShotForm shot={shot} />
      </div>
    </div>
  );
}
