"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ShotForm } from "@/components/ShotForm";

function NewShotInner() {
  const params = useSearchParams();
  const beanId = params.get("beanId") ?? undefined;
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-espresso-700">
          Nieuwe shot
        </h1>
        <p className="text-sm text-espresso-400">
          Leg vast wat goed werkte en wat je volgende keer wilt aanpassen.
        </p>
      </header>
      <div className="rounded-2xl border border-crema-100 bg-white p-5 shadow-soft">
        <ShotForm initialBeanId={beanId} />
      </div>
    </div>
  );
}

export default function NewShotPage() {
  return (
    <Suspense fallback={<p className="text-sm text-espresso-400">Laden…</p>}>
      <NewShotInner />
    </Suspense>
  );
}
