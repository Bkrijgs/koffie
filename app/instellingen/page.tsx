import { SetupForm } from "@/components/SetupForm";

export default function InstellingenPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-tighter2 text-ink-800 sm:text-4xl">
          Instellingen
        </h1>
        <p className="mt-1 text-sm text-ink-400">Je apparatuur</p>
      </header>
      <div className="rounded-xl2 border border-line bg-card p-6 shadow-soft">
        <SetupForm />
      </div>
    </div>
  );
}
