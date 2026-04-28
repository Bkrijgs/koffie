"use client";

import { useCallback, useEffect, useState } from "react";
import { storage } from "./storage";
import type { Bean, BeanInput, ShotInput, ShotLog } from "./types";

type State = {
  beans: Bean[];
  shots: ShotLog[];
  ready: boolean;
};

const listeners = new Set<() => void>();
const state: State = { beans: [], shots: [], ready: false };
let initStarted = false;

async function init() {
  if (initStarted) return;
  initStarted = true;
  const [beans, shots] = await Promise.all([
    storage.listBeans(),
    storage.listShots(),
  ]);
  state.beans = beans;
  state.shots = shots;
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

  return {
    ready: state.ready,
    beans: state.beans,
    shots: state.shots,
    addBean,
    addShot,
    updateShot,
  };
}
