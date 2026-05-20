import { getSupabase, isSupabaseConfigured } from "./supabase";
import type {
  Bag,
  BagInput,
  Bean,
  BeanInput,
  Setup,
  ShotInput,
  ShotLog,
} from "./types";
import { calcBrewRatio, uid } from "./utils";
import { sanitizeTags } from "./tags";
import { DEFAULT_SETUP } from "./setup";

/**
 * Storage abstraction. The app uses Supabase when configured, and falls back
 * to localStorage so the MVP keeps working without env vars (e.g. in preview
 * builds before Supabase is wired up).
 */
export interface KoffieStorage {
  listBeans(): Promise<Bean[]>;
  addBean(input: BeanInput): Promise<Bean>;
  updateBean(id: string, input: BeanInput): Promise<Bean>;
  getBean(id: string): Promise<Bean | undefined>;

  listShots(): Promise<ShotLog[]>;
  addShot(input: ShotInput): Promise<ShotLog>;
  updateShot(id: string, input: ShotInput): Promise<ShotLog>;
  shotsForBean(beanId: string): Promise<ShotLog[]>;

  listBags(): Promise<Bag[]>;
  addBag(input: BagInput): Promise<Bag>;
  updateBag(id: string, input: BagInput): Promise<Bag>;

  getSetup(): Promise<Setup>;
  saveSetup(setup: Setup): Promise<Setup>;
}

const BEANS_KEY = "koffie:beans:v1";
const SHOTS_KEY = "koffie:shots:v1";
const BAGS_KEY = "koffie:bags:v1";
const SETUP_KEY = "koffie:setup:v1";

/** Oudere shots hadden grindSize als string. Bij het lezen normaliseren we
 *  naar een getal zodat de rest van de app er consistent mee kan rekenen. */
function normalizeShot(s: ShotLog): ShotLog {
  if (typeof s.grindSize === "number") return s;
  const parsed = parseFloat(String(s.grindSize));
  return { ...s, grindSize: Number.isFinite(parsed) ? parsed : 5 };
}

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
  async updateBean(id, input) {
    const all = read<Bean>(BEANS_KEY);
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1) throw new Error("Boon niet gevonden");
    const updated: Bean = { ...all[idx], ...input };
    all[idx] = updated;
    write(BEANS_KEY, all);
    return updated;
  },
  async getBean(id) {
    return read<Bean>(BEANS_KEY).find((b) => b.id === id);
  },
  async listShots() {
    return read<ShotLog>(SHOTS_KEY)
      .map(normalizeShot)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },
  async addShot(input) {
    const tags = sanitizeTags(input.tags);
    const shot: ShotLog = {
      id: uid(),
      createdAt: new Date().toISOString(),
      brewRatio: calcBrewRatio(input.yieldGrams, input.doseGrams),
      ...input,
      dialIn: input.dialIn ?? false,
      tags: tags.length > 0 ? tags : undefined,
    };
    const all = read<ShotLog>(SHOTS_KEY);
    all.push(shot);
    write(SHOTS_KEY, all);
    return shot;
  },
  async updateShot(id, input) {
    const all = read<ShotLog>(SHOTS_KEY);
    const idx = all.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("Shot niet gevonden");
    const tags = sanitizeTags(input.tags);
    const updated: ShotLog = {
      ...all[idx],
      ...input,
      brewRatio: calcBrewRatio(input.yieldGrams, input.doseGrams),
      dialIn: input.dialIn ?? false,
      tags: tags.length > 0 ? tags : undefined,
    };
    all[idx] = updated;
    write(SHOTS_KEY, all);
    return updated;
  },
  async shotsForBean(beanId) {
    return read<ShotLog>(SHOTS_KEY)
      .map(normalizeShot)
      .filter((s) => s.beanId === beanId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },
  async listBags() {
    return read<Bag>(BAGS_KEY).sort(
      (a, b) => +new Date(b.openedAt) - +new Date(a.openedAt),
    );
  },
  async addBag(input) {
    const bag: Bag = {
      id: uid(),
      createdAt: new Date().toISOString(),
      ...input,
    };
    const all = read<Bag>(BAGS_KEY);
    all.push(bag);
    write(BAGS_KEY, all);
    return bag;
  },
  async updateBag(id, input) {
    const all = read<Bag>(BAGS_KEY);
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1) throw new Error("Zak niet gevonden");
    const updated: Bag = { ...all[idx], ...input };
    all[idx] = updated;
    write(BAGS_KEY, all);
    return updated;
  },
  async getSetup() {
    if (typeof window === "undefined") return DEFAULT_SETUP;
    try {
      const raw = window.localStorage.getItem(SETUP_KEY);
      if (!raw) return DEFAULT_SETUP;
      return { ...DEFAULT_SETUP, ...(JSON.parse(raw) as Partial<Setup>) };
    } catch {
      return DEFAULT_SETUP;
    }
  },
  async saveSetup(setup) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
    }
    return setup;
  },
};

type BeanRow = {
  id: string;
  name: string;
  roaster: string | null;
  origin: string | null;
  blend: string | null;
  roast_date: string | null;
  notes: string | null;
  created_at: string;
};

type ShotRow = {
  id: string;
  bean_id: string;
  grind_size: number | string;
  dose_grams: number;
  yield_grams: number;
  brew_ratio: number;
  extraction_time_seconds: number;
  notes: string | null;
  next_adjustment: string | null;
  rating: number;
  dial_in: boolean | null;
  tags: string[] | null;
  created_at: string;
};

