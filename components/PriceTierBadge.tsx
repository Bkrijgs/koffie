import type { PriceTier } from "@/lib/utils";

const TIER_LABEL: Record<PriceTier, string> = {
  budget: "Budget",
  midden: "Midden",
  premium: "Premium",
};

const TIER_STYLE: Record<PriceTier, string> = {
  budget: "bg-ink-100 text-ink-500",
  midden: "bg-barista-100 text-barista-500",
  premium: "bg-gold-300/30 text-gold-500",
};

export function PriceTierBadge({ tier }: { tier: PriceTier }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${TIER_STYLE[tier]}`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}
