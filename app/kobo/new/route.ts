import { type NextRequest } from "next/server";
import { supabaseBackend } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase";
import { DEFAULT_SETUP } from "@/lib/setup";
import { esc, htmlPage } from "@/lib/koboHtml";
import type { Bean, Setup, ShotLog } from "@/lib/types";

// JS-loos log-formulier voor de Kobo. POST't naar /kobo/log (ongewijzigde
// handler) die naar Supabase schrijft en terug naar /kobo redirect.
export const dynamic = "force-dynamic";

// Rating-opties 0.5 t/m 5 in stappen van 0.5.
const RATINGS = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.5);

export async function GET(req: NextRequest) {
  const errorParam = req.nextUrl.searchParams.get("error");
  const beanParam = req.nextUrl.searchParams.get("beanId");

  const top = `<div class="top"><h1>Shot loggen</h1><a class="btn btn-light" href="/kobo">← Terug</a></div>`;

  if (!isSupabaseConfigured) {
    return htmlPage(
      "Shot loggen · Kobo",
      top + `<section><p class="err">Supabase is niet geconfigureerd op de server.</p></section>`,
    );
  }

  let beans: Bean[] = [];
  let shots: ShotLog[] = [];
  let setup: Setup = DEFAULT_SETUP;
  try {
    [beans, shots, setup] = await Promise.all([
      supabaseBackend.listBeans(),
      supabaseBackend.listShots(),
      supabaseBackend.getSetup(),
    ]);
  } catch {
    // Bij een leesfout tonen we alsnog een (lege) form i.p.v. te crashen.
  }

  const errorHtml = errorParam
    ? `<p class="err" style="margin-top:16px">${esc(errorParam)}</p>`
    : "";

  if (beans.length === 0) {
    return htmlPage(
      "Shot loggen · Kobo",
      top +
        errorHtml +
        `<section><p class="muted">Voeg eerst een boon toe in de volledige app.</p></section>`,
    );
  }

  const latest = shots[0];
  const selectedBeanId = beanParam ?? latest?.beanId ?? "";
  const def = {
    grindSize: latest ? String(latest.grindSize) : "5",
    doseGrams: latest ? String(latest.doseGrams) : "18",
    yieldGrams: latest ? String(latest.yieldGrams) : "36",
    time: latest ? String(latest.extractionTimeSeconds) : "28",
  };

  const beanOptions = beans
    .map(
      (b) =>
        `<option value="${esc(b.id)}"${b.id === selectedBeanId ? " selected" : ""}>${esc(b.name)}${b.roaster ? " — " + esc(b.roaster) : ""}</option>`,
    )
    .join("");

  const ratingOptions = RATINGS.map(
    (r) => `<option value="${r}">${r.toFixed(1)} ★</option>`,
  ).join("");

  const form = `<form method="post" action="/kobo/log">
<div class="field">
<label class="fld" for="beanId">Boon</label>
<select id="beanId" name="beanId"><option value="">Kies een boon…</option>${beanOptions}</select>
</div>

<div class="field pair">
<div><label class="fld" for="doseGrams">Dose (g)</label><input id="doseGrams" name="doseGrams" type="number" step="0.1" min="0" value="${esc(def.doseGrams)}"></div>
<div><label class="fld" for="yieldGrams">Yield (g)</label><input id="yieldGrams" name="yieldGrams" type="number" step="0.1" min="0" value="${esc(def.yieldGrams)}"></div>
</div>

<div class="field pair">
<div><label class="fld" for="grindSize">Maalgraad</label><input id="grindSize" name="grindSize" type="number" step="${esc(String(setup.grindStep))}" min="${esc(String(setup.grindMin))}" max="${esc(String(setup.grindMax))}" value="${esc(def.grindSize)}"><p class="hint">schaal ${esc(String(setup.grindMin))}–${esc(String(setup.grindMax))}</p></div>
<div><label class="fld" for="extractionTimeSeconds">Tijd (sec.)</label><input id="extractionTimeSeconds" name="extractionTimeSeconds" type="number" step="1" min="0" value="${esc(def.time)}"></div>
</div>

<div class="field">
<label class="fld" for="rating">Rating</label>
<select id="rating" name="rating"><option value="0">— (nog geen rating)</option>${ratingOptions}</select>
</div>

<div class="field"><label class="check"><input type="checkbox" name="dialIn" value="1">Dial-in shot (telt niet mee in gemiddeldes)</label></div>

<div class="field pair">
<div><label class="fld" for="notes">Smaak</label><textarea id="notes" name="notes" rows="3" placeholder="balans, body, afdronk"></textarea></div>
<div><label class="fld" for="nextAdjustment">Volgende keer</label><textarea id="nextAdjustment" name="nextAdjustment" rows="3" placeholder="bv. fijner malen"></textarea></div>
</div>

<button type="submit" class="btn btn-block">Opslaan</button>
<button type="submit" name="action" value="draft" class="btn btn-light btn-block" style="margin-top:10px">Concept opslaan</button>
<p class="hint" style="margin-top:8px">Concept: bewaart de shot zonder rating, die vul je later in de app aan.</p>
</form>`;

  return htmlPage("Shot loggen · Kobo", top + errorHtml + form);
}
