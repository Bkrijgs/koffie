import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { Bean, BeanInput, ShotInput, ShotLog } from "./types";
import { calcBrewRatio, uid } from "./utils";

/**
 * Storage abstraction. The app uses Supabase when configured, and falls back
 * to localStorage so the MVP keeps working without env vars (e.g. in preview
 * builds before Supabase is wired up).
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

type BeanRow = {
  id: string;
  name: string;
  roaster: string | null;
  origin: string | null;
  roast_date: string | null;
  notes: string | null;
  created_at: string;
};

type ShotRow = {
  id: string;
  bean_id: string;
  grind_size: string;
  dose_grams: number;
  yield_grams: number;
  brew_ratio: number;
  extraction_time_seconds: number;
  notes: string | null;
  next_adjustment: string | null;
  rating: number;
  created_at: string;
};

function beanFromRow(row: BeanRow): Bean {
  return {
    id: row.id,
    name: row.name,
    roaster: row.roaster ?? undefined,
    origin: row.origin ?? undefined,
    roastDate: row.roast_date ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

function shotFromRow(row: ShotRow): ShotLog {
  return {
    id: row.id,
    beanId: row.bean_id,
    grindSize: row.grind_size,
    doseGrams: Number(row.dose_grams),
    yieldGrams: Number(row.yield_grams),
    brewRatio: Number(row.brew_ratio),
    extractionTimeSeconds: row.extraction_time_seconds,
    notes: row.notes ?? undefined,
    nextAdjustment: row.next_adjustment ?? undefined,
    rating: row.rating as ShotLog["rating"],
    createdAt: row.created_at,
  };
}

export const supabaseBackend: KoffieStorage = {
  async listBeans() {
    const { data, error } = await getSupabase()
      .from("beans")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as BeanRow[]).map(beanFromRow);
  },
  async addBean(input) {
    const { data, error } = await getSupabase()
      .from("beans")
      .insert({
        name: input.name,
        roaster: input.roaster ?? null,
        origin: input.origin ?? null,
        roast_date: input.roastDate ?? null,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return beanFromRow(data as BeanRow);
  },
  async getBean(id) {
    const { data, error } = await getSupabase()
      .from("beans")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? beanFromRow(data as BeanRow) : undefined;
  },
  async listShots() {
    const { data, error } = await getSupabase()
      .from("shots")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as ShotRow[]).map(shotFromRow);
  },
  async addShot(input) {
    const brewRatio = calcBrewRatio(input.yieldGrams, input.doseGrams);
    const { data, error } = await getSupabase()
      .from("shots")
      .insert({
        bean_id: input.beanId,
        grind_size: input.grindSize,
        dose_grams: input.doseGrams,
        yield_grams: input.yieldGrams,
        brew_ratio: brewRatio,
        extraction_time_seconds: input.extractionTimeSeconds,
        notes: input.notes ?? null,
        next_adjustment: input.nextAdjustment ?? null,
        rating: input.rating,
      })
      .select("*")
      .single();
    if (error) throw error;
    return shotFromRow(data as ShotRow);
  },
  async shotsForBean(beanId) {
    const { data, error } = await getSupabase()
      .from("shots")
      .select("*")
      .eq("bean_id", beanId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as ShotRow[]).map(shotFromRow);
  },
};

export const storage: KoffieStorage = isSupabaseConfigured
  ? supabaseBackend
  : localStorageBackend;
