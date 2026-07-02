"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useKoffie } from "@/lib/useKoffie";
import { BeanForm } from "@/components/BeanForm";
import { LoadState } from "@/components/LoadState";

export default function EditBeanPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { ready, beans } = useKoffie();

  if (!ready) return <LoadState />;

  const bean = id ? beans.find((b) => b.id === id) : undefined;
  if (!bean) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-500">Boon niet gevonden.</p>
        <Link href="/beans" className="text-sm text-ink-700 underline">
          ← Bonen
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/beans/${bean.id}`}
        className="text-sm text-ink-300 hover:text-ink-700"
      >
        ← {bean.name}
      </Link>
      <h1 className="font-display text-3xl tracking-tighter2 text-ink-800 sm:text-4xl">
        Boon bewerken
      </h1>
      <div className="rounded-xl2 border border-line bg-card p-6 shadow-soft">
        <BeanForm bean={bean} />
      </div>
    </div>
  );
}
