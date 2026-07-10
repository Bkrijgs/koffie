"use client";

import { useCallback, useEffect, useState } from "react";
import { storage } from "./storage";
import { DEFAULT_SETUP } from "./setup";
import { errorMessage } from "./utils";
import type {
  Bag,
  BagInput,
  Bean,
  BeanInput,
  Setup,
  ShotInput,
  ShotLog,
} from "./types";

type State = {
  beans: Bean[];
  shots: ShotLog[];
  bags: Bag[];
  setup: Setup;
  ready: boolean;
  /** Laadfout bij init; `retry()` probeert het opnieuw. */
  error: string | null;
};

const listeners = new Set<() => void>();
const state: State = {
  beans: [],
  shots: [],
  bags: [],
  setup: DEFAULT_SETUP,
  ready: false,
  error: null,
};
let initStarted = false;

async function init() {
  if (initStarted) return;
  initStarted = true;
  if (state.error) {
    state.error = null;
    notify();
  }
  try {
    const [beans, shots, bags, setup] = await Promise.all([
      storage.listBeans(),
      storage.listShots(),
      storage.listBags(),
      storage.getSetup(),
    ]);
    state.beans = beans;
    state.shots = shots;
    state.bags = bags;
    state.setup = setup;
    state.ready = true;
  } catch (e) {
    // Guard terugzetten zodat retry() een nieuwe poging kan doen.
    initStarted = false;
    state.error = errorMessage(e, "Kon de gegevens niet laden.");
  }
  notify();
}

function retryInit() {
  void init();
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

  const updateSetup = useCallback(async (input: Setup) => {
    const setup = await storage.saveSetup(input);
    state.setup = setup;
    notify();
    return setup;
  }, []);

  return {
    ready: state.ready,
    error: state.error,
    retry: retryInit,
    beans: state.beans,
    shots: state.shots,
    bags: state.bags,
    setup: state.setup,
    addBean,
    updateBean,
    addShot,
    updateShot,
    deleteShot,
    addBag,
    updateBag,
    updateSetup,
  };
}
