import type { Bean, ShotLog } from "./types";
import { average } from "./utils";

export type TipKind = "tweak" | "info" | "praise" | "warn";

export type Tip = {
  id: string;
  kind: TipKind;
  text: string;
};

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
 */
export function tipsForBean(bean: Bean, shots: ShotLog[]): Tip[] {
  const tips: Tip[] = [];

  if (shots.length === 0) {
    tips.push({
      id: "first",
      kind: "info",
      text: `Nog geen shots voor ${bean.name}. Start met 18 g in, 36 g uit, ~28s. Eén variabele tegelijk aanpassen.`,
    });
    return tips;
  }

  const recent = shots.slice(0, 3);
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

  const sortedByRating = [...shots].sort(
    (a, b) =>
      b.rating - a.rating || +new Date(b.createdAt) - +new Date(a.createdAt),
  );
  const top = sortedByRating[0];
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

  if (shots.length === 1) {
    tips.unshift({
      id: "baseline",
      kind: "info",
      text: `Eerste shot vastgelegd. Verander één variabele tegelijk om effect te isoleren.`,
    });
  }

  if (shots.length >= 2) {
    const previous = shots[1];
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
  const last = shots[0];

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

  const recent10 = shots.slice(0, 10);
  const older10 = shots.slice(10, 20);
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
    const beanWithMostShots = topBean(beans, shots);
    if (beanWithMostShots) {
      const beanShots = shots.filter((s) => s.beanId === beanWithMostShots.id);
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
