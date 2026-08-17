import { supabaseBackend } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase";
import { effectiveShots, formatDateOnly } from "@/lib/utils";
import { esc, htmlPage } from "@/lib/koboHtml";
import type { Bean, ShotLog } from "@/lib/types";

// JS-loze overzichtspagina voor de Kobo. Wordt als kale HTML geserveerd zodat
// de trage e-reader-browser niets hoeft te parsen of uit te voeren.
export const dynamic = "force-dynamic";

function ratio(yieldGrams: number, doseGrams: number): string {
  if (!doseGrams) return "—";
  return "1:" + (yieldGrams / doseGrams).toFixed(2);
}

function ratingLabel(r: number): string {
  return r ? "★ " + r.toFixed(1) : "—";
}

function chip(label: string, value: string): string {
  return `<span class="chip"><span class="muted">${esc(label)} </span><b>${esc(value)}</b></span>`;
}

export async function GET() {
  const header = `<div class="top"><h1>Koffie</h1><a class="btn" href="/kobo/new">+ Shot loggen</a></div>`;

  if (!isSupabaseConfigured) {
    return htmlPage(
      "Koffie · Kobo",
      header +
        `<section><p class="err">Supabase is niet geconfigureerd op de server.</p></section>`,
    );
  }

  let beans: Bean[] = [];
  let shots: ShotLog[] = [];
  let error: string | null = null;
  try {
    [beans, shots] = await Promise.all([
      supabaseBackend.listBeans(),
      supabaseBackend.listShots(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const errorHtml = error
    ? `<section><p class="err"><b>Data kon niet geladen worden</b><br>${esc(error)}</p></section>`
    : "";

  // Spiekbriefje: per boon de best beoordeelde (niet-dial-in) shot.
  const recipes = beans
    .map((bean) => {
      const beanShots = effectiveShots(shots.filter((s) => s.beanId === bean.id));
      if (beanShots.length === 0) return null;
      const best = [...beanShots].sort(
        (a, b) =>
          b.rating - a.rating || +new Date(b.createdAt) - +new Date(a.createdAt),
      )[0];
      return { bean, shot: best };
    })
    .filter((r): r is { bean: Bean; shot: ShotLog } => r !== null);

  const recipesHtml = recipes.length
    ? `<ul class="list">${recipes
        .map(
          ({ bean, shot }) => `<li>
<div class="row-between"><span class="name">${esc(bean.name)}</span><span class="muted">${esc(ratingLabel(shot.rating))}</span></div>
<div>${chip("Maalgraad", String(shot.grindSize))}${chip("Dose", shot.doseGrams + " g")}${chip("Yield", shot.yieldGrams + " g")}${chip("Ratio", ratio(shot.yieldGrams, shot.doseGrams))}${chip("Tijd", shot.extractionTimeSeconds + " s")}</div>
</li>`,
        )
        .join("")}</ul>`
    : `<p class="muted">Nog geen beoordeelde shots.</p>`;

  const beanById = new Map(beans.map((b) => [b.id, b]));
  const recent = shots.slice(0, 10);

  const recentHtml = recent.length
    ? `<ul class="flat">${recent
        .map((s) => {
          const name =
            (beanById.get(s.beanId)?.name ?? "Onbekende boon") +
            (s.draft ? " · concept" : "") +
            (s.dialIn ? " · dial-in" : "");
          return `<li>
<div class="row-between"><span class="name small">${esc(name)}</span><span class="muted small">${esc(formatDateOnly(s.createdAt))}</span></div>
<div class="muted" style="margin-top:4px">Maalgraad ${esc(String(s.grindSize))} · ${esc(String(s.doseGrams))}→${esc(String(s.yieldGrams))} g (${esc(ratio(s.yieldGrams, s.doseGrams))}) · ${esc(String(s.extractionTimeSeconds))} s · ${esc(ratingLabel(s.rating))}</div>
</li>`;
        })
        .join("")}</ul>`
    : `<p class="muted">Nog geen shots gelogd.</p>`;

  const body =
    header +
    errorHtml +
    `<section><h2>Recept per boon</h2>${recipesHtml}</section>` +
    `<section><h2>Laatste shots</h2>${recentHtml}</section>`;

  return htmlPage("Koffie · Kobo", body);
}
