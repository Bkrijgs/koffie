export type Bean = {
  id: string;
  name: string;
  roaster?: string;
  origin?: string;
  roastDate?: string;
  notes?: string;
  createdAt: string;
};

export type Rating =
  | 0.5
  | 1
  | 1.5
  | 2
  | 2.5
  | 3
  | 3.5
  | 4
  | 4.5
  | 5;

export type ShotLog = {
  id: string;
  beanId: string;
  createdAt: string;
  grindSize: string;
  doseGrams: number;
  yieldGrams: number;
  brewRatio: number;
  extractionTimeSeconds: number;
  notes?: string;
  nextAdjustment?: string;
  rating: Rating;
};

export type BeanInput = Omit<Bean, "id" | "createdAt">;
export type ShotInput = Omit<ShotLog, "id" | "createdAt" | "brewRatio">;
