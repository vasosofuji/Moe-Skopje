// The film: SHOTS from timeline.ts, each rendered by its id, captions and grain on top.
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { CAPTIONS, END, SHOTS, type Shot } from "./timeline";
import { theme } from "./theme";
import { Caption } from "./Caption";
import { EndFrame } from "./EndFrame";
import { AppScreen, MapBackdrop } from "./ui/AppScreen";
import { AirCard, PharmacyCard, WEATHER_GLYPH, WeatherCard } from "./ui/Cards";
import { Reveal, WeatherScreen } from "./ui/Reveal";
import { RouteMap } from "./ui/RouteMap";
import { Screen, screenHeight } from "./ui/Screen";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const WARM_WHITE = "#fbfaf7";

const Clip = ({ shot }: { shot: Shot }) => {
  if (shot.src.kind !== "clip") return null;
  return (
    <OffthreadVideo src={staticFile(shot.src.file)} trimBefore={shot.src.trimIn} playbackRate={shot.src.rate} muted
      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  );
};

// Shot 1: the screen wakes with the weather card while the phone lies still.
const H1Wake = () => {
  const frame = useCurrentFrame();
  const wake = interpolate(frame, [30, 44], [0, 1], { easing: theme.ease.out, ...clamp });
  return (
    <Screen at="H1" opacity={wake}>
      <WeatherScreen p={theme.light} h={screenHeight("H1")} />
    </Screen>
  );
};

// Shot 3: push into the cloud glyph until its top arc sits on the umbrella crook in H3 (clip frame 20).
const ARC = { x: WEATHER_GLYPH.x + 12.1 * (WEATHER_GLYPH.size / 24), y: WEATHER_GLYPH.y + 4.65 * (WEATHER_GLYPH.size / 24) };
const CROOK = { x: 931, y: 215, scale: (95 / 6) / (WEATHER_GLYPH.size / 24) }; // crook centreline radius 95 px vs arc radius 6 units
const CARD = { w: 366, h: 224 };

const WeatherInsert = () => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, 23], [0, 1], { easing: theme.ease.inOut, ...clamp });
  const s0 = 2.6;
  const start = { x: 960 - (CARD.w / 2) * s0 + ARC.x * s0, y: 540 - (CARD.h / 2) * s0 + ARC.y * s0 };
  const s = s0 * Math.pow(CROOK.scale / s0, t);
  const ax = start.x + (CROOK.x - start.x) * t;
  const ay = start.y + (CROOK.y - start.y) * t;
  return (
    <AbsoluteFill style={{ background: theme.light.bg, fontFamily: theme.font }}>
      <AbsoluteFill style={{ filter: "blur(6px)", transform: "scale(1.05)" }}><MapBackdrop p={theme.light} /></AbsoluteFill>
      <div style={{ position: "absolute", left: 0, top: 0, width: CARD.w, transformOrigin: "0 0",
        transform: `translate(${ax - ARC.x * s}px, ${ay - ARC.y * s}px) scale(${s})` }}>
        <WeatherCard p={theme.light} />
      </div>
    </AbsoluteFill>
  );
};

// P1 hero phone with screen content; `zoom` pushes in on the screen centre.
const Hero = ({ zoom, dusk = false, children }: { zoom: number; dusk?: boolean; children: React.ReactNode }) => (
  <AbsoluteFill style={{ background: dusk ? "#0e1a30" : "#efebe4", overflow: "hidden" }}>
    <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "961px 539px" }}>
      <Img src={staticFile("stills/P1.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      {dusk && <AbsoluteFill style={{ background: "linear-gradient(180deg, #1d3a66, #0b1428)", mixBlendMode: "multiply" }} />}
      <Screen at="P1">{children}</Screen>
    </AbsoluteFill>
  </AbsoluteFill>
);

const RevealShot = () => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, 144], [1, 1.04], { easing: theme.ease.inOut, ...clamp });
  const fromWhite = interpolate(frame, [0, 12], [1, 0], { easing: theme.ease.out, ...clamp });
  return (
    <>
      <Hero zoom={zoom}><Reveal p={theme.light} h={screenHeight("P1")} /></Hero>
      <AbsoluteFill style={{ background: WARM_WHITE, opacity: fromWhite }} />
    </>
  );
};

const Rising = ({ children }: { children: React.ReactNode }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, 14], [0, 1], { easing: theme.ease.out, ...clamp });
  return <div style={{ opacity: t, transform: `translateY(${(1 - t) * 40}px) scale(${0.96 + 0.04 * t})` }}>{children}</div>;
};

const UiShot = ({ id }: { id: string }) => {
  const frame = useCurrentFrame();
  const h = screenHeight("P1");
  const zoom = interpolate(frame, [0, 30], [1.32, 1.36], { easing: theme.ease.inOut, ...clamp });
  if (id === "route") return <Hero zoom={zoom}><RouteMap p={theme.light} h={h} /></Hero>;
  if (id === "air")
    return (
      <Hero zoom={zoom}>
        <AppScreen p={theme.light} h={h}>
          <div style={{ position: "absolute", left: 12, right: 12, top: h * 0.42 }}><Rising><AirCard p={theme.light} big /></Rising></div>
        </AppScreen>
      </Hero>
    );
  return (
    <Hero zoom={zoom} dusk>
      <AppScreen p={theme.dark} h={h}>
        <div style={{ position: "absolute", left: 12, right: 12, top: h * 0.36 }}><Rising><PharmacyCard p={theme.dark} list /></Rising></div>
      </AppScreen>
    </Hero>
  );
};

// Fades over the cut points: H5c blows out to white before the reveal; H10 settles into the end frame.
const ToWhite = ({ from, frames }: { from: number; frames: number }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [from, from + frames], [0, 1], { easing: theme.ease.in, ...clamp });
  return <AbsoluteFill style={{ background: WARM_WHITE, opacity: o }} />;
};

const Grain = () => {
  const frame = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;
  return <AbsoluteFill style={{ pointerEvents: "none", backgroundImage: noise, backgroundSize: "220px",
    backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`, opacity: 0.045, mixBlendMode: "overlay" }} />;
};

const Vignette = () => (
  <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 60%, rgb(0 0 0 / .18) 100%)" }} />
);

const ShotView = ({ shot }: { shot: Shot }) => {
  const len = shot.to - shot.from;
  switch (shot.id) {
    case "H1": return <><Clip shot={shot} /><H1Wake /><Vignette /></>;
    case "weather-insert": return <WeatherInsert />;
    case "H5c": return <><Clip shot={shot} /><Vignette /><ToWhite from={len - 14} frames={14} /></>;
    case "reveal": return <RevealShot />;
    case "route": case "air": case "pharmacy": return <UiShot id={shot.id} />;
    case "H10": return <><Clip shot={shot} /><Vignette /><ToWhite from={len - 16} frames={16} /></>;
    case "end": return <EndFrame wordmarkAt={END.wordmark - shot.from} taglineAt={END.tagline - shot.from} />;
    default: return <><Clip shot={shot} /><Vignette /></>;
  }
};

export const Ad = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    {SHOTS.map((shot) => (
      <Sequence key={shot.id} from={shot.from} durationInFrames={shot.to - shot.from} name={shot.id}>
        <ShotView shot={shot} />
      </Sequence>
    ))}
    {CAPTIONS.map((c) => <Caption key={c.text} {...c} />)}
    <Grain />
  </AbsoluteFill>
);
