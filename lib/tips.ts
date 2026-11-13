import type { Bean, ShotLog } from "./types";
import {
  average,
  costPerShot,
  costPerStar,
  effectiveShots,
  formatEuro,
  isSameMonth,
  pricePerKg,
  shotsCost,
} from "./utils";
import type { BaristaMood } from "@/components/Barista";

export type TipKind = "tweak" | "info" | "praise" | "warn";

export type Tip = {
  id: string;
  kind: TipKind;
  text: string;
};

const WAVE_TIP_IDS = new Set(["no-beans", "no-shots", "first", "baseline"]);
const CELEBRATE_TIP_IDS = new Set([
  "streak",
  "shot-best",
  "milestone-shots",
  "milestone-bean",
]);
const SHRUG_TIP_IDS = new Set(["trending-down", "shot-worst"]);

/**
 * Pick a barista mood for a list of tips. Priority:
 *   wave (onboarding) → celebrate (special praise) → shrug (special warn) →
 *   happy (other praise) → concerned (other warn) → think (tweak) →
 *   taste/content (otherwise, alternating per day).
 */
export function moodForTips(tips: Tip[]): BaristaMood {
  if (tips.length === 0) return "content";
  if (tips.some((t) => WAVE_TIP_IDS.has(t.id))) return "wave";
  if (tips.some((t) => CELEBRATE_TIP_IDS.has(t.id))) return "celebrate";
  if (tips.some((t) => SHRUG_TIP_IDS.has(t.id))) return "shrug";
  if (tips.some((t) => t.kind === "praise")) return "happy";
  if (tips.some((t) => t.kind === "warn")) return "concerned";
  if (tips.some((t) => t.kind === "tweak")) return "think";
  // Idle/info-only state — alternate between content and taste per day so
  // the barista isn't doing the exact same thing every visit.
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return day % 2 === 0 ? "content" : "taste";
}

const TIME_MIN = 25;
const TIME_MAX = 32;
const RATIO_MIN = 1.6;
const RATIO_MAX = 2.6;
const FRESH_MIN_DAYS = 5;
const FRESH_MAX_DAYS = 35;

