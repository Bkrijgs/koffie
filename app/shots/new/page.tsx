"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ShotForm } from "@/components/ShotForm";

function NewShotInner() {
  const params = useSearchParams();
  const beanId = params.get("beanId") ?? undefined;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-tighter2 text-ink-800 sm:text-4xl">
        Nieuwe shot
      </h1>
      <div className="rounded-xl2 border border-line bg-card p-6 shadow-soft">
        <ShotForm initialBeanId={beanId} />
      </div>
    </div>
  );
}

export default function NewShotPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-300">Laden…</p>}>
      <NewShotInner />
    </Suspense>
  );
}
