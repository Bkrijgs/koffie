export type Bean = {
  id: string;
  name: string;
  roaster?: string;
  origin?: string;
  blend?: string;
  roastDate?: string;
  /** Prijs voor één zak, in euro's. Bij een cadeau (gift) is dit de
   *  geschatte winkelprijs, zodat waardevergelijkingen blijven werken. */
  priceEuros?: number;
  /** Gewicht van die zak in gram; samen met priceEuros geeft dit €/kg. */
  bagWeightGrams?: number;
  /** Cadeau gekregen: telt niet mee in je uitgaven (kostendashboard),
   *  maar wél in waarde-statistieken via de geschatte winkelprijs. */
  gift?: boolean;
  /** AI-schatting: mg cafeïne per gram gemalen koffie die bij espresso-
   *  extractie in het kopje belandt. Per shot: dose × deze waarde. */
  caffeineMgPerGram?: number;
  notes?: string;
  /** Of er nog voorraad van deze boon is. Staat-ie uit, dan verdwijnt de boon
   *  uit het keuze-menu van het shot-logformulier. Default true. */
  inStock: boolean;
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
  grindSize: number;
  doseGrams: number;
  yieldGrams: number;
  brewRatio: number;
  extractionTimeSeconds: number;
  notes?: string;
  nextAdjustment?: string;
  /** 0 alleen toegestaan voor dial-in shots zonder rating. */
  rating: Rating | 0;
  dialIn: boolean;
  tags?: string[];
};

/** Apparatuur-setup. Eén record per installatie; voedt de coffee-AI met
 *  machine-specifieke context (maler-schaal, basket, drukmeter, ...). */
export type Setup = {
  machine: string;
  grinder: string;
  grindMin: number;
  grindMax: number;
  grindStep: number;
  defaultBasket: "single" | "double";
  pressurized: boolean;
  pressureGauge: boolean;
  preInfusion: boolean;
  pid: boolean;
  weighs: boolean;
  notes?: string;
};

export type Bag = {
  id: string;
  beanId: string;
  grams: number;
  openedAt: string;
  finishedAt?: string;
  notes?: string;
  createdAt: string;
};

export type BeanInput = Omit<Bean, "id" | "createdAt">;
export type ShotInput = Omit<ShotLog, "id" | "createdAt" | "brewRatio">;
export type BagInput = Omit<Bag, "id" | "createdAt">;
