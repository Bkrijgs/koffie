"use client";

import { useCallback, useEffect, useState } from "react";
import { storage } from "./storage";
import type {
  Bag,
  BagInput,
  Bean,
  BeanInput,
  ShotInput,
  ShotLog,
} from "./types";

type State = {
  beans: Bean[];
  shots: ShotLog[];
  bags: Bag[];
  ready: boolean;
};

const listeners = new Set<() => void>();
const state: State = { beans: [], shots: [], bags: [], ready: false };
let initStarted = false;

async function init() {
  if (initStarted) return;
  initStarted = true;
  const [beans, shots, bags] = await Promise.all([
    storage.listBeans(),
    storage.listShots(),
    storage.listBags(),
  ]);
  state.beans = beans;
  state.shots = shots;
  state.bags = bags;
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

  return {
    ready: state.ready,
    beans: state.beans,
    shots: state.shots,
    bags: state.bags,
    addBean,
    updateBean,
    addShot,
    updateShot,
    addBag,
    updateBag,
  };
}
