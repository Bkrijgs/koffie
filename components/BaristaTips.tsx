import type { Tip, TipKind } from "@/lib/tips";
import { moodForTips } from "@/lib/tips";
import { Barista, type BaristaMood } from "./Barista";

type Props = {
  tips: Tip[];
  mood?: BaristaMood;
};

const dotClass: Record<TipKind, string> = {
  tweak: "bg-gold-400",
  info: "bg-ink-200",
  praise: "bg-emerald-500",
  warn: "bg-red-500",
};

export function BaristaTips({ tips, mood }: Props) {
  if (tips.length === 0) return null;
  const resolvedMood = mood ?? moodForTips(tips);
  return (
    <aside className="rounded-xl2 border border-line bg-card p-5 shadow-soft">
      <div className="flex gap-4">
        <div className="shrink-0 text-ink-700">
          <Barista size={56} mood={resolvedMood} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
            Barista
          </p>
          <ul className="mt-2 space-y-2.5">
            {tips.map((t) => (
              <li key={t.id} className="flex gap-2.5 text-sm text-ink-700">
                <span
                  className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotClass[t.kind]}`}
                  aria-hidden
                />
                <span>{t.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
