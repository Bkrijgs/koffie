import { ImageResponse } from "next/og";
import { supabaseBackend } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase";
import { bagStats, openBagFor, type BagStats } from "@/lib/inventory";
import { average, effectiveShots } from "@/lib/utils";
import { beanSweetSpot, type SweetSpot as SweetSpotRange } from "@/lib/tips";
import {
  compassAdvice,
  describeTaste,
  ON_TARGET_RADIUS,
  tasteOf,
  tasteTrail,
  type TastePoint,
} from "@/lib/compass";
import { DEFAULT_SETUP } from "@/lib/setup";
import type { Bag, Bean, Setup, ShotLog } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// De Supabase-client draait via fetch; zonder dit zet Next die responses in
// de data-cache en blijft het scherm op de eerste render hangen.
export const fetchCache = "force-no-store";

/** Schermformaat van de Kobo waar dit dashboard op landt. */
const WIDTH = 1080;
const HEIGHT = 1440;

/** E-ink: geen subtiele grijstinten, alles hard zwart-op-wit. */
const INK = "#000000";
const PAPER = "#ffffff";
const MUTED = "#5a5a5a";
const RULE = "#000000";

/** De twee tussentinten van het kalenderraster. Meer dan vier niveaus houd je
 *  op zestien grijswaarden niet uit elkaar, dus dit zijn ze allemaal:
 *  wit, CELL_LOW, CELL_MID, INK. */
const CELL_LOW = "#d0d0d0";
const CELL_MID = "#8a8a8a";

/** Vijf tekstgroottes, meer niet. Als een nieuw element hier niet in past, is
 *  het element verkeerd — niet de schaal. */
const XL = 76;
const L = 48;
const M = 30;
const S = 24;
const XS = 20;

/** Verticale ruimte alleen in veelvouden van acht. */
const GAP_S = 8;
const GAP_M = 16;
const GAP_L = 24;
const GAP_XL = 32;

/** Kalenderraster: 10 x 3 = precies de 30 dagen van het venster. */
const GRID_COLS = 10;
const CELL_HEIGHT = 56;

/** Zijde van het smaakkompas in band 4, en de marge tot de rand van het veld. */
const COMPASS = 460;
const COMPASS_PAD = 30;
/** Hoeveel eerdere shots het spoor op het kompas laat zien. */
const COMPASS_TRAIL = 6;

const TZ = "Europe/Amsterdam";
/** Alles op dit scherm gaat over dit venster: de tegels, de activiteitsstrip
 *  en het beste recept. Levenslange totalen bewegen nauwelijks, en het zijn
 *  juist de grootste cijfers op het scherm — die horen iets te zeggen over
 *  hoe je er nú voor staat. */
const WINDOW_DAYS = 30;

/** Tekens die het meegeleverde latin-lettertype van next/og wél kent:
 *  latin-1, plus een paar leestekens uit General Punctuation. Al het andere
 *  (pijlen, sterren, wiskundetekens) rendert als leeg vakje. */
const UNSUPPORTED =
  /[^ -ÿ–—‘’“”•…]/g;

function safe(text: string): string {
  return text
    .replace(/[←-⇿]/g, "-")
    .replace(/[★☆]/g, "*")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(UNSUPPORTED, "");
}

