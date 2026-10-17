// Information widgets from the app's main panel, with ad copy from spec §5.
import { glass, theme, type Palette } from "../theme";
import { Barrier, CloudRain, Cross, Leaf, Sun, Umbrella } from "./icons";

const one: React.CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const foot = (p: Palette): React.CSSProperties => ({ fontSize: 13, lineHeight: "18px", color: p.label2, ...one });
const head: React.CSSProperties = { fontSize: 17, lineHeight: "22px", fontWeight: 600, ...one };

const Card = ({ p, children, style }: { p: Palette; children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ ...glass(p), padding: 16, ...style }}>{children}</div>
);

const Tag = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color }}>
    <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
    {children}
  </span>
);

const HOURS: [string, "sun" | "rain", number][] = [
  ["08", "sun", 12], ["10", "sun", 13], ["12", "sun", 14], ["14", "rain", 13], ["16", "rain", 11], ["18", "rain", 10],
];

// Cloud glyph geometry inside the full weather card; Shot 3 aims its push-in here.
export const WEATHER_GLYPH = { x: 300, y: 24, size: 56 };

export const WeatherCard = ({ p, compact = 0 }: { p: Palette; compact?: number }) => {
  // compact: 0 = full card, 1 = one-line summary. Interpolated so the reveal can morph between them.
  const full = 1 - compact;
  return (
    <Card p={p} style={{ position: "relative", height: 74 + 150 * full, overflow: "hidden" }}>
      <div style={foot(p)}>Karpoš · Now</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2 }}>
        <span style={{ fontSize: 34 + 30 * full, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>12°</span>
        <span style={{ fontSize: 15, color: p.label2, ...one }}>Light rain from 14:00</span>
      </div>
      <div style={{ position: "absolute", left: WEATHER_GLYPH.x, top: WEATHER_GLYPH.y + 20 * compact, color: p.teal,
        transform: `scale(${1 - 0.45 * compact})`, transformOrigin: "50% 0" }}>
        <CloudRain size={WEATHER_GLYPH.size} />
      </div>
      <div style={{ opacity: full, marginTop: 18, display: "flex", justifyContent: "space-between" }}>
        {HOURS.map(([h, kind, t]) => (
          <div key={h} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 44 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: p.label2 }}>{h}</span>
            {kind === "sun" ? <Sun size={22} style={{ color: p.yellow }} /> : <CloudRain size={22} style={{ color: p.teal }} />}
            <span style={{ fontSize: 15, fontWeight: 600 }}>{t}°</span>
          </div>
        ))}
      </div>
      <div style={{ opacity: full, marginTop: 14, display: "flex", alignItems: "center", gap: 8, color: p.teal, fontSize: 15, fontWeight: 600 }}>
        <Umbrella size={18} /> Rain 70% this afternoon
      </div>
    </Card>
  );
};

const Row = ({ p, color, icon, title, sub, meta }: {
  p: Palette; color: string; icon: React.ReactNode; title: string; sub: string; meta?: React.ReactNode;
}) => (
  <Card p={p} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
    <div style={{ width: 36, height: 36, borderRadius: 10, flex: "none", display: "grid", placeItems: "center",
      background: `${color}22`, color }}>{icon}</div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={head}>{title}</div>
      <div style={{ fontSize: 15, lineHeight: "20px", color: p.label2, ...one }}>{sub}</div>
      {meta && <div style={{ marginTop: 6 }}>{meta}</div>}
    </div>
  </Card>
);

export const ClosureCard = ({ p }: { p: Palette }) => (
  <Row p={p} color={p.orange} icon={<Barrier size={20} />} title="Road closure on your route"
    sub="Partizanski Odredi Blvd · 08:00–16:00" meta={<Tag color={p.orange}>Detour adds 4 min</Tag>} />
);

const SPARK = [44, 47, 41, 39, 42, 36, 33, 35, 38, 40, 37, 38];
const sparkPath = (w: number, h: number) => {
  const lo = Math.min(...SPARK), hi = Math.max(...SPARK);
  return SPARK.map((v, i) => `${i ? "L" : "M"}${(i / (SPARK.length - 1)) * w} ${2 + (1 - (v - lo) / (hi - lo)) * (h - 4)}`).join(" ");
};

export const AirCard = ({ p, big = false }: { p: Palette; big?: boolean }) => (
  <Row p={p} color={theme.aqiYellowGreen} icon={<Leaf size={20} />} title="Air in Karpoš"
    sub="PM10 38 µg/m³"
    meta={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Tag color={theme.aqiYellowGreen}>Moderate</Tag>
        {big && (
          <svg width="150" height="30" viewBox="0 0 150 30" fill="none">
            <path d={sparkPath(150, 30)} stroke={theme.aqiYellowGreen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    } />
);

const PHARMACIES: [string, string][] = [["Karpoš 2", "0.6 km"], ["Debar Maalo", "1.1 km"], ["Centar", "1.8 km"]];

export const PharmacyCard = ({ p, list = false }: { p: Palette; list?: boolean }) =>
  !list ? (
    <Row p={p} color={p.red} icon={<Cross size={20} />} title="Pharmacy on duty tonight"
      sub="Karpoš 2 · 0.6 km" meta={<Tag color={p.green}>Open until 07:00</Tag>} />
  ) : (
    <Card p={p}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: `${p.red}22`, color: p.red }}>
          <Cross size={20} />
        </div>
        <div style={head}>Pharmacies on duty tonight</div>
      </div>
      {PHARMACIES.map(([name, dist], i) => (
        <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0 10px",
          borderTop: i ? `0.5px solid ${p.glassStroke}` : "none" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 500 }}>Pharmacy · {name}</div>
            <Tag color={p.green}>Open until 07:00</Tag>
          </div>
          <span style={{ fontSize: 15, color: p.label2 }}>{dist}</span>
        </div>
      ))}
    </Card>
  );