function beanFromRow(row: BeanRow): Bean {
  return {
    id: row.id,
    name: row.name,
    roaster: row.roaster ?? undefined,
    origin: row.origin ?? undefined,
    blend: row.blend ?? undefined,
    roastDate: row.roast_date ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

type BagRow = {
  id: string;
  bean_id: string;
  grams: number;
  opened_at: string;
  finished_at: string | null;
  notes: string | null;
  created_at: string;
};

function bagFromRow(row: BagRow): Bag {
  return {
    id: row.id,
    beanId: row.bean_id,
    grams: Number(row.grams),
    openedAt: row.opened_at,
    finishedAt: row.finished_at ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

function shotFromRow(row: ShotRow): ShotLog {
  const tags = sanitizeTags(row.tags);
  return {
    id: row.id,
    beanId: row.bean_id,
    grindSize: Number(row.grind_size),
    doseGrams: Number(row.dose_grams),
    yieldGrams: Number(row.yield_grams),
    brewRatio: Number(row.brew_ratio),
    extractionTimeSeconds: row.extraction_time_seconds,
    notes: row.notes ?? undefined,
    nextAdjustment: row.next_adjustment ?? undefined,
    rating: Number(row.rating) as ShotLog["rating"],
    dialIn: row.dial_in ?? false,
    tags: tags.length > 0 ? tags : undefined,
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
        blend: input.blend ?? null,
        roast_date: input.roastDate ?? null,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return beanFromRow(data as BeanRow);
  },
  async updateBean(id, input) {
    const { data, error } = await getSupabase()
      .from("beans")
      .update({
        name: input.name,
        roaster: input.roaster ?? null,
        origin: input.origin ?? null,
        blend: input.blend ?? null,
        roast_date: input.roastDate ?? null,
        notes: input.notes ?? null,
      })
      .eq("id", id)
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
        dial_in: input.dialIn ?? false,
        tags: sanitizeTags(input.tags),
      })
      .select("*")
      .single();
    if (error) throw error;
    return shotFromRow(data as ShotRow);
  },
  async updateShot(id, input) {
    const brewRatio = calcBrewRatio(input.yieldGrams, input.doseGrams);
    const { data, error } = await getSupabase()
      .from("shots")
      .update({
        bean_id: input.beanId,
        grind_size: input.grindSize,
        dose_grams: input.doseGrams,
        yield_grams: input.yieldGrams,
        brew_ratio: brewRatio,
        extraction_time_seconds: input.extractionTimeSeconds,
        notes: input.notes ?? null,
        next_adjustment: input.nextAdjustment ?? null,
        rating: input.rating,
        dial_in: input.dialIn ?? false,
        tags: sanitizeTags(input.tags),
      })
      .eq("id", id)
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
  async listBags() {
    const { data, error } = await getSupabase()
      .from("bags")
      .select("*")
      .order("opened_at", { ascending: false });
    if (error) throw error;
    return (data as BagRow[]).map(bagFromRow);
  },
  async addBag(input) {
    const { data, error } = await getSupabase()
      .from("bags")
      .insert({
        bean_id: input.beanId,
        grams: input.grams,
        opened_at: input.openedAt,
        finished_at: input.finishedAt ?? null,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return bagFromRow(data as BagRow);
  },
  async updateBag(id, input) {
    const { data, error } = await getSupabase()
      .from("bags")
      .update({
        bean_id: input.beanId,
        grams: input.grams,
        opened_at: input.openedAt,
        finished_at: input.finishedAt ?? null,
        notes: input.notes ?? null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return bagFromRow(data as BagRow);
  },
  async getSetup() {
    const { data, error } = await getSupabase()
      .from("setup")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return data ? setupFromRow(data as SetupRow) : DEFAULT_SETUP;
  },
  async saveSetup(setup) {
    const { data, error } = await getSupabase()
      .from("setup")
      .upsert({
        id: 1,
        machine: setup.machine,
        grinder: setup.grinder,
        grind_min: setup.grindMin,
        grind_max: setup.grindMax,
        grind_step: setup.grindStep,
        default_basket: setup.defaultBasket,
        pressurized: setup.pressurized,
        pressure_gauge: setup.pressureGauge,
        pre_infusion: setup.preInfusion,
        pid: setup.pid,
        weighs: setup.weighs,
        notes: setup.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return setupFromRow(data as SetupRow);
  },
};

type SetupRow = {
  id: number;
  machine: string;
  grinder: string;
  grind_min: number;
  grind_max: number;
  grind_step: number;
  default_basket: string;
  pressurized: boolean;
  pressure_gauge: boolean;
  pre_infusion: boolean;
  pid: boolean;
  weighs: boolean;
  notes: string | null;
  updated_at: string;
};

function setupFromRow(row: SetupRow): Setup {
  return {
    machine: row.machine,
    grinder: row.grinder,
    grindMin: Number(row.grind_min),
    grindMax: Number(row.grind_max),
    grindStep: Number(row.grind_step),
    defaultBasket: row.default_basket === "single" ? "single" : "double",
    pressurized: row.pressurized,
    pressureGauge: row.pressure_gauge,
    preInfusion: row.pre_infusion,
    pid: row.pid,
    weighs: row.weighs,
    notes: row.notes ?? undefined,
  };
}

export const storage: KoffieStorage = isSupabaseConfigured
  ? supabaseBackend
  : localStorageBackend;
