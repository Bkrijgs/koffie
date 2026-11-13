import type { Bean } from "@/lib/types";
import type { CaffeineEstimate } from "@/lib/caffeine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

// Sanity-grenzen: arabica zit rond ~10 mg/g effectief in het kopje,
// robusta rond ~19. Alles ver daarbuiten is een hallucinatie.
const MG_PER_GRAM_MIN = 4;
const MG_PER_GRAM_MAX = 25;

type Body = { bean: Bean };

const ESTIMATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    mgPerGram: {
      type: "number",
      description:
        "Geschatte mg cafeïne per gram gemalen koffie die bij espresso-extractie in het kopje belandt",
    },
    note: {
      type: "string",
      description:
        "Eén korte Nederlandse zin met de redenering achter de schatting",
    },
    confidence: { type: "string", enum: ["laag", "gemiddeld", "hoog"] },
  },
  required: ["mgPerGram", "note", "confidence"],
} as const;

const SYSTEM_PROMPT = [
  "Je bent een koffiewetenschapper. Schat voor een espressoboon hoeveel mg",
  "cafeïne er per gram gemalen koffie in het kopje terechtkomt bij een",
  "normale espresso-extractie.",
  "",
  "Vuistregels:",
  "- 100% arabica bevat ~1,2% cafeïne per gram; espresso extraheert daarvan",
  "  ~80-90%, dus effectief ~9-11 mg per gram dose.",
  "- 100% robusta bevat ~2,2% cafeïne, effectief ~16-20 mg per gram dose.",
  "- Blends naar rato van het robusta-aandeel; een typische Italiaanse blend",
  "  met 20-40% robusta zit rond 11-14 mg per gram.",
  "- Branding heeft nauwelijks effect op cafeïne per gram; herkomst en",
  "  variëteit een beetje (bijv. laaglandkoffie iets hoger).",
  "- Staat het soort niet vermeld, ga dan uit van 100% arabica en zet",
  "  confidence op 'laag'.",
  "",
  "Antwoord in het Nederlands, kort en zonder overdreven precisie.",
].join("\n");

function buildUserPrompt(bean: Bean): string {
  return [
    "Boon:",
    `- Naam: ${bean.name}`,
    bean.roaster ? `- Brander: ${bean.roaster}` : "",
    bean.origin ? `- Herkomst: ${bean.origin}` : "",
    bean.blend ? `- Soort: ${bean.blend}` : "",
    bean.notes ? `- Notities: ${bean.notes}` : "",
    "",
    "Schat de effectieve mg cafeïne per gram dose voor deze boon.",
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

  const { bean } = body;
  if (!bean || typeof bean.name !== "string" || !bean.name.trim()) {
    return Response.json(
      { error: "Geen boon om te analyseren." },
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
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(bean) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "caffeine_estimate",
            strict: true,
            schema: ESTIMATE_SCHEMA,
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

  let estimate: CaffeineEstimate;
  try {
    estimate = JSON.parse(content) as CaffeineEstimate;
  } catch {
    return Response.json(
      { error: "Kon het AI-antwoord niet lezen." },
      { status: 502 },
    );
  }

  if (!Number.isFinite(estimate.mgPerGram)) {
    return Response.json(
      { error: "Onverwacht antwoord van de AI." },
      { status: 502 },
    );
  }

  estimate.mgPerGram = Math.min(
    MG_PER_GRAM_MAX,
    Math.max(MG_PER_GRAM_MIN, Math.round(estimate.mgPerGram * 10) / 10),
  );

  return Response.json({ estimate });
}
