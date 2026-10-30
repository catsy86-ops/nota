import type { CSSProperties, ReactNode } from "react";
import type { GuideArtId } from "@/lib/guides";

/** Opóźnienie animacji kreski/elementu (s). */
const at = (d: number) => ({ "--d": `${d}s` }) as CSSProperties;

const INK = "stroke-foreground/70";
const ACC = "stroke-primary";
const line = { fill: "none", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", pathLength: 1 } as const;

/** Kreska rysowana długopisem; `accent` = bursztyn marki. */
function D({ d, t, accent, w }: { d: string; t: number; accent?: boolean; w?: number }) {
  return <path d={d} {...line} strokeWidth={w ?? line.strokeWidth} className={`guide-draw ${accent ? ACC : INK}`} style={at(t)} />;
}

/** Kartka notatki: zaokrąglony prostokąt rysowany jako pierwszy. */
const Card = ({ x = 30, y = 14, w = 100, h = 84, t = 0 }) => <D d={`M${x + 8} ${y}H${x + w - 8}Q${x + w} ${y} ${x + w} ${y + 8}V${y + h - 8}Q${x + w} ${y + h} ${x + w - 8} ${y + h}H${x + 8}Q${x} ${y + h} ${x} ${y + h - 8}V${y + 8}Q${x} ${y} ${x + 8} ${y}Z`} t={t} />;

const SCENES: Record<GuideArtId, ReactNode> = {
  // „notki” z ekranu startowego, w skali kartki.
  welcome: (
    <g transform="translate(26 26) scale(1.3)">
      <D accent d="M6 30V20Q6 16 11.5 16Q17 16 17 21V30" t={0.05} w={3} />
      <D accent d="M36 23A7 7 0 1 1 22 23A7 7 0 1 1 36 23" t={0.3} w={3} />
      <D accent d="M44 8V26Q44 30 48 30H50" t={0.5} w={3} />
      <D accent d="M40 16H50" t={0.62} w={3} />
      <D accent d="M56 5V30" t={0.68} w={3} />
      <D accent d="M67 16L57 25M60.5 22.5L67.5 30" t={0.78} w={3} />
      <D accent d="M74 16V30" t={0.9} w={3} />
      <circle cx="74" cy="9.6" r="2" className="guide-pop fill-primary" style={at(1)} />
    </g>
  ),
  capture: (
    <>
      <Card />
      <D d="M44 34H104" t={0.35} accent />
      <D d="M44 50H114" t={0.55} />
      <D d="M44 64H96" t={0.75} />
      <g className="guide-pop" style={at(1)}>
        <circle cx="126" cy="92" r="13" className="fill-primary" />
        <path d="M126 86V98M120 92H132" stroke="white" strokeWidth={2.6} strokeLinecap="round" />
      </g>
    </>
  ),
  search: (
    <>
      <Card />
      <D d="M44 34H112" t={0.3} />
      <rect x="40" y="44" width="62" height="12" rx="3" className="guide-pop fill-primary/30" style={at(0.9)} />
      <D d="M44 50H98" t={0.45} />
      <D d="M44 66H106" t={0.6} />
      <g className="guide-slide" style={at(1.2)}>
        <D d="M88 44A14 14 0 1 1 116 44A14 14 0 1 1 88 44M112 54L124 66" t={0.75} accent w={3} />
      </g>
    </>
  ),
  safe: (
    <>
      <Card x={22} w={70} />
      <D d="M34 36H78M34 50H70" t={0.35} />
      <D d="M108 46H140M112 46L114 84H134L136 46M118 38H130" t={0.55} />
      <D d="M96 72Q80 96 58 82M58 82L66 78M58 82L60 90" t={0.95} accent />
    </>
  ),
  today: (
    <>
      <Card />
      {[34, 54, 74].map((y, i) => (
        <g key={y}>
          <D d={`M44 ${y - 6}h12v12h-12z`} t={0.25 + i * 0.15} />
          <D d={`M66 ${y}H${108 - i * 10}`} t={0.3 + i * 0.15} />
        </g>
      ))}
      <D d="M46 34l3.5 3.5 6-7" t={0.9} accent w={2.8} />
      <D d="M46 54l3.5 3.5 6-7" t={1.1} accent w={2.8} />
    </>
  ),
  terms: (
    <>
      <Card />
      <D d="M30 34H130" t={0.3} />
      {[0, 1, 2, 3].map((c) => [0, 1, 2].map((r) => (
        <rect key={`${c}-${r}`} x={40 + c * 22} y={42 + r * 18} width="14" height="10" rx="2" className={`guide-pop ${c === 2 && r === 1 ? "fill-primary" : "fill-foreground/15"}`} style={at(0.4 + (c + r) * 0.06)} />
      )))}
      <circle cx="122" cy="20" r="5" className="guide-pop fill-destructive" style={at(1.1)} />
    </>
  ),
  shifts: (
    <>
      <D d="M24 96H136" t={0} />
      {[38, 58, 46, 62, 30, 0, 0].map((h, i) => h > 0 && (
        <rect key={i} x={30 + i * 15} y={96 - h} width="10" height={h} rx="2" className={`guide-grow ${i === 3 ? "fill-primary" : "fill-primary/45"}`} style={at(0.2 + i * 0.08)} />
      ))}
      {[5, 6].map((i) => <circle key={i} cx={35 + i * 15} cy="90" r="2.5" className="guide-pop fill-foreground/30" style={at(0.8)} />)}
    </>
  ),
  work: (
    <>
      <D d="M30 96V54L80 22L130 54V96Z" t={0} />
      <D d="M48 96V70H64V96" t={0.4} />
      <D d="M88 64H112M100 64V96" t={0.6} accent w={3} />
      <circle cx="100" cy="64" r="4" className="guide-pop fill-sky-500" style={at(1)} />
      <circle cx="112" cy="64" r="4" className="guide-pop fill-rose-500" style={at(1.1)} />
    </>
  ),
  sync: (
    <>
      <D d="M26 22h34v68h-34z" t={0} />
      <D d="M100 22h34v68h-34z" t={0.2} />
      <D d="M64 44Q80 32 96 44M92 38L96 44L89 46" t={0.6} accent />
      <D d="M96 68Q80 80 64 68M68 74L64 68L71 66" t={0.85} accent />
    </>
  ),
  journal: (
    <>
      <Card />
      <D d="M42 26h30v22h-30zM48 44l7-8 5 5 4-4 8 7" t={0.35} accent />
      <D d="M82 30H116M82 42H108" t={0.6} />
      <D d="M42 64H116M42 78H96" t={0.8} />
    </>
  ),
  site: (
    <>
      <D d="M22 34H138V78H22Z" t={0} />
      <D d="M51 34V78M80 34V78M109 34V78" t={0.3} />
      {["5/7", "3/8", "2", "4"].map((v, i) => (
        <text key={v} x={36 + i * 29} y="64" textAnchor="middle" className={`guide-pop font-mono text-[11px] ${i === 2 ? "fill-destructive" : "fill-foreground"}`} style={at(0.6 + i * 0.1)}>{v}</text>
      ))}
      <D d="M30 48h12M59 48h14M88 48h12M117 48h14" t={0.5} />
    </>
  ),
  points: (
    <>
      <D d="M28 18H132V96H28Z" t={0} />
      <D d="M28 70H70V96" t={0.25} />
      <D d="M44 30V58M52 30V58" t={0.45} accent />
      <circle cx="44" cy="30" r="5" className="guide-pop fill-sky-500" style={at(0.85)} />
      <circle cx="52" cy="30" r="5" className="guide-pop fill-rose-500" style={at(0.95)} />
      <circle cx="106" cy="46" r="6" className="guide-pop fill-foreground/45" style={at(1.05)} />
      <D d="M100 60h12v14h-12z" t={0.7} />
    </>
  ),
  material: (
    <>
      <D d="M18 82V44H96V82M96 56H122L136 70V82H18" t={0} />
      <circle cx="42" cy="86" r="7" className="guide-pop fill-foreground/60" style={at(0.5)} />
      <circle cx="116" cy="86" r="7" className="guide-pop fill-foreground/60" style={at(0.55)} />
      {[0, 1, 2].map((i) => <rect key={i} x={30 + i * 20} y={58 - (i === 1 ? 10 : 0)} width="16" height={i === 1 ? 24 : 14} rx="2" className="guide-grow fill-primary/70" style={at(0.75 + i * 0.1)} />)}
    </>
  ),
  billing: (
    <>
      <D d="M44 12H116V100L106 94L96 100L86 94L76 100L66 94L56 100L44 94Z" t={0} />
      <D d="M54 28H88M54 40H96M54 52H82" t={0.35} />
      <D d="M54 66H106" t={0.65} />
      <D d="M78 80H106M78 84H106" t={0.95} accent />
    </>
  ),
};

/**
 * Ilustracja karty samouczka: kartka w kratkę, rysunek kreślony długopisem i znacznik w rogu.
 * `key` zmienia się z kartą, więc animacja startuje od nowa.
 */
export function GuideArt({ art, chip }: { art: GuideArtId; chip?: string }) {
  return (
    <div
      className="relative mx-auto aspect-[10/7] w-full max-w-[17rem] overflow-hidden rounded-card border border-border bg-card"
      style={{ backgroundImage: "linear-gradient(var(--grid, color-mix(in oklab, var(--border) 70%, transparent)) 1px, transparent 1px), linear-gradient(90deg, var(--grid, color-mix(in oklab, var(--border) 70%, transparent)) 1px, transparent 1px)", backgroundSize: "16px 16px", backgroundPosition: "-1px -1px" }}
      aria-hidden
      data-testid="guide-art"
      data-art={art}
    >
      <svg viewBox="0 0 160 112" className="h-full w-full">{SCENES[art]}</svg>
      {chip && (
        <span className="guide-pop absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 font-mono text-2xs font-semibold text-primary-foreground shadow-sm" style={at(0.8)}>{chip}</span>
      )}
    </div>
  );
}