function daysBetween(iso: string, now = Date.now()): number {
  return Math.floor((now - +new Date(iso)) / (1000 * 60 * 60 * 24));
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export type SweetSpot = {
  timeLow: number;
  timeHigh: number;
  ratioLow: number;
  ratioHigh: number;
  /** Range observed in this bean's own ≥4★ shots. */
  obsTimeLow: number;
  obsTimeHigh: number;
  learned: boolean;
};

/**
 * Leert de optimale tijd- en ratio-range van een boon uit z'n eigen
 * hoog-beoordeelde shots (≥4★). Bij te weinig data valt het terug op de
 * algemene espresso-vuistregels, zodat advies altijd iets oplevert.
 */
export function beanSweetSpot(effective: ShotLog[]): SweetSpot {
  const good = effective.filter((s) => s.rating >= 4);
  if (good.length < 3) {
    return {
      timeLow: TIME_MIN,
      timeHigh: TIME_MAX,
      ratioLow: RATIO_MIN,
      ratioHigh: RATIO_MAX,
      obsTimeLow: TIME_MIN,
      obsTimeHigh: TIME_MAX,
      learned: false,
    };
  }
  const times = good.map((s) => s.extractionTimeSeconds);
  const ratios = good.map((s) => s.brewRatio);
  const obsTimeLow = Math.min(...times);
  const obsTimeHigh = Math.max(...times);
  return {
    timeLow: obsTimeLow - 2,
    timeHigh: obsTimeHigh + 2,
    ratioLow: Math.min(...ratios) - 0.15,
    ratioHigh: Math.max(...ratios) + 0.15,
    obsTimeLow,
    obsTimeHigh,
    learned: true,
  };
}

type TodBucket = "ochtend" | "middag" | "avond";

function hourBucket(iso: string): TodBucket {
  const h = new Date(iso).getHours();
  if (h >= 5 && h < 12) return "ochtend";
  if (h >= 12 && h < 17) return "middag";
  return "avond";
}

function bestTodPattern(
  shots: ShotLog[],
): { best: TodBucket; other: TodBucket; bestAvg: number; otherAvg: number } | null {
  const buckets: Record<TodBucket, number[]> = {
    ochtend: [],
    middag: [],
    avond: [],
  };
  for (const s of shots) buckets[hourBucket(s.createdAt)].push(s.rating);
  const entries = (Object.entries(buckets) as [TodBucket, number[]][]).filter(
    ([, arr]) => arr.length >= 3,
  );
  if (entries.length < 2) return null;
  const stats = entries.map(([k, arr]) => ({ k, avg: average(arr) }));
  stats.sort((a, b) => b.avg - a.avg);
  const top = stats[0];
  const bottom = stats[stats.length - 1];
  if (top.avg - bottom.avg < 0.5) return null;
  return {
    best: top.k,
    other: bottom.k,
    bestAvg: top.avg,
    otherAvg: bottom.avg,
  };
}

function tagAggregates(
  shots: ShotLog[],
): { tag: string; avg: number; count: number }[] {
  const map = new Map<string, number[]>();
  for (const s of shots) {
    if (!s.tags) continue;
    for (const t of s.tags) {
      const arr = map.get(t) ?? [];
      arr.push(s.rating);
      map.set(t, arr);
    }
  }
  return Array.from(map.entries())
    .filter(([, arr]) => arr.length >= 3)
    .map(([tag, arr]) => ({ tag, avg: average(arr), count: arr.length }));
}

/**
 * Bean-specific tips. Input shots are expected newest-first.
 *
 * Stats and threshold checks run on `effective` (non-dial-in) shots so a
 * dial-in shot never skews the bean's profile, but the onboarding
 * "first" tip still fires on the original list — a brand-new bean with
 * only dial-in shots still counts as "no real shots yet".
 */
export function tipsForBean(bean: Bean, shots: ShotLog[]): Tip[] {
  const tips: Tip[] = [];
  const effective = effectiveShots(shots);

  if (effective.length === 0) {
    tips.push({
      id: "first",
      kind: "info",
      text: `Nog geen shots voor ${bean.name}. Start met 18 g in, 36 g uit, ~28s. Eén variabele tegelijk aanpassen.`,
    });
    return tips;
  }

  const recent = effective.slice(0, 3);
  const last = recent[0];

  // Vergelijk de recente shots tegen de optimale range van DEZE boon
  // (geleerd uit z'n eigen topshots), niet tegen vaste vuistregels.
  const spot = beanSweetSpot(effective);
  const obsRange = `${Math.round(spot.obsTimeLow)}–${Math.round(spot.obsTimeHigh)}s`;

  const recentTimeAvg = average(recent.map((s) => s.extractionTimeSeconds));
  if (recentTimeAvg && recentTimeAvg < spot.timeLow) {
    const hard = recentTimeAvg < spot.timeLow - 6;
    tips.push({
      id: "time-fast",
      kind: "tweak",
      text: spot.learned
        ? `Recent ~${Math.round(recentTimeAvg)}s; je topshots voor deze boon zitten op ${obsRange}. ${hard ? "Flink" : "Een tikje"} fijner malen.`
        : `Laatste shots lopen door in ~${Math.round(recentTimeAvg)}s. ${hard ? "Flink fijner malen." : "Een tikje fijner malen."}`,
    });
  } else if (recentTimeAvg && recentTimeAvg > spot.timeHigh) {
    const hard = recentTimeAvg > spot.timeHigh + 8;
    tips.push({
      id: "time-slow",
      kind: "tweak",
      text: spot.learned
        ? `Recent ~${Math.round(recentTimeAvg)}s; je topshots voor deze boon zitten op ${obsRange}. ${hard ? "Flink" : "Een tikje"} grover malen.`
        : `Doorlooptijd ~${Math.round(recentTimeAvg)}s. ${hard ? "Flink grover malen." : "Een tikje grover malen."}`,
    });
  }

  const ratioAvg = average(recent.map((s) => s.brewRatio));
  if (ratioAvg && ratioAvg < spot.ratioLow) {
    tips.push({
      id: "ratio-low",
      kind: "tweak",
      text: spot.learned
        ? `Brew ratio gemiddeld 1:${ratioAvg.toFixed(2)} — korter dan je topshots voor deze boon. Laat 'm langer doorlopen.`
        : `Brew ratio gemiddeld 1:${ratioAvg.toFixed(2)} — kort. Probeer langer door te laten lopen voor meer extractie.`,
    });
  } else if (ratioAvg && ratioAvg > spot.ratioHigh) {
    tips.push({
      id: "ratio-high",
      kind: "tweak",
      text: spot.learned
        ? `Brew ratio gemiddeld 1:${ratioAvg.toFixed(2)} — langer dan je topshots voor deze boon. Stop eerder voor meer body.`
        : `Brew ratio gemiddeld 1:${ratioAvg.toFixed(2)} — lang. Stop eerder voor meer body.`,
    });
  }

  const sortedByRating = [...effective].sort(
    (a, b) =>
      b.rating - a.rating || +new Date(b.createdAt) - +new Date(a.createdAt),
  );
  const top = sortedByRating[0];
  if (top) {
    tips.unshift({
      id: "best-shot",
      kind: "info",
      text: `Beste shot tot nu toe (${top.rating}★) — maalgraad ${fmtNum(top.grindSize)}, ${fmtNum(top.doseGrams)} g in / ${fmtNum(top.yieldGrams)} g uit, ${top.extractionTimeSeconds}s.`,
    });
  }
  if (
    top &&
    last &&
    top.id !== last.id &&
    top.rating >= 4 &&
    top.grindSize !== last.grindSize
  ) {
    const delta = last.grindSize - top.grindSize;
    const steps = Math.abs(delta);
    const direction = delta > 0 ? "fijner" : "grover";
    const stepWord = steps === 1 ? "stap" : "stappen";
    tips.push({
      id: "grind-drift",
      kind: "tweak",
      text: `Topshot (${top.rating}★) zat op maalgraad ${fmtNum(top.grindSize)}, je laatste op ${fmtNum(last.grindSize)}. Ga ${fmtNum(steps)} ${stepWord} ${direction} terug.`,
    });
  }

  // Anomalie: de laatste shot wijkt sterk af van de norm van deze boon.
  if (effective.length >= 5 && last) {
    const baseline = effective.filter((s) => s.id !== last.id);
    const medTime = median(baseline.map((s) => s.extractionTimeSeconds));
    const diff = last.extractionTimeSeconds - medTime;
    if (medTime && Math.abs(diff) >= 8) {
      tips.push({
        id: "anomaly-time",
        kind: "warn",
        text: `Je laatste shot liep in ${last.extractionTimeSeconds}s, terwijl deze boon normaal rond ${Math.round(medTime)}s zit. ${
          diff > 0
            ? "Te fijn gemalen of te veel dose?"
            : "Te grof gemalen of te weinig dose?"
        }`,
      });
    }
  }

  if (bean.roastDate) {
    const days = daysBetween(bean.roastDate);
    if (days < FRESH_MIN_DAYS) {
      tips.push({
        id: "too-fresh",
        kind: "info",
        text: `Boon is ${days}d oud. Nog aan het ontgassen — verwacht onstabiele extractie.`,
      });
    } else if (days > FRESH_MAX_DAYS) {
      tips.push({
        id: "too-old",
        kind: "warn",
        text: `Boon is ${days}d oud. Smaak vlakt af.`,
      });
    }
  }

  if (recent.length >= 3 && recent.every((s) => s.rating >= 4)) {
    tips.push({
      id: "streak",
      kind: "praise",
      text: `Drie shots op rij ≥4★. Deze instellingen zitten goed — niets veranderen.`,
    });
  }

  if (effective.length === 1) {
    tips.unshift({
      id: "baseline",
      kind: "info",
      text: `Eerste shot vastgelegd. Verander één variabele tegelijk om effect te isoleren.`,
    });
  }

  if (effective.length >= 2) {
    const previous = effective[1];
    if (
      previous.nextAdjustment &&
      last &&
      last.grindSize === previous.grindSize &&
      last.doseGrams === previous.doseGrams &&
      last.yieldGrams === previous.yieldGrams
    ) {
      tips.push({
        id: "no-followup",
        kind: "tweak",
        text: `Vorige shot zei "${previous.nextAdjustment}", maar de instellingen waren identiek.`,
      });
    }
  }

  if (effective.length >= 6) {
    const tod = bestTodPattern(effective);
    if (tod) {
      tips.push({
        id: "tod-pattern",
        kind: "info",
        text: `${cap(tod.best)} shots scoren gem. ${tod.bestAvg.toFixed(1)}★ vs ${tod.otherAvg.toFixed(1)}★ ${tod.other}.`,
      });
    }

    const beanAvg = average(effective.map((s) => s.rating));
    const aggs = tagAggregates(effective);
    const best = [...aggs]
      .filter((a) => a.avg >= 4 && a.avg - beanAvg >= 0.5)
      .sort((a, b) => b.avg - a.avg)[0];
    if (best) {
      tips.push({
        id: "tag-best",
        kind: "info",
        text: `'${best.tag}' shots scoren gem. ${best.avg.toFixed(1)}★ bij deze boon.`,
      });
    }
    const worst = [...aggs]
      .filter((a) => beanAvg - a.avg >= 0.5)
      .sort((a, b) => a.avg - b.avg)[0];
    if (worst && (!best || worst.tag !== best.tag)) {
      tips.push({
        id: "tag-worst",
        kind: "warn",
        text: `'${worst.tag}' shots blijven steken op ${worst.avg.toFixed(1)}★ — andere extractie proberen?`,
      });
    }
  }

  return dedupe(tips).slice(0, 3);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Cross-bean tips for the dashboard. Shots newest-first.
 */
export function globalTips(beans: Bean[], shots: ShotLog[]): Tip[] {
  if (beans.length === 0) {
    return [
      {
        id: "no-beans",
        kind: "info",
        text: "Voeg eerst een boon toe.",
      },
    ];
  }
  if (shots.length === 0) {
    return [
      {
        id: "no-shots",
        kind: "info",
        text: "Log je eerste shot om data-tips te krijgen.",
      },
    ];
  }

  const tips: Tip[] = [];
  const effective = effectiveShots(shots);
  if (effective.length === 0) {
    // Only dial-in shots so far — treat the dashboard as still onboarding.
    return [
      {
        id: "no-shots",
        kind: "info",
        text: "Log je eerste niet-dial-in shot om data-tips te krijgen.",
      },
    ];
  }
  const last = effective[0];

  const lastBean = beans.find((b) => b.id === last.beanId);
  if (lastBean) {
    const lastBeanShots = shots.filter((s) => s.beanId === lastBean.id);
    const beanTips = tipsForBean(lastBean, lastBeanShots).filter((t) =>
      ["time-fast", "time-slow", "ratio-low", "ratio-high", "grind-drift"].includes(
        t.id,
      ),
    );
    for (const t of beanTips) {
      tips.push({
        ...t,
        id: `${lastBean.id}:${t.id}`,
        text: `${lastBean.name}: ${t.text}`,
      });
    }
  }

  const daysSinceLast = daysBetween(last.createdAt);
  if (daysSinceLast >= 5) {
    tips.push({
      id: "inactive",
      kind: "info",
      text: `Geen shot in ${daysSinceLast} dagen. Een aangebroken zak ontgast verder en loopt daarna vaak sneller door — begin met een tikje fijner malen.`,
    });
  }

  if (effective.length >= 10) {
    const tod = bestTodPattern(effective);
    if (tod) {
      const diff = tod.bestAvg - tod.otherAvg;
      tips.push({
        id: "global-tod",
        kind: "info",
        text: `${cap(tod.best)} shots scoren gem. ${tod.bestAvg.toFixed(1)}★ — ${diff.toFixed(1)}★ hoger dan ${tod.other}.`,
      });
    }
  }

  const recent10 = effective.slice(0, 10);
  const older10 = effective.slice(10, 20);
  if (recent10.length >= 5 && older10.length >= 5) {
    const r = average(recent10.map((s) => s.rating));
    const o = average(older10.map((s) => s.rating));
    const diff = r - o;
    if (diff >= 0.5) {
      tips.push({
        id: "trending-up",
        kind: "praise",
        text: `Laatste 10 shots: ${r.toFixed(1)}★ vs ${o.toFixed(1)}★ daarvoor. Goede curve.`,
      });
    } else if (diff <= -0.5) {
      tips.push({
        id: "trending-down",
        kind: "warn",
        text: `Laatste 10 shots: ${r.toFixed(1)}★, daarvoor ${o.toFixed(1)}★. Wat is veranderd?`,
      });
    }
  }

  const highestRating = Math.max(...effective.map((s) => s.rating));
  if (
    last.rating >= 4.5 &&
    last.rating === highestRating &&
    effective.length >= 2
  ) {
    tips.push({
      id: "top-shot",
      kind: "praise",
      text: `Net je beste shot tot nu toe (${last.rating}★). Onthou deze instellingen goed.`,
    });
  }

  const milestone = [10, 25, 50, 100, 250, 500].find(
    (m) => effective.length === m,
  );
  if (milestone) {
    tips.push({
      id: "milestone-shots",
      kind: "praise",
      text: `${milestone} shots gelogd. Dat is serieus dial-in werk.`,
    });
  }

  if (beans.length === 5) {
    tips.push({
      id: "milestone-bean",
      kind: "praise",
      text: `Vijfde boon op de plank. Je begint een echt archief op te bouwen.`,
    });
  }

  const beansWithShots = new Set(shots.map((s) => s.beanId));
  const unused = beans.filter((b) => !beansWithShots.has(b.id));
  if (unused.length === 1) {
    tips.push({
      id: "unused-bean",
      kind: "info",
      text: `${unused[0].name} heeft nog geen shot. Tijd om te dial-innen.`,
    });
  } else if (unused.length > 1) {
    tips.push({
      id: "unused-beans",
      kind: "info",
      text: `${unused.length} bonen zonder shot. Tijd om te dial-innen.`,
    });
  }

  // Welke boon presteert het best? Handig als default-keuze. Alleen tonen
  // bij meerdere bonen met genoeg data én een duidelijk verschil, anders
  // is het ruis.
  const ranked = beans
    .map((b) => {
      const bs = effective.filter((s) => s.beanId === b.id);
      return { bean: b, n: bs.length, avg: average(bs.map((s) => s.rating)) };
    })
    .filter((x) => x.n >= 3)
    .sort((a, b) => b.avg - a.avg);
  if (
    ranked.length >= 2 &&
    ranked[0].avg - ranked[ranked.length - 1].avg >= 0.5
  ) {
    const winner = ranked[0];
    tips.push({
      id: "best-bean",
      kind: "info",
      text: `${winner.bean.name} scoort het hoogst: gem. ${winner.avg.toFixed(1)}★ over ${winner.n} shots.`,
    });
  }

  // Prijs-bewuste inzichten. Beste waar-voor-je-geld: alleen tonen bij
  // meerdere geprijsde bonen met genoeg data én een duidelijk verschil.
  const valueRanked = beans
    .map((b) => {
      const perKg = pricePerKg(b);
      const bs = effective.filter((s) => s.beanId === b.id);
      if (perKg === undefined || bs.length < 3) return null;
      const starCost = costPerStar(
        average(bs.map((s) => costPerShot(s.doseGrams, perKg))),
        average(bs.map((s) => s.rating)),
      );
      return starCost === undefined ? null : { bean: b, starCost };
    })
    .filter((x): x is { bean: Bean; starCost: number } => x !== null)
    .sort((a, b) => a.starCost - b.starCost);
  if (valueRanked.length >= 2) {
    const best = valueRanked[0];
    const worst = valueRanked[valueRanked.length - 1];
    if (worst.starCost >= best.starCost * 1.5) {
      tips.push({
        id: "best-value",
        kind: "info",
        text: `${best.bean.name} is je beste waar-voor-je-geld: ${formatEuro(best.starCost)} per ster, tegenover ${formatEuro(worst.starCost)} bij ${worst.bean.name}.`,
      });
    }
  }

  const month = shotsCost(
    shots.filter((s) => isSameMonth(s.createdAt, new Date())),
    beans,
  );
  if (month.counted >= 5 && month.cost > 0) {
    tips.push({
      id: "month-cost",
      kind: "info",
      text: `Deze maand ${formatEuro(month.cost)} aan koffie gezet, verdeeld over ${month.counted} shots.`,
    });
  }

  // Nudge: bonen mét shots maar zonder prijsinfo doen niet mee in de
  // kostenvergelijking. Alleen zeuren als er al minstens één geprijsde
  // boon is (anders kent de gebruiker de feature waarschijnlijk nog niet).
  const hasPricedBean = beans.some((b) => pricePerKg(b) !== undefined);
  const unpriced = beans.filter(
    (b) => pricePerKg(b) === undefined && beansWithShots.has(b.id),
  );
  if (hasPricedBean && unpriced.length > 0) {
    tips.push({
      id: "missing-price",
      kind: "info",
      text: `Vul prijs en zakgewicht in bij ${unpriced[0].name} om kosten en waar-voor-je-geld mee te vergelijken.`,
    });
  }

  if (tips.length === 0) {
    const beanWithMostShots = topBean(beans, effective);
    if (beanWithMostShots) {
      const beanShots = effective.filter(
        (s) => s.beanId === beanWithMostShots.id,
      );
      // Pas een oordeel vellen bij genoeg shots, en het oordeel laten
      // afhangen van de échte gemiddelde rating i.p.v. altijd "lekker".
      if (beanShots.length >= 3) {
        const avg = average(beanShots.map((s) => s.rating));
        const n = beanShots.length;
        if (avg >= 4) {
          tips.push({
            id: "active-bean",
            kind: "praise",
            text: `${beanWithMostShots.name} draait lekker: gem. ${avg.toFixed(1)}★ over ${n} shots. Hou de instellingen vast.`,
          });
        } else if (avg >= 3) {
          tips.push({
            id: "active-bean",
            kind: "info",
            text: `${beanWithMostShots.name} zit op gem. ${avg.toFixed(1)}★ over ${n} shots. Nog ruimte — varieer maalgraad of tijd in kleine stappen.`,
          });
        } else {
          tips.push({
            id: "active-bean",
            kind: "tweak",
            text: `${beanWithMostShots.name} blijft steken op gem. ${avg.toFixed(1)}★ over ${n} shots. Probeer een duidelijk andere maalgraad om uit de groef te komen.`,
          });
        }
      }
    }
  }

  return tips.slice(0, 3);
}

/**
 * Tips for a single shot, used on the edit page so the barista can
 * comment on this specific log entry.
 */
export function tipsForShot(
  shot: ShotLog,
  bean: Bean | undefined,
  beanShots: ShotLog[],
): Tip[] {
  const tips: Tip[] = [];

  if (shot.extractionTimeSeconds < TIME_MIN) {
    tips.push({
      id: "shot-time-fast",
      kind: "tweak",
      text: `${shot.extractionTimeSeconds}s is aan de snelle kant. Volgende keer iets fijner malen of een tikje meer dose.`,
    });
  } else if (shot.extractionTimeSeconds > TIME_MAX) {
    tips.push({
      id: "shot-time-slow",
      kind: "tweak",
      text: `${shot.extractionTimeSeconds}s loopt door — probeer iets grover voor een betere balans.`,
    });
  } else if (shot.rating >= 4) {
    tips.push({
      id: "shot-time-sweet",
      kind: "praise",
      text: `${shot.extractionTimeSeconds}s + ${shot.rating}★ — sweet spot. Hou deze instellingen vast.`,
    });
  }

  if (shot.brewRatio && shot.brewRatio < RATIO_MIN) {
    tips.push({
      id: "shot-ratio-low",
      kind: "tweak",
      text: `Ratio 1:${shot.brewRatio.toFixed(2)} is een ristretto-style. Voor meer zoet en body even langer door laten lopen.`,
    });
  } else if (shot.brewRatio && shot.brewRatio > RATIO_MAX) {
    tips.push({
      id: "shot-ratio-high",
      kind: "tweak",
      text: `Ratio 1:${shot.brewRatio.toFixed(2)} is lungo-territorium. Eerder afkappen voor minder bitter.`,
    });
  }

  const effectiveBeanShots = effectiveShots(beanShots);
  if (bean && effectiveBeanShots.length >= 3) {
    const others = effectiveBeanShots.filter((s) => s.id !== shot.id);
    // Zonder eigen rating (concept) valt er niets te vergelijken.
    if (others.length > 0 && !shot.dialIn && shot.rating > 0) {
      const avg = average(others.map((s) => s.rating));
      if (shot.rating - avg >= 1) {
        tips.push({
          id: "shot-best",
          kind: "praise",
          text: `${shot.rating}★ vs ${avg.toFixed(1)}★ gemiddeld voor ${bean.name}. Eén van je beste — onthou deze instellingen.`,
        });
      } else if (avg - shot.rating >= 1) {
        tips.push({
          id: "shot-worst",
          kind: "warn",
          text: `${shot.rating}★ vs ${avg.toFixed(1)}★ gemiddeld. Wat ging er anders? Maalgraad of dose terug?`,
        });
      }
    }

    const topShot = [...effectiveBeanShots].sort(
      (a, b) => b.rating - a.rating,
    )[0];
    if (
      topShot &&
      topShot.id !== shot.id &&
      topShot.rating >= 4 &&
      topShot.grindSize !== shot.grindSize
    ) {
      const delta = shot.grindSize - topShot.grindSize;
      const steps = Math.abs(delta);
      const stepWord = steps === 1 ? "stap" : "stappen";
      const rel = delta > 0 ? "grover" : "fijner";
      tips.push({
        id: "shot-grind-vs-best",
        kind: "info",
        text: `Beste shot voor ${bean.name} (${topShot.rating}★) zat op maalgraad ${fmtNum(topShot.grindSize)}; deze stond ${fmtNum(steps)} ${stepWord} ${rel} (${fmtNum(shot.grindSize)}).`,
      });
    }
  }

  if (bean?.roastDate) {
    const days = Math.floor(
      (+new Date(shot.createdAt) - +new Date(bean.roastDate)) /
        (1000 * 60 * 60 * 24),
    );
    if (days >= 0 && days < FRESH_MIN_DAYS) {
      tips.push({
        id: "shot-too-fresh",
        kind: "info",
        text: `Boon was ${days}d oud — nog aan het ontgassen. Verklaart eventuele onrust.`,
      });
    } else if (days > FRESH_MAX_DAYS) {
      tips.push({
        id: "shot-too-old",
        kind: "warn",
        text: `Boon was ${days}d oud bij deze shot. Smaak vlakt af na ~5 weken.`,
      });
    }
  }

  if (tips.length === 0) {
    tips.push({
      id: "shot-neutral",
      kind: "info",
      text: `Tijd, ratio en rating zien er stabiel uit. Niets om aan te passen.`,
    });
  }

  return dedupe(tips).slice(0, 3);
}

function dedupe(tips: Tip[]): Tip[] {
  const seen = new Set<string>();
  return tips.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

function topBean(beans: Bean[], shots: ShotLog[]): Bean | undefined {
  const counts = new Map<string, number>();
  for (const s of shots) counts.set(s.beanId, (counts.get(s.beanId) ?? 0) + 1);
  let bestId: string | undefined;
  let bestCount = -1;
  for (const [id, c] of counts) {
    if (c > bestCount) {
      bestCount = c;
      bestId = id;
    }
  }
  return bestId ? beans.find((b) => b.id === bestId) : undefined;
}
