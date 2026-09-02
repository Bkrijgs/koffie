import type { Expense, ExpenseCategory } from "./types";

/**
 * Lopende kosten: wat je maand op maand kwijt bent aan de opstelling.
 * `apparatuur` valt hier bewust buiten — dat zijn eenmalige investeringen die
 * je maandbeeld zouden vertekenen (een molen van €400 in één maandbalk zegt
 * niets over wat koffie je normaal kost). Die telt apart als "geïnvesteerd".
 */
export const RUNNING_CATEGORIES: ExpenseCategory[] = ["onderhoud", "overig"];

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  onderhoud: "Onderhoud",
  apparatuur: "Apparatuur",
  overig: "Overig",
};

export function isRunning(e: Expense): boolean {
  return e.category !== "apparatuur";
}

function sum(expenses: Expense[]): number {
  return expenses.reduce((total, e) => total + e.amountEuros, 0);
}

/** Onderhoud + overig, dus alles wat in de maand- en totaalcijfers meetelt. */
export function runningTotal(expenses: Expense[]): number {
  return sum(expenses.filter(isRunning));
}

/** Eenmalige apparatuur, all-time. Staat los van de maandcijfers. */
export function investedTotal(expenses: Expense[]): number {
  return sum(expenses.filter((e) => e.category === "apparatuur"));
}

/**
 * `purchasedAt` is een kale "YYYY-MM-DD". Die door `new Date()` halen leest
 * hem als UTC-middernacht, wat in een andere tijdzone een dag (en dus soms
 * een maand) kan verschuiven. Daarom vergelijken we op de string zelf.
 */
export function monthKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export function expensesInMonth(expenses: Expense[], ref: Date): Expense[] {
  const key = monthKey(ref);
  return expenses.filter((e) => e.purchasedAt.slice(0, 7) === key);
}

export function totalsByCategory(
  expenses: Expense[],
): Record<ExpenseCategory, { total: number; count: number }> {
  const totals: Record<ExpenseCategory, { total: number; count: number }> = {
    onderhoud: { total: 0, count: 0 },
    apparatuur: { total: 0, count: 0 },
    overig: { total: 0, count: 0 },
  };
  for (const e of expenses) {
    totals[e.category].total += e.amountEuros;
    totals[e.category].count += 1;
  }
  return totals;
}

/** Nieuwste aankoop eerst; bij dezelfde datum de laatst ingevoerde bovenaan. */
export function sortByPurchasedAt(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) =>
    a.purchasedAt === b.purchasedAt
      ? +new Date(b.createdAt) - +new Date(a.createdAt)
      : b.purchasedAt.localeCompare(a.purchasedAt),
  );
}
