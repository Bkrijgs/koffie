import type { Bean, Setup, ShotLog } from "@/lib/types";
import type { ShotAdvice } from "@/lib/coach";
import { clampGrind } from "@/lib/setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

type Body = { bean: Bean; setup: Setup; shots: ShotLog[] };

const ADVICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: {
      type: "string",
      description: "Korte kernboodschap voor de volgende shot, max ~10 woorden",
    },
    grindSize: {
      type: "number",
      description: "Voorgestelde maalgraad op de schaal van de maler",
    },
    doseGrams: { type: "number" },
    yieldGrams: { type: "number" },
    targetTimeSeconds: { type: "number" },
    rationale: {
      type: "array",
      items: { type: "string" },
      description: "2 tot 4 korte bullets met de redenering, in het Nederlands",
    },
    watchFor: {
      type: "string",
      description: "Waar de gebruiker bij de volgende shot op moet letten",
    },
    confidence: { type: "string", enum: ["laag", "gemiddeld", "hoog"] },
  },
  required: [
    "headline",
    "grindSize",
    "doseGrams",
    "yieldGrams",
    "targetTimeSeconds",
    "rationale",
    "watchFor",
    "confidence",
  ],
} as const;

function buildSystemPrompt(setup: Setup): string {
  return [
    "Je bent een ervaren espresso-barista die iemand coacht bij het dial-innen.",
    "Je krijgt de apparatuur, de boon en de volledige shot-historie van die boon.",
    "Geef precies één concreet advies voor de volgende shot.",
    "",
    "Apparatuur:",
    `- Machine: ${setup.machine}`,
    `- Maler: ${setup.grinder}, schaal ${setup.grindMin}–${setup.grindMax} (${setup.grindMin} = fijnst), stapgrootte ${setup.grindStep}`,
    `- Basket: standaard ${setup.defaultBasket === "double" ? "dubbel" : "enkel"}, ${setup.pressurized ? "pressurized" : "niet-pressurized"}`,
    `- ${setup.pressureGauge ? "Heeft" : "Geen"} drukmeter, ${setup.preInfusion ? "met" : "zonder"} pre-infusion, ${setup.pid ? "met" : "zonder"} PID-temperatuurregeling`,
    setup.notes ? `- Setup-notities: ${setup.notes}` : "",
    "",
    "Regels:",
    `- Wees machine-specifiek: geef de maalgraad als getal binnen de schaal ${setup.grindMin}–${setup.grindMax}.`,
    "- Baseer je advies op de DATA. Kijk welke instellingen de hoogste ratings opleverden. Maak geen aannames over smaakvoorkeur — leid die af uit de hoogst beoordeelde shots van deze gebruiker.",
    "- Shots met dialIn=true zijn instel-pogingen; weeg ze lichter dan echte shots.",
    "- Vuistregels (extractie 25–32 s, brew ratio 1:1,5 tot 1:2,5) zijn een vangnet; de eigen data van de gebruiker weegt zwaarder.",
    "- Bij weinig of tegenstrijdige data: zeg dat eerlijk in de rationale, geef een veilige stap en zet confidence op 'laag'.",
    "- Verander bij voorkeur één variabele tegelijk, zodat het effect te isoleren is.",
    "- Antwoord volledig in het Nederlands, concreet en kort.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUserPrompt(bean: Bean, shots: ShotLog[]): string {
  const roastMs = bean.roastDate ? +new Date(bean.roastDate) : null;
  const ordered = [...shots].sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
  );
  const rows = ordered.map((s) => ({
    datum: s.createdAt.slice(0, 10),
    dagNaBranding: roastMs
      ? Math.round((+new Date(s.createdAt) - roastMs) / 86400000)
      : null,
    maalgraad: s.grindSize,
    doseG: s.doseGrams,
    yieldG: s.yieldGrams,
    ratio: Number(s.brewRatio.toFixed(2)),
    tijdSec: s.extractionTimeSeconds,
    rating: s.rating,
    dialIn: s.dialIn,
    tags: s.tags ?? [],
    smaak: s.notes ?? "",
    volgendeKeer: s.nextAdjustment ?? "",
  }));
  return [
    "Boon:",
    `- Naam: ${bean.name}`,
    bean.roaster ? `- Brander: ${bean.roaster}` : "",
    bean.origin ? `- Herkomst: ${bean.origin}` : "",
    bean.blend ? `- Soort: ${bean.blend}` : "",
    bean.roastDate ? `- Branddatum: ${bean.roastDate}` : "",
    bean.notes ? `- Boon-notities: ${bean.notes}` : "",
    "",
    `Shot-historie (oudste eerst, ${rows.length} shots):`,
    JSON.stringify(rows),
    "",
    "Geef nu het advies voor de volgende shot.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY ontbreekt in de serveromgeving." },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const { bean, setup, shots } = body;
  if (!bean || !setup || !Array.isArray(shots) || shots.length === 0) {
    return Response.json(
      { error: "Geen shot-data om te analyseren." },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        messages: [
          { role: "system", content: buildSystemPrompt(setup) },
          { role: "user", content: buildUserPrompt(bean, shots) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "shot_advice",
            strict: true,
            schema: ADVICE_SCHEMA,
          },
        },
      }),
    });
  } catch {
    return Response.json(
      { error: "Kon de AI-dienst niet bereiken." },
      { status: 502 },
    );
  }

  if (!res.ok) {
    return Response.json(
      { error: `De AI-dienst gaf een fout (${res.status}).` },
      { status: 502 },
    );
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    return Response.json(
      { error: "Onverwacht antwoord van de AI." },
      { status: 502 },
    );
  }

  let advice: ShotAdvice;
  try {
    advice = JSON.parse(content) as ShotAdvice;
  } catch {
    return Response.json(
      { error: "Kon het AI-antwoord niet lezen." },
      { status: 502 },
    );
  }

  // Houd de maalgraad binnen de schaal van de maler.
  advice.grindSize = clampGrind(advice.grindSize, setup);

  return Response.json({ advice });
}
