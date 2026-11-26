import { CATEGORY_LABEL } from "@/lib/expenses";
import type { ExpenseCategory } from "@/lib/types";

/** Zelfde chip-vorm als PriceTierBadge/GiftBadge, zodat de kostenpagina
 *  één badge-taal spreekt. */
const CATEGORY_STYLE: Record<ExpenseCategory, string> = {
  onderhoud: "bg-barista-100 text-barista-500",
  apparatuur: "bg-gold-300/30 text-gold-500",
  overig: "bg-ink-100 text-ink-500",
};

export function ExpenseCategoryBadge({
  category,
}: {
  category: ExpenseCategory;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${CATEGORY_STYLE[category]}`}
    >
      {CATEGORY_LABEL[category]}
    </span>
  );
}
