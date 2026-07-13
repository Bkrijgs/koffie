import { NextResponse, type NextRequest } from "next/server";
import { supabaseBackend } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Rating, ShotInput } from "@/lib/types";

// Verwerkt het JS-loze log-formulier van /kobo/new: leest de form-data, schrijft
// de shot via de server naar Supabase en stuurt (303) terug naar /kobo. Bij een
// fout gaan we terug naar het formulier met een leesbare melding.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const get = (key: string) => (form.get(key)?.toString() ?? "").trim();

  const fail = (msg: string) =>
    NextResponse.redirect(
      new URL("/kobo/new?error=" + encodeURIComponent(msg), req.url),
      303,
    );

  if (!isSupabaseConfigured) {
    return fail("Supabase is niet geconfigureerd op de server.");
  }

  const beanId = get("beanId");
  const grindSize = parseFloat(get("grindSize"));
  const doseGrams = parseFloat(get("doseGrams"));
  const yieldGrams = parseFloat(get("yieldGrams"));
  const extractionTimeSeconds = parseInt(get("extractionTimeSeconds"), 10);
  const ratingRaw = parseFloat(get("rating"));
  const dialIn = get("dialIn") === "1";
  const notes = get("notes");
  const nextAdjustment = get("nextAdjustment");

  if (!beanId) return fail("Kies een boon");
  if (!isFinite(grindSize) || grindSize <= 0) return fail("Maalgraad vereist");
  if (!isFinite(doseGrams) || doseGrams <= 0) return fail("Dose vereist");
  if (!isFinite(yieldGrams) || yieldGrams <= 0) return fail("Yield vereist");
  if (!isFinite(extractionTimeSeconds) || extractionTimeSeconds <= 0) {
    return fail("Tijd vereist");
  }
  const rating = (isFinite(ratingRaw) ? ratingRaw : 0) as Rating | 0;
  if (!dialIn && !rating) {
    return fail("Geef een rating, of vink 'dial-in shot' aan");
  }

  const input: ShotInput = {
    beanId,
    grindSize,
    doseGrams,
    yieldGrams,
    extractionTimeSeconds,
    rating,
    dialIn,
    notes: notes || undefined,
    nextAdjustment: nextAdjustment || undefined,
    tags: undefined,
  };

  try {
    await supabaseBackend.addShot(input);
  } catch (e) {
    return fail("Opslaan mislukt: " + (e instanceof Error ? e.message : String(e)));
  }

  return NextResponse.redirect(new URL("/kobo", req.url), 303);
}
