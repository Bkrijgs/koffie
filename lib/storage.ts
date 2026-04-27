import type { Bean, BeanInput, ShotInput, ShotLog } from "./types";
import { calcBrewRatio, uid } from "./utils";

/**
 * Storage abstraction. The MVP uses localStorage; swap this module's
 * implementation (or pass a different `Storage` to `createStore`) to move
 * to Supabase / Vercel Postgres without touching the UI.
 */
export interface KoffieStorage {
  listBeans(): Promise<Bean[]>;
  addBean(input: BeanInput): Promise<Bean>;
  getBean(id: string): Promise<Bean | undefined>;

  listShots(): Promise<ShotLog[]>;
  addShot(input: ShotInput): Promise<ShotLog>;
  shotsForBean(beanId: string): Promise<ShotLog[]>;
}

const BEANS_KEY = "koffie:beans:v1";
const SHOTS_KEY = "koffie:shots:v1";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const localStorageBackend: KoffieStorage = {
  async listBeans() {
    return read<Bean>(BEANS_KEY).sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
  },
  async addBean(input) {
    const bean: Bean = {
      id: uid(),
      createdAt: new Date().toISOString(),
      ...input,
    };
    const all = read<Bean>(BEANS_KEY);
    all.push(bean);
    write(BEANS_KEY, all);
    return bean;
  },
  async getBean(id) {
    return read<Bean>(BEANS_KEY).find((b) => b.id === id);
  },
  async listShots() {
    return read<ShotLog>(SHOTS_KEY).sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
  },
  async addShot(input) {
    const shot: ShotLog = {
      id: uid(),
      createdAt: new Date().toISOString(),
      brewRatio: calcBrewRatio(input.yieldGrams, input.doseGrams),
      ...input,
    };
    const all = read<ShotLog>(SHOTS_KEY);
    all.push(shot);
    write(SHOTS_KEY, all);
    return shot;
  },
  async shotsForBean(beanId) {
    return read<ShotLog>(SHOTS_KEY)
      .filter((s) => s.beanId === beanId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },
};

export const storage: KoffieStorage = localStorageBackend;
