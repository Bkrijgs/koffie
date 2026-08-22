import { ImageResponse } from "next/og";
import { supabaseBackend } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase";
import { bagStats, openBagFor, type BagStats } from "@/lib/inventory";
import { average, effectiveShots } from "@/lib/utils";
import type { Bag, Bean, ShotLog } from "@/lib/types";

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
const FILL = "#e2e2e2";

const TZ = "Europe/Amsterdam";
const DAYS_IN_STRIP = 28;
const STRIP_HEIGHT = 82;
/** Staafjes met een shot worden nooit lager dan dit, anders past het aantal
 *  er niet leesbaar in. */
const BAR_MIN_HEIGHT = 34;
const MAX_RECENT = 4;

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
};

async function loadData(): Promise<Data> {
  const [beans, shots, bags] = await Promise.all([
    supabaseBackend.listBeans(),
    supabaseBackend.listShots(),
    supabaseBackend.listBags(),
  ]);
  return { beans, shots, bags };
}

export async function GET() {
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

  return png(<Dashboard {...data} />);
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

function Dashboard({ beans, shots, bags }: Data) {
  const now = Date.now();
  const beanById = new Map(beans.map((b) => [b.id, b]));
  const effective = effectiveShots(shots);
  const avgRating = average(effective.map((s) => s.rating));
  const dialInCount = shots.filter((s) => s.dialIn).length;
  const draftCount = shots.filter((s) => s.draft).length;
  const excluded = [
    dialInCount > 0 ? `${dialInCount} dial-in` : null,
    draftCount > 0 ? `${draftCount} concept` : null,
  ].filter(Boolean);

  const recent = shots.slice(0, MAX_RECENT);
  const best = [...effective].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    return +new Date(b.createdAt) - +new Date(a.createdAt);
  })[0];

  const last = shots[0];
  const currentBean = beanById.get(last.beanId);
  const currentBag = currentBean ? openBagFor(currentBean.id, bags) : undefined;
  const stats = currentBag ? bagStats(currentBag, shots) : null;

  // Activiteit: shots per dag over de laatste 28 dagen, oudste links.
  const perDay = new Map<string, number>();
  for (const s of shots) {
    const key = dateKey(s.createdAt);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const strip = Array.from({ length: DAYS_IN_STRIP }, (_, i) => {
    const key = dateKey(new Date(now - (DAYS_IN_STRIP - 1 - i) * 86400000));
    return { key, count: perDay.get(key) ?? 0 };
  });
  const peak = Math.max(1, ...strip.map((d) => d.count));
  const last7 = strip.slice(-7).reduce((sum, d) => sum + d.count, 0);

  const updated = new Date(now).toLocaleString("nl-NL", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Frame>
      <Header subtitle={`Bijgewerkt ${updated}`} />

      <div
        style={{
          display: "flex",
          flexShrink: 0,
          marginTop: 22,
          borderTop: `3px solid ${RULE}`,
          borderBottom: `3px solid ${RULE}`,
        }}
      >
        <Stat
          label="Shots"
          value={String(shots.length)}
          sub={excluded.length > 0 ? excluded.join(" • ") : "alle beoordeeld"}
        />
        <Stat
          label="Bonen"
          value={String(beans.length)}
          sub={`${last7} ${last7 === 1 ? "shot" : "shots"} deze week`}
          divider
        />
        <Stat
          label="Gem. rating"
          value={effective.length > 0 ? nl(avgRating, 1) : "—"}
          sub={
            effective.length > 0
              ? `over ${effective.length} ${effective.length === 1 ? "shot" : "shots"}`
              : "nog niets beoordeeld"
          }
          divider
        />
      </div>

      <div
        style={{
          display: "flex",
          flexShrink: 0,
          flexDirection: "column",
          marginTop: 18,
          padding: 16,
          border: `3px solid ${RULE}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 20,
            letterSpacing: 3,
            color: MUTED,
          }}
        >
          <div style={{ display: "flex" }}>LAATST GEZET</div>
          <div style={{ display: "flex" }}>{safe(whenLabel(last, now))}</div>
        </div>

        <div style={{ display: "flex", marginTop: 8, alignItems: "baseline" }}>
          <div style={{ display: "flex", fontSize: 42, fontWeight: 700 }}>
            {currentBean ? clip(currentBean.name, 24) : "Onbekende boon"}
          </div>
          {currentBean?.roaster ? (
            <div style={{ display: "flex", marginLeft: 14, fontSize: 25, color: MUTED }}>
              {clip(currentBean.roaster, 18)}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 8,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", fontSize: 25 }}>{recipeLine(last)}</div>
          {last.draft || last.rating === 0 ? (
            <div style={{ display: "flex", fontSize: 22, color: MUTED }}>
              nog geen rating
            </div>
          ) : (
            <Rating value={last.rating} />
          )}
        </div>

        <div style={{ display: "flex", marginTop: 6, fontSize: 24, color: MUTED }}>
          {clip(beanMeta(currentBean, now), 62)}
        </div>

        {stats ? (
          <BagBar stats={stats} />
        ) : (
          <div style={{ display: "flex", marginTop: 12, fontSize: 24, color: MUTED }}>
            Geen open zak geregistreerd.
          </div>
        )}
      </div>

      <Section title={`Activiteit — ${DAYS_IN_STRIP} dagen`} />
      <div style={{ display: "flex", flexShrink: 0, alignItems: "flex-end", height: STRIP_HEIGHT }}>
        {strip.map((d, i) => (
          <div
            key={d.key}
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              flexGrow: 1,
              flexBasis: 0,
              height: "100%",
              marginRight: i === strip.length - 1 ? 0 : 6,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                paddingTop: 5,
                height:
                  d.count === 0
                    ? 4
                    : // ondergrens zodat het cijfer in de staaf past
                      Math.max(
                        BAR_MIN_HEIGHT,
                        Math.round((d.count / peak) * STRIP_HEIGHT),
                      ),
                backgroundColor: d.count === 0 ? FILL : INK,
              }}
            >
              {d.count > 0 ? (
                <div
                  style={{
                    display: "flex",
                    fontSize: 18,
                    fontWeight: 700,
                    color: PAPER,
                  }}
                >
                  {d.count}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <Section title="Laatste shots" />
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
        {recent.map((s) => (
          <ShotRow
            key={s.id}
            shot={s}
            bean={beanById.get(s.beanId)}
            now={now}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexShrink: 0,
          flexDirection: "column",
          marginTop: 10,
          padding: 15,
          border: `3px solid ${RULE}`,
        }}
      >
        {best ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: MUTED }}>
              {`BEST TOT NU TOE — ${nl(best.rating, 1)} VAN 5`}
            </div>
            <div style={{ display: "flex", marginTop: 10, fontSize: 30, fontWeight: 700 }}>
              {recipeLine(best)}
            </div>
            <div style={{ display: "flex", marginTop: 6, fontSize: 24, color: MUTED }}>
              {clip(
                best.nextAdjustment
                  ? `${beanLabel(beanById.get(best.beanId))} • ${best.nextAdjustment}`
                  : beanLabel(beanById.get(best.beanId)),
                72,
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: MUTED }}>
              BEST TOT NU TOE
            </div>
            <div style={{ display: "flex", marginTop: 10, fontSize: 30, fontWeight: 700 }}>
              Nog geen beoordeelde shot
            </div>
            <div style={{ display: "flex", marginTop: 6, fontSize: 24, color: MUTED }}>
              Geef een shot een rating; dial-ins tellen niet mee.
            </div>
          </div>
        )}
      </div>
    </Frame>
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
    `maling ${nl(s.grindSize, 1)}`,
    `${nl(s.doseGrams, 1)} g in`,
    `${nl(s.yieldGrams, 1)} g uit`,
    `1:${nl(s.brewRatio, 1)}`,
    `${s.extractionTimeSeconds} s`,
  ].join(" • ");
}

function beanLabel(bean?: Bean): string {
  if (!bean) return "Onbekende boon";
  return bean.roaster ? `${bean.name} — ${bean.roaster}` : bean.name;
}

function ShotRow({
  shot,
  bean,
  now,
}: {
  shot: ShotLog;
  bean?: Bean;
  now: number;
}) {
  const days = daysSince(shot.createdAt, now);
  const when = days <= 0 ? "vandaag" : days === 1 ? "gisteren" : `${days} d geleden`;
  const badge = [shot.dialIn ? "dial-in" : null, shot.draft ? "concept" : null]
    .filter(Boolean)
    .join(" • ");
  const detail = [
    when,
    `${nl(shot.doseGrams, 1)}/${nl(shot.yieldGrams, 1)} g`,
    `1:${nl(shot.brewRatio, 1)}`,
    `${shot.extractionTimeSeconds} s`,
    `maling ${nl(shot.grindSize, 1)}`,
  ].join(" • ");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        paddingTop: 10,
        paddingBottom: 10,
        borderBottom: `1px solid ${FILL}`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: 760 }}>
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 28, fontWeight: 700 }}>
          {clip(beanLabel(bean), 42)}
          {badge ? (
            <div style={{ display: "flex", marginLeft: 12, fontSize: 20, fontWeight: 400, color: MUTED }}>
              {badge}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", marginTop: 4, fontSize: 23, color: MUTED }}>
          {detail}
        </div>
      </div>
      {shot.draft || shot.rating === 0 ? (
        <div style={{ display: "flex", fontSize: 24, color: MUTED }}>
          nog geen rating
        </div>
      ) : (
        <Rating value={shot.rating} />
      )}
    </div>
  );
}

/** Vijfpuntige ster als pad; het lettertype van next/og heeft geen sterglyph,
 *  dus tekenen we hem zelf. */
const STAR_PATH =
  "M12 1.6l3.2 6.5 7.2 1-5.2 5.1 1.2 7.2L12 18l-6.4 3.4 1.2-7.2L1.6 9.1l7.2-1z";
const STAR_SIZE = 28;

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
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24 }}>
        <div style={{ display: "flex" }}>
          {`${nl(stats.remainingGrams, 0)} g van ${nl(stats.bag.grams, 0)} g over`}
        </div>
        <div style={{ display: "flex", color: MUTED }}>
          {`${nl(stats.gramsPerDay, 1)} g/dag • ${left}`}
        </div>
      </div>
      <div style={{ display: "flex", marginTop: 8, height: 22, border: `3px solid ${RULE}` }}>
        <div style={{ display: "flex", width: `${pct}%`, backgroundColor: INK }} />
      </div>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        marginTop: 14,
        marginBottom: 8,
        paddingBottom: 8,
        borderBottom: `3px solid ${RULE}`,
        fontSize: 22,
        letterSpacing: 4,
      }}
    >
      {safe(title).toUpperCase()}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  divider,
}: {
  label: string;
  value: string;
  sub?: string;
  divider?: boolean;
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
        paddingTop: 10,
        paddingBottom: 10,
        borderLeft: divider ? `3px solid ${RULE}` : "none",
      }}
    >
      <div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: MUTED }}>
        {label.toUpperCase()}
      </div>
      <div style={{ display: "flex", marginTop: 6, fontSize: 76, fontWeight: 700 }}>
        {value}
      </div>
      {sub ? (
        <div style={{ display: "flex", marginTop: 2, fontSize: 20, color: MUTED }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>
        Koffie
      </div>
      <div style={{ display: "flex", fontSize: 24, color: MUTED }}>
        {safe(subtitle)}
      </div>
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
      <Header subtitle={stamp} />
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
