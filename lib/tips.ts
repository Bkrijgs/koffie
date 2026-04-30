import type { Bean, ShotLog } from "./types";
import { average, effectiveShots } from "./utils";
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

  const recentTimeAvg = average(recent.map((s) => s.extractionTimeSeconds));
  if (recentTimeAvg && recentTimeAvg < TIME_MIN) {
    tips.push({
      id: "time-fast",
      kind: "tweak",
      text: `Laatste shots lopen door in ~${Math.round(recentTimeAvg)}s. ${
        recentTimeAvg < 20 ? "Flink fijner malen." : "Een tikje fijner malen."
      }`,
    });
  } else if (recentTimeAvg && recentTimeAvg > TIME_MAX) {
    tips.push({
      id: "time-slow",
      kind: "tweak",
      text: `Doorlooptijd ~${Math.round(recentTimeAvg)}s. ${
        recentTimeAvg > 40 ? "Flink grover malen." : "Een tikje grover malen."
      }`,
    });
  }

  const ratioAvg = average(recent.map((s) => s.brewRatio));
  if (ratioAvg && ratioAvg < RATIO_MIN) {
    tips.push({
      id: "ratio-low",
      kind: "tweak",
      text: `Brew ratio gemiddeld 1:${ratioAvg.toFixed(2)} — kort. Probeer langer door te laten lopen voor meer extractie.`,
    });
  } else if (ratioAvg && ratioAvg > RATIO_MAX) {
    tips.push({
      id: "ratio-high",
      kind: "tweak",
      text: `Brew ratio gemiddeld 1:${ratioAvg.toFixed(2)} — lang. Stop eerder voor meer body.`,
    });
  }

  const sortedByRating = [...effective].sort(
    (a, b) =>
      b.rating - a.rating || +new Date(b.createdAt) - +new Date(a.createdAt),
  );
  const top = sortedByRating[0];
  if (top) {
    const fmt = (n: number) =>
      Number.isInteger(n) ? String(n) : n.toFixed(1);
    tips.unshift({
      id: "best-shot",
      kind: "info",
      text: `Beste shot tot nu toe (${top.rating}★) — maalgraad ${top.grindSize}, ${fmt(top.doseGrams)} g in / ${fmt(top.yieldGrams)} g uit, ${top.extractionTimeSeconds}s.`,
    });
  }
  if (
    top &&
    last &&
    top.id !== last.id &&
    top.rating >= 4 &&
    top.grindSize !== last.grindSize
  ) {
    tips.push({
      id: "grind-drift",
      kind: "tweak",
      text: `Top shot (${top.rating}★) had maalgraad ${top.grindSize}, laatste was ${last.grindSize}. Terug richting ${top.grindSize}.`,
    });
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

  return dedupe(tips).slice(0, 3);
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
      text: `Geen shot in ${daysSinceLast} dagen. Bonen hebben mogelijk een fijnere maling nodig.`,
    });
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

  if (tips.length === 0) {
    const beanWithMostShots = topBean(beans, effective);
    if (beanWithMostShots) {
      const beanShots = effective.filter(
        (s) => s.beanId === beanWithMostShots.id,
      );
      const avg = average(beanShots.map((s) => s.rating));
      tips.push({
        id: "active-bean",
        kind: "info",
        text: `${beanWithMostShots.name} draait lekker (${avg.toFixed(1)}★ over ${beanShots.length}). Hou de instellingen vast.`,
      });
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
    if (others.length > 0 && !shot.dialIn) {
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
      tips.push({
        id: "shot-grind-vs-best",
        kind: "info",
        text: `Beste shot voor ${bean.name} (${topShot.rating}★) had maalgraad ${topShot.grindSize}, deze ${shot.grindSize}.`,
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