function clip(text: string, max: number): string {
  const s = safe(text).trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Nederlandse notatie: komma als decimaalteken. */
function nl(value: number, decimals = 0): string {
  return value.toFixed(decimals).replace(".", ",");
}

/** Maalgraad zonder overbodige komma. Een hele stand toont als "10"; een
 *  halve stap blijft "5,5" staan, want dat is een andere stand op de maler. */
function grind(value: number): string {
  return Number.isInteger(value) ? String(value) : nl(value, 1);
}

function dateKey(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  // en-CA levert YYYY-MM-DD; met timeZone valt de dag in de juiste zone.
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

function daysSince(iso: string, now: number): number {
  return Math.floor((now - +new Date(iso)) / 86400000);
}

type Data = {
  beans: Bean[];
  shots: ShotLog[];
  bags: Bag[];
  setup: Setup;
};

async function loadData(): Promise<Data> {
  const [beans, shots, bags, setup] = await Promise.all([
    supabaseBackend.listBeans(),
    supabaseBackend.listShots(),
    supabaseBackend.listBags(),
    // De setup is alleen nodig voor de grenzen van de maler in het
    // kompasadvies; lukt het ophalen niet, dan volstaat de standaard.
    supabaseBackend.getSetup().catch(() => DEFAULT_SETUP),
  ]);
  return { beans, shots, bags, setup };
}

export async function GET(request: Request) {
  // ?view=stats toont in band 4 de oude 30-dagenkalender i.p.v. het kompas.
  const showStats = new URL(request.url).searchParams.get("view") === "stats";

  if (!isSupabaseConfigured) {
    return png(
      <Message
        title="Geen verbinding"
        body="Supabase is niet geconfigureerd op de server."
      />,
    );
  }

  let data: Data;
  try {
    data = await loadData();
  } catch {
    return png(
      <Message
        title="Geen data"
        body="Kon de shots niet ophalen. Bij de volgende refresh proberen we het opnieuw."
      />,
    );
  }

  if (data.shots.length === 0) {
    return png(
      <Message
        title="Nog geen shots"
        body="Log je eerste shot in de app; dan vult dit scherm zich vanzelf."
      />,
    );
  }

  return png(<Dashboard {...data} showStats={showStats} />);
}

function png(element: JSX.Element): ImageResponse {
  return new ImageResponse(element, {
    width: WIDTH,
    height: HEIGHT,
    headers: {
      // Het scherm haalt dit bij elke refresh opnieuw op; niets cachen.
      "cache-control": "no-store, max-age=0, must-revalidate",
    },
  });
}

function Dashboard({
  beans,
  shots,
  bags,
  setup,
  showStats,
}: Data & { showStats: boolean }) {
  const now = Date.now();
  const beanById = new Map(beans.map((b) => [b.id, b]));

  const last = shots[0];
  const currentBean = beanById.get(last.beanId);
  const currentBag = currentBean ? openBagFor(currentBean.id, bags) : undefined;
  const stats = currentBag ? bagStats(currentBag, shots) : null;

  // De sweet spot van de boon die nú in de maler zit. beanSweetSpot leert de
  // tijd- en ratio-range uit de shots van 4* en hoger van díe boon, en valt
  // terug op de algemene vuistregel zolang er te weinig van zijn.
  const spot = beanSweetSpot(
    effectiveShots(shots.filter((s) => s.beanId === last.beanId)),
  );

  // Activiteit: shots per dag over het venster, oudste eerst.
  const perDay = new Map<string, number>();
  for (const s of shots) {
    const key = dateKey(s.createdAt);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const date = new Date(now - (WINDOW_DAYS - 1 - i) * 86400000);
    const key = dateKey(date);
    return { key, date, count: perDay.get(key) ?? 0 };
  });
  const last7 = days.slice(-7).reduce((sum, d) => sum + d.count, 0);

  // De cijfers rekenen over exact dezelfde dagen als het raster: filteren op de
  // dagsleutels die hierboven al zijn opgebouwd, i.p.v. op een losse
  // tijdstempel-drempel. Anders lopen cijfers en cellen een dag uit de pas
  // rond middernacht en bij zomertijd.
  const windowKeys = new Set(days.map((d) => d.key));
  const windowShots = shots.filter((s) => windowKeys.has(dateKey(s.createdAt)));
  const windowEffective = effectiveShots(windowShots);
  const avgRating = average(windowEffective.map((s) => s.rating));
  const beansUsed = new Set(windowShots.map((s) => s.beanId)).size;

  // Wel shots, maar geen enkele in het venster: dan is "0" misleidend.
  const idle = windowShots.length === 0;

  // "Herhaal dit" moet over de boon gaan die in de maler zit. De beste shot van
  // een opgemaakte zak is een loze instructie, dus die is pas de terugval.
  const byBest = (a: ShotLog, b: ShotLog) =>
    b.rating !== a.rating
      ? b.rating - a.rating
      : +new Date(b.createdAt) - +new Date(a.createdAt);
  const ownShots = windowEffective.filter((s) => s.beanId === last.beanId);
  const bestOwn = [...ownShots].sort(byBest)[0];
  const bestAny = [...windowEffective].sort(byBest)[0];
  const best = bestOwn ?? bestAny;

  const bestLabel = bestOwn
    ? "Herhaal dit"
    : bestAny
      ? `Beste · ${WINDOW_DAYS} dagen`
      : "Nog geen beoordeelde shot";

  // Kort genoeg om naast de sweet spot op één regel te passen. De ratio is
  // eruit: die lees je al af aan gram in en gram uit erboven.
  const bestContext = bestOwn
    ? `beste van ${ownShots.length} ${ownShots.length === 1 ? "shot" : "shots"} • ${agoLabel(bestOwn.createdAt, now)}`
    : bestAny
      ? `${clip(beanLabel(beanById.get(bestAny.beanId)), 28)} • ${agoLabel(bestAny.createdAt, now)}`
      : "Geef een shot een rating";

  const sweetLine =
    `sweet spot ${nl(spot.timeLow)} tot ${nl(spot.timeHigh)} s` +
    ` • 1:${nl(spot.ratioLow, 1)} tot 1:${nl(spot.ratioHigh, 1)}` +
    (spot.learned ? "" : " (vuistregel)");

  // Staat het beste recept al groot in band 2, dan is het herhalen ervan in
  // band 3 zinloos.
  const bestIsLast = Boolean(best) && best.id === last.id;

  // Smaakkompas van de boon in de maler: het spoor van de laatste shots en
  // het advies dat uit de meest recente volgt.
  const trailShots = tasteTrail(
    shots.filter((s) => s.beanId === last.beanId),
    COMPASS_TRAIL,
  );
  const trailPoints = trailShots.map((s) => tasteOf(s)!);
  const compassShot = trailShots[trailShots.length - 1];
  const compassPoint = compassShot ? tasteOf(compassShot) : null;
  const advice = compassShot ? compassAdvice(compassShot, setup) : null;
  const totalsLine = idle
    ? `geen shots in ${WINDOW_DAYS} dagen`
    : `${windowShots.length} ${windowShots.length === 1 ? "shot" : "shots"}` +
      (windowEffective.length > 0 ? ` • gem. ${nl(avgRating, 1)}` : "") +
      ` • ${WINDOW_DAYS} dagen`;

  const stamp = new Date(now);
  const datePart = stamp.toLocaleDateString("nl-NL", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timePart = stamp.toLocaleTimeString("nl-NL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Frame>
      {/* ---- Band 1: alleen de klok. Die is de hartslag van het scherm:
           staat hij stil, dan hangt het apparaat. Een titel voegt daar
           niets aan toe — je weet welk scherm er hangt. ---- */}
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          justifyContent: "space-between",
          fontSize: S,
          color: MUTED,
        }}
      >
        <div style={{ display: "flex" }}>{safe(datePart)}</div>
        <div style={{ display: "flex" }}>{safe(timePart)}</div>
      </div>

      <Spacer />

      {/* ---- Band 2: herhaal dit ----
           Het enige omkaderde blok, want het is het enige dat vooruit kijkt.
           De rand bloedt naar buiten (marge -24, padding 21) zodat de tekst
           binnenin op dezelfde x=48 blijft staan als de rest van het scherm. */}
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          flexDirection: "column",
          marginLeft: -24,
          marginRight: -24,
          padding: 21,
          border: `3px solid ${RULE}`,
        }}
      >
        <LabelRow
          left={bestLabel}
          right={
            best && !best.draft && best.rating > 0 ? (
              <Rating value={best.rating} />
            ) : undefined
          }
        />

        <div style={{ display: "flex", marginTop: GAP_L }}>
          <BigNumber
            value={best ? grind(best.grindSize) : "—"}
            label="Maling"
          />
          <BigNumber
            value={best ? nl(best.doseGrams, 1) : "—"}
            label="Gram in"
          />
          <BigNumber
            value={best ? nl(best.yieldGrams, 1) : "—"}
            label="Gram uit"
          />
          <BigNumber
            value={best ? String(best.extractionTimeSeconds) : "—"}
            label="Seconden"
          />
        </div>

        {/* Eén balk over de volle breedte van het kader: de marges heffen de
            padding van het kader op, zodat hij tot aan de rand loopt. */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: GAP_L,
            marginLeft: -21,
            marginRight: -21,
            marginBottom: -21,
            paddingLeft: 21,
            paddingRight: 21,
            paddingTop: GAP_M,
            paddingBottom: GAP_M,
            backgroundColor: INK,
            color: PAPER,
            fontSize: S,
          }}
        >
          <div style={{ display: "flex" }}>{safe(bestContext)}</div>
          <div style={{ display: "flex" }}>{safe(sweetLine)}</div>
        </div>
      </div>

      <Spacer />

      {/* ---- Band 3: de boon in de maler ----
           Geen kopregel meer: de boonnaam zegt zelf al wat dit is. Het tijdstip
           van de laatste shot schuift mee naar die regel, en de brander staat
           eronder op dezelfde kantlijn i.p.v. te zweven achter de naam.
           Zelfde kader als band 2, anders zweeft dit blok ertussen. */}
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          flexDirection: "column",
          marginLeft: -24,
          marginRight: -24,
          padding: 21,
          border: `3px solid ${RULE}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", fontSize: L, fontWeight: 700 }}>
            {currentBean ? clip(currentBean.name, 24) : "Onbekende boon"}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: XS,
              letterSpacing: 3,
              color: MUTED,
            }}
          >
            {safe(whenLabel(last, now)).toUpperCase()}
          </div>
        </div>

        {currentBean?.roaster ? (
          <div
            style={{
              display: "flex",
              marginTop: GAP_S,
              fontSize: M,
              color: MUTED,
            }}
          >
            {clip(currentBean.roaster, 30)}
          </div>
        ) : null}

        <div
          style={{ display: "flex", marginTop: GAP_S, fontSize: S, color: MUTED }}
        >
          {clip(beanMeta(currentBean, now), 62)}
        </div>

        {bestIsLast ? (
          <div
            style={{
              display: "flex",
              marginTop: GAP_M,
              fontSize: S,
              color: MUTED,
            }}
          >
            Je laatste shot is meteen je beste met deze boon.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              marginTop: GAP_M,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", fontSize: M }}>
              {recipeLine(last)}
            </div>
            {last.draft || last.rating === 0 ? (
              <div style={{ display: "flex", fontSize: S, color: MUTED }}>
                nog geen rating
              </div>
            ) : (
              <Rating value={last.rating} />
            )}
          </div>
        )}

        {stats ? (
          <BagBar stats={stats} />
        ) : (
          <div
            style={{
              display: "flex",
              marginTop: GAP_L,
              fontSize: S,
              color: MUTED,
            }}
          >
            Geen open zak geregistreerd.
          </div>
        )}
      </div>

      <Spacer />
      <Divider />

      {showStats ? (
        <div style={{ display: "flex", flexShrink: 0, flexDirection: "column" }}>
        {/* ---- Band 4: 30 dagen ---- */}
        <div style={{ display: "flex", flexShrink: 0, flexDirection: "column" }}>
          <LabelRow
            left={`${WINDOW_DAYS} dagen`}
            rightText={`${last7} ${last7 === 1 ? "shot" : "shots"} deze week`}
          />

          <Calendar days={days} />

          <div
            style={{
              display: "flex",
              marginTop: GAP_M,
              fontSize: XS,
              letterSpacing: 3,
              color: MUTED,
            }}
          >
            {safe(
              `${days[0].date.toLocaleDateString("nl-NL", {
                timeZone: TZ,
                day: "numeric",
                month: "short",
              })} linksboven tot vandaag rechtsonder`,
            ).toUpperCase()}
          </div>

          <div style={{ display: "flex", marginTop: GAP_XL }}>
            <TotalBlock
              value={idle ? "—" : String(windowShots.length)}
              label="Shots"
            />
            <TotalBlock
              value={idle ? "—" : String(beansUsed)}
              label="Bonen"
              gap
            />
            <TotalBlock
              value={windowEffective.length > 0 ? nl(avgRating, 1) : "—"}
              label="Gem. rating"
              gap
            />
          </div>
        </div>
        </div>
      ) : (
        /* ---- Band 4: smaakkompas ----
           Links het veld met het spoor van de laatste shots, rechts wat je
           bij de volgende shot verandert. De 30-dagencijfers krimpen tot één
           regel in de kop. */
        <div style={{ display: "flex", flexShrink: 0, flexDirection: "column" }}>
          <LabelRow left="Smaakkompas" rightText={totalsLine} />

          <div style={{ display: "flex", marginTop: GAP_L }}>
            <CompassPlot trail={trailPoints} />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                flexGrow: 1,
                flexBasis: 0,
                marginLeft: GAP_XL,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: XS,
                  letterSpacing: 3,
                  color: MUTED,
                }}
              >
                VOLGENDE SHOT
              </div>
              {advice && compassPoint ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      display: "flex",
                      marginTop: GAP_M,
                      fontSize: L,
                      fontWeight: 700,
                      lineHeight: 1.1,
                    }}
                  >
                    {safe(advice.title)}
                  </div>
                  {advice.change ? (
                    <div
                      style={{ display: "flex", marginTop: GAP_M, fontSize: M }}
                    >
                      {safe(advice.change.replace(" → ", " naar "))}
                    </div>
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      marginTop: GAP_L,
                      fontSize: S,
                      color: MUTED,
                      lineHeight: 1.35,
                    }}
                  >
                    {safe(advice.reason)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      marginTop: GAP_L,
                      fontSize: XS,
                      letterSpacing: 3,
                      color: MUTED,
                    }}
                  >
                    {safe(
                      `laatste: ${describeTaste(compassPoint)} • ${agoLabel(compassShot.createdAt, now)}`,
                    ).toUpperCase()}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      display: "flex",
                      marginTop: GAP_M,
                      fontSize: L,
                      fontWeight: 700,
                      lineHeight: 1.1,
                    }}
                  >
                    Nog geen shot op het kompas
                  </div>
                  <div
                    style={{
                      display: "flex",
                      marginTop: GAP_L,
                      fontSize: S,
                      color: MUTED,
                      lineHeight: 1.35,
                    }}
                  >
                    Tik in de app bij een shot van deze boon op het kompas
                    waar hij zat. Dan staat hier wat je de volgende keer
                    verandert.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Spacer />
    </Frame>
  );
}

/** Woorden op het kompas. Minder dan in de app: op e-ink moet elk woord op
 *  afstand leesbaar zijn, dus per hoek twee en verder alleen de assen. */
const COMPASS_WORDS: { x: number; y: number; t: string }[] = [
  { x: 112, y: 62, t: "overweldigend" },
  { x: 112, y: 96, t: "zout" },
  { x: 348, y: 62, t: "branderig" },
  { x: 348, y: 96, t: "wrang" },
  { x: 112, y: 338, t: "vlak" },
  { x: 112, y: 372, t: "dun" },
  { x: 348, y: 338, t: "droog" },
  { x: 348, y: 372, t: "leeg" },
];

/** Het smaakkompas voor e-ink: links zuur, rechts bitter, boven zwaar, onder
 *  waterig. Oudere shots zijn open rondjes, de laatste is de dichte stip. */
function CompassPlot({ trail }: { trail: TastePoint[] }) {
  const half = COMPASS / 2;
  const reach = half - COMPASS_PAD;
  const pts = trail.map((p) => ({
    cx: half + p.x * reach,
    cy: half - p.y * reach,
  }));
  const wordBox = 220;

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        flexShrink: 0,
        width: COMPASS,
        height: COMPASS,
        border: `3px solid ${RULE}`,
      }}
    >
      <svg
        width={COMPASS}
        height={COMPASS}
        viewBox={`0 0 ${COMPASS} ${COMPASS}`}
        style={{ position: "absolute", left: -3, top: -3 }}
      >
        <line x1={COMPASS_PAD} y1={half} x2={COMPASS - COMPASS_PAD} y2={half} stroke={CELL_MID} strokeWidth="2" />
        {/* De verticale as begint en eindigt onder de labels ZWAAR en WATERIG. */}
        <line x1={half} y1={COMPASS_PAD + 16} x2={half} y2={COMPASS - COMPASS_PAD - 22} stroke={CELL_MID} strokeWidth="2" />
        <circle cx={half} cy={half} r={reach * ON_TARGET_RADIUS} fill={CELL_LOW} stroke={INK} strokeWidth="3" />
        {pts.length > 1 ? (
          <polyline
            points={pts.map((p) => `${p.cx},${p.cy}`).join(" ")}
            fill="none"
            stroke={INK}
            strokeWidth="3"
            strokeDasharray="8 7"
          />
        ) : null}
        {pts.map((p, i) =>
          i === pts.length - 1 ? (
            <circle key={i} cx={p.cx} cy={p.cy} r="17" fill={INK} stroke={PAPER} strokeWidth="4" />
          ) : (
            <circle key={i} cx={p.cx} cy={p.cy} r="10" fill={PAPER} stroke={INK} strokeWidth="3" />
          ),
        )}
      </svg>

      {COMPASS_WORDS.map((w) => (
        <div
          key={w.t}
          style={{
            display: "flex",
            position: "absolute",
            justifyContent: "center",
            left: w.x - wordBox / 2 - 3,
            top: w.y - 3,
            width: wordBox,
            fontSize: XS,
            color: MUTED,
          }}
        >
          {w.t}
        </div>
      ))}

      <CompassAxis text="ZWAAR" left={half - 110 - 3} top={8} align="center" />
      <CompassAxis text="WATERIG" left={half - 110 - 3} top={COMPASS - 44} align="center" />
      <CompassAxis text="ZUUR" left={10} top={half - 40} align="flex-start" />
      <CompassAxis text="BITTER" left={COMPASS - 236} top={half - 40} align="flex-end" />
    </div>
  );
}

function CompassAxis({
  text,
  left,
  top,
  align,
}: {
  text: string;
  left: number;
  top: number;
  align: "center" | "flex-start" | "flex-end";
}) {
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        justifyContent: align,
        left,
        top,
        width: 220,
        fontSize: XS,
        fontWeight: 700,
        letterSpacing: 3,
      }}
    >
      {text}
    </div>
  );
}

/** Volle-breedte scheidingslijn. Het enige wat blokken van elkaar scheidt. */
function Divider() {
  return (
    <div
      style={{ display: "flex", flexShrink: 0, height: 3, backgroundColor: RULE }}
    />
  );
}

/** Vangt de overgebleven hoogte op. Vier stuks, zodat de speling gelijk over
 *  de bandovergangen valt in plaats van als één gat onderaan. */
function Spacer() {
  return <div style={{ display: "flex", flexGrow: 1, minHeight: GAP_XL }} />;
}

/** Kaps-labelrij boven een band: links de naam, rechts een waarde of sterren. */
function LabelRow({
  left,
  right,
  rightText,
}: {
  left: string;
  right?: React.ReactNode;
  rightText?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: STAR_SIZE,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: XS,
          letterSpacing: 3,
          color: MUTED,
        }}
      >
        {safe(left).toUpperCase()}
      </div>
      {right ?? (
        <div
          style={{
            display: "flex",
            fontSize: XS,
            letterSpacing: 3,
            color: MUTED,
          }}
        >
          {rightText ? safe(rightText).toUpperCase() : ""}
        </div>
      )}
    </div>
  );
}

function BigNumber({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flexGrow: 1,
        flexBasis: 0,
      }}
    >
      <div style={{ display: "flex", fontSize: XL, fontWeight: 700 }}>
        {value}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: GAP_S,
          fontSize: XS,
          letterSpacing: 3,
          color: MUTED,
        }}
      >
        {safe(label).toUpperCase()}
      </div>
    </div>
  );
}

/** De drie totalen als gevulde blokken over de volle breedte. */
function TotalBlock({
  value,
  label,
  gap,
}: {
  value: string;
  label: string;
  gap?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
        flexBasis: 0,
        marginLeft: gap ? GAP_S : 0,
        paddingTop: GAP_M,
        paddingBottom: GAP_M,
        backgroundColor: INK,
        color: PAPER,
      }}
    >
      <div style={{ display: "flex", fontSize: L, fontWeight: 700 }}>
        {value}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: GAP_S,
          fontSize: XS,
          letterSpacing: 3,
        }}
      >
        {safe(label).toUpperCase()}
      </div>
    </div>
  );
}

/** Dertig dagen als raster van 10 x 3, oudste linksboven. Vier vulniveaus,
 *  want meer grijstinten houd je op dit scherm niet uit elkaar. */
function Calendar({
  days,
}: {
  days: { key: string; count: number }[];
}) {
  const rows = Array.from({ length: Math.ceil(days.length / GRID_COLS) }, (_, r) =>
    days.slice(r * GRID_COLS, r * GRID_COLS + GRID_COLS),
  );

  return (
    <div
      style={{ display: "flex", flexDirection: "column", marginTop: GAP_L }}
    >
      {rows.map((row, r) => (
        <div
          key={r}
          style={{
            display: "flex",
            marginBottom: r === rows.length - 1 ? 0 : GAP_S,
          }}
        >
          {row.map((d, i) => {
            const fill =
              d.count === 0
                ? PAPER
                : d.count === 1
                  ? CELL_LOW
                  : d.count === 2
                    ? CELL_MID
                    : INK;
            return (
              <div
                key={d.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexGrow: 1,
                  flexBasis: 0,
                  height: CELL_HEIGHT,
                  marginRight: i === row.length - 1 ? 0 : GAP_S,
                  backgroundColor: fill,
                  border: d.count === 0 ? `3px solid ${INK}` : "none",
                  // Een nul in gedempt grijs: de dag telt mee, er is alleen
                  // niets gezet. Een leeg vakje las als "hier ontbreekt data".
                  color: d.count >= 3 ? PAPER : d.count === 0 ? MUTED : INK,
                  fontSize: M,
                  fontWeight: 700,
                }}
              >
                {String(d.count)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** "vandaag 08:14" / "gisteren 08:14" / "3 dagen geleden" — voor de kop van
 *  het laatst-gezet blok. */
function whenLabel(shot: ShotLog, now: number): string {
  const days = daysSince(shot.createdAt, now);
  const clock = new Date(shot.createdAt).toLocaleTimeString("nl-NL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  if (days <= 0) return `vandaag ${clock}`;
  if (days === 1) return `gisteren ${clock}`;
  return `${days} dagen geleden`;
}

function beanMeta(bean: Bean | undefined, now: number): string {
  const parts = [
    bean?.origin,
    bean?.blend,
    bean?.roastDate
      ? `gebrand ${daysSince(bean.roastDate, now)} dagen geleden`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" • ") : "Geen boondetails ingevuld";
}

function recipeLine(s: ShotLog): string {
  return [
    `maling ${grind(s.grindSize)}`,
    `${nl(s.doseGrams, 1)} in`,
    `${nl(s.yieldGrams, 1)} uit`,
    `1:${nl(s.brewRatio, 1)}`,
    `${s.extractionTimeSeconds} s`,
  ].join(" • ");
}

/** "vandaag" / "gisteren" / "6 dagen geleden", zonder klok. */
function agoLabel(iso: string, now: number): string {
  const days = daysSince(iso, now);
  if (days <= 0) return "vandaag";
  if (days === 1) return "gisteren";
  return `${days} dagen geleden`;
}

function beanLabel(bean?: Bean): string {
  if (!bean) return "Onbekende boon";
  return bean.roaster ? `${bean.name} — ${bean.roaster}` : bean.name;
}

/** Vijfpuntige ster als pad; het lettertype van next/og heeft geen sterglyph,
 *  dus tekenen we hem zelf. */
const STAR_PATH =
  "M12 1.6l3.2 6.5 7.2 1-5.2 5.1 1.2 7.2L12 18l-6.4 3.4 1.2-7.2L1.6 9.1l7.2-1z";
const STAR_SIZE = 32;

/** Eén ster, fill 0 = leeg, 0.5 = half, 1 = vol. De gevulde ster staat in een
 *  smaller vakje met overflow hidden, zodat een halve ster echt half is. */
function Star({ fill }: { fill: number }) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: STAR_SIZE,
        height: STAR_SIZE,
        marginLeft: 5,
      }}
    >
      <svg width={STAR_SIZE} height={STAR_SIZE} viewBox="0 0 24 24">
        <path d={STAR_PATH} fill="none" stroke={INK} strokeWidth="1.8" />
      </svg>
      {fill > 0 ? (
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: Math.round(STAR_SIZE * fill),
            height: STAR_SIZE,
            overflow: "hidden",
          }}
        >
          <svg width={STAR_SIZE} height={STAR_SIZE} viewBox="0 0 24 24">
            <path d={STAR_PATH} fill={INK} />
          </svg>
        </div>
      ) : null}
    </div>
  );
}

/** Rating als vijf sterren; halve ratings worden een halve ster. */
function Rating({ value }: { value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} fill={Math.max(0, Math.min(1, value - i))} />
      ))}
    </div>
  );
}

function BagBar({ stats }: { stats: BagStats }) {
  const pct =
    stats.bag.grams > 0
      ? Math.round((stats.remainingGrams / stats.bag.grams) * 100)
      : 0;
  const left =
    stats.projectedDaysLeft === null
      ? "verbruik onbekend"
      : `nog ~${stats.projectedDaysLeft} ${
          stats.projectedDaysLeft === 1 ? "dag" : "dagen"
        }`;
  // "verbruik onbekend" is de langste tekst die hier kan staan; onder ruwweg
  // een kwart van de balk past die niet meer binnen de zwarte vulling.
  const binnen = pct >= 28;

  // De grammen stonden dubbelop: de balk laat de verhouding al zien. Wat je
  // écht wilt weten is wanneer je moet bijkopen, en dat staat nu ín de balk.
  return (
    // De balk over de volle breedte, met de resterende dagen ín de zwarte
    // vulling. Past die daar niet in — bij een bijna lege zak — dan staat hij
    // ernaast in het witte deel.
    <div
      style={{
        display: "flex",
        marginTop: GAP_L,
        height: 48,
        border: `3px solid ${RULE}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          width: `${pct}%`,
          paddingRight: GAP_M,
          backgroundColor: INK,
          color: PAPER,
          fontSize: S,
        }}
      >
        {binnen ? safe(left) : ""}
      </div>
      {binnen ? null : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            paddingLeft: GAP_M,
            fontSize: S,
            color: MUTED,
          }}
        >
          {safe(left)}
        </div>
      )}
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: WIDTH,
        height: HEIGHT,
        paddingTop: 44,
        paddingBottom: 40,
        paddingLeft: 48,
        paddingRight: 48,
        backgroundColor: PAPER,
        color: INK,
        fontFamily: "sans-serif",
      }}
    >
      {children}
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  const stamp = new Date().toLocaleString("nl-NL", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <Frame>
      {/* Eigen kop: het dashboard tekent die inline in band 1, en dit scherm
          moet er hetzelfde uitzien als voorheen. */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{ display: "flex", fontSize: 56, fontWeight: 700, letterSpacing: -1 }}
        >
          Koffie
        </div>
        <div style={{ display: "flex", fontSize: 24, color: MUTED }}>
          {safe(stamp)}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", fontSize: 56, fontWeight: 700 }}>
          {safe(title)}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 18,
            maxWidth: 760,
            textAlign: "center",
            fontSize: 30,
            color: MUTED,
          }}
        >
          {safe(body)}
        </div>
      </div>
    </Frame>
  );
}
