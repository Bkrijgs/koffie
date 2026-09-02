"use client";

import { useCallback, useEffect, useState } from "react";
import { storage } from "./storage";
import { DEFAULT_SETUP } from "./setup";
import type {
  Bag,
  BagInput,
  Bean,
  BeanInput,
  Expense,
  ExpenseInput,
  Setup,
  ShotInput,
  ShotLog,
} from "./types";

type State = {
  beans: Bean[];
  shots: ShotLog[];
  bags: Bag[];
  expenses: Expense[];
  setup: Setup;
  ready: boolean;
  error: string | null;
};

const listeners = new Set<() => void>();
const state: State = {
  beans: [],
  shots: [],
  bags: [],
  expenses: [],
  setup: DEFAULT_SETUP,
  ready: false,
  error: null,
};
let initStarted = false;

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}

/**
 * Een fetch die blijft hangen (bv. een Supabase-verbinding die op een oude
 * e-reader niet tot stand komt en niet faalt) zou de app eeuwig op "Laden…"
 * laten staan. Daarom geven we elke call een tijdslimiet: blijft hij te lang
 * hangen, dan rejecten we zelf zodat de .catch eronder de app verder laat gaan.
 */
const LOAD_TIMEOUT_MS = 8000;
function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(label + " duurde te lang (>8s) — geen verbinding?"));
      }, LOAD_TIMEOUT_MS);
    }),
  ]);
}

async function init() {
  if (initStarted) return;
  initStarted = true;
  // Elke fetch krijgt een timeout én vangt zijn eigen fout op zodat één
  // falende/hangende call (bv. Supabase die niet bereikbaar is op een oude
  // e-reader) de app niet eeuwig op "Laden…" laat hangen. Fouten worden
  // verzameld en zichtbaar getoond.
  const errors: string[] = [];
  const [beans, shots, bags, expenses, setup] = await Promise.all([
    withTimeout(storage.listBeans(), "bonen").catch((e) => {
      errors.push("bonen: " + errMsg(e));
      return [] as Bean[];
    }),
    withTimeout(storage.listShots(), "shots").catch((e) => {
      errors.push("shots: " + errMsg(e));
      return [] as ShotLog[];
    }),
    withTimeout(storage.listBags(), "zakken").catch((e) => {
      errors.push("zakken: " + errMsg(e));
      return [] as Bag[];
    }),
    withTimeout(storage.listExpenses(), "uitgaven").catch((e) => {
      errors.push("uitgaven: " + errMsg(e));
      return [] as Expense[];
    }),
    withTimeout(storage.getSetup(), "setup").catch((e) => {
      errors.push("setup: " + errMsg(e));
      return DEFAULT_SETUP;
    }),
  ]);
  state.beans = beans;
  state.shots = shots;
  state.bags = bags;
  state.expenses = expenses;
  state.setup = setup;
  state.error = errors.length > 0 ? errors.join(" | ") : null;
  state.ready = true;
  listeners.forEach((l) => l());
}

function notify() {
  listeners.forEach((l) => l());
}

export function useKoffie() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    init();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const addBean = useCallback(async (input: BeanInput) => {
    const bean = await storage.addBean(input);
    state.beans = [bean, ...state.beans];
    notify();
    return bean;
  }, []);

  const updateBean = useCallback(async (id: string, input: BeanInput) => {
    const bean = await storage.updateBean(id, input);
    state.beans = state.beans.map((b) => (b.id === id ? bean : b));
    notify();
    return bean;
  }, []);

  const addShot = useCallback(async (input: ShotInput) => {
    const shot = await storage.addShot(input);
    state.shots = [shot, ...state.shots];
    notify();
    return shot;
  }, []);

  const updateShot = useCallback(async (id: string, input: ShotInput) => {
    const shot = await storage.updateShot(id, input);
    state.shots = state.shots.map((s) => (s.id === id ? shot : s));
    notify();
    return shot;
  }, []);

  const deleteShot = useCallback(async (id: string) => {
    await storage.deleteShot(id);
    state.shots = state.shots.filter((s) => s.id !== id);
    notify();
  }, []);

  const addBag = useCallback(async (input: BagInput) => {
    const bag = await storage.addBag(input);
    state.bags = [bag, ...state.bags];
    notify();
    return bag;
  }, []);

  const updateBag = useCallback(async (id: string, input: BagInput) => {
    const bag = await storage.updateBag(id, input);
    state.bags = state.bags.map((b) => (b.id === id ? bag : b));
    notify();
    return bag;
  }, []);

  const addExpense = useCallback(async (input: ExpenseInput) => {
    const expense = await storage.addExpense(input);
    state.expenses = [expense, ...state.expenses];
    notify();
    return expense;
  }, []);

  const updateExpense = useCallback(
    async (id: string, input: ExpenseInput) => {
      const expense = await storage.updateExpense(id, input);
      state.expenses = state.expenses.map((e) => (e.id === id ? expense : e));
      notify();
      return expense;
    },
    [],
  );

  const deleteExpense = useCallback(async (id: string) => {
    await storage.deleteExpense(id);
    state.expenses = state.expenses.filter((e) => e.id !== id);
    notify();
  }, []);

  const updateSetup = useCallback(async (input: Setup) => {
    const setup = await storage.saveSetup(input);
    state.setup = setup;
    notify();
    return setup;
  }, []);

  return {
    ready: state.ready,
    error: state.error,
    beans: state.beans,
    shots: state.shots,
    bags: state.bags,
    expenses: state.expenses,
    setup: state.setup,
    addBean,
    updateBean,
    addShot,
    updateShot,
    deleteShot,
    addBag,
    updateBag,
    addExpense,
    updateExpense,
    deleteExpense,
    updateSetup,
  };
}
