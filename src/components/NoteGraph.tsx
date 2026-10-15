import { useEffect, useId, useMemo, useState } from "react";
import type { Note } from "@/hooks/useNotes";
import { useMotionPref } from "@/hooks/useMotionPref";
import { buildGraph, circleLayout, forceLayout, GRAPH_NODE_LIMIT, type Point } from "@/lib/noteGraph";
import { ease, dur } from "@/lib/motion";
import { pluralPl } from "@/lib/plural";

const W = 1000;
const H = 620;

interface Props {
  notes: Note[];
  onOpenNote: (id: string) => void;
}

/** Stała „losowość” z id — każdy węzeł ma swoje drgnięcie ręki, ale to samo przy każdym rysunku. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

function radius(degree: number): number {
  return Math.min(11 + Math.sqrt(degree) * 5, 28);
}

/**
 * Układ siłowy rozciąga małe grafy do krawędzi płótna (trzy notatki = trzy kropki
 * w rogach). Ściskamy go do środka tak, by rozpiętość rosła z liczbą węzłów.
 */
function compact(layout: Map<string, Point>, count: number): Map<string, Point> {
  if (count < 2) return layout;
  const pts = [...layout.values()];
  const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
  const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
  const limit = 140 + count * 46;
  const k = Math.min(1, limit / spanX, (limit * (H / W)) / spanY);
  if (k >= 1) return layout;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const out = new Map<string, Point>();
  for (const [id, p] of layout) out.set(id, { x: W / 2 + (p.x - cx) * k, y: H / 2 + (p.y - cy) * k });
  return out;
}

/** Krawędź jak kreska odręczna: lekko wygięta, zawsze w tę samą stronę. */
function edgePath(a: Point, b: Point, seed: number): string {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const bend = (seed - 0.5) * Math.min(len * 0.18, 28);
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${(mx - (dy / len) * bend).toFixed(1)},${(my + (dx / len) * bend).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}

function short(title: string, max = 22): string {
  return title.length > max ? `${title.slice(0, max - 1)}…` : title;
}

/**
 * Graf powiązań w stylu zeszytu: węzły-kółka rysowane długopisem, krawędzie
 * jak odręczne kreski. Układ liczy `noteGraph` (siły), tu tylko rysunek.
 */
export default function NoteGraph({ notes, onOpenNote }: Props) {
  const { reduced } = useMotionPref();
  const filterId = useId().replace(/:/g, "");
  const graph = useMemo(() => buildGraph(notes), [notes]);
  const target = useMemo(() => compact(forceLayout(graph.nodes, graph.edges, W, H), graph.nodes.length), [graph]);
  const [pos, setPos] = useState<Map<string, Point>>(target);
  const [active, setActive] = useState<string | null>(null);

  // Rozkładanie z okręgu do układu siłowego; reduced motion → od razu gotowy.
  useEffect(() => {
    if (reduced || graph.nodes.length < 2) { setPos(target); return; }
    const from = circleLayout(graph.nodes, W, H);
    const ms = dur.slow * 1000 * 2;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / ms, 1);
      const e = 1 - Math.pow(1 - t, 3);
      const next = new Map<string, Point>();
      for (const n of graph.nodes) {
        const a = from.get(n.id)!, b = target.get(n.id)!;
        next.set(n.id, { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e });
      }
      setPos(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [graph, target, reduced]);

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of graph.edges) {
      (m.get(e.a) ?? m.set(e.a, new Set()).get(e.a)!).add(e.b);
      (m.get(e.b) ?? m.set(e.b, new Set()).get(e.b)!).add(e.a);
    }
    return m;
  }, [graph]);

  if (graph.nodes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center" data-testid="link-graph-empty">
        <p className="text-sm font-medium">Nic jeszcze nie jest połączone</p>
        <p className="mt-1 text-xs text-muted-foreground">Wpisz <code className="rounded bg-muted/60 px-1">[[tytuł]]</code> w notatce, a pojawi się tu jako kreska między dwiema notatkami.</p>
      </div>
    );
  }

  const isDim = (id: string) => active !== null && id !== active && !neighbors.get(active)?.has(id);
  const showAllLabels = graph.nodes.length <= 40;

  return (
    <div data-testid="link-graph">
      <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
        {graph.truncated
          ? `Pokazano ${graph.nodes.length} z ${graph.total} powiązanych notatek (limit ${GRAPH_NODE_LIMIT}) — te z największą liczbą linków.`
          : `${graph.nodes.length} ${pluralPl(graph.nodes.length, ["powiązana notatka", "powiązane notatki", "powiązanych notatek"])}, ${graph.edges.length} ${pluralPl(graph.edges.length, ["link", "linki", "linków"])}. Kliknij węzeł, żeby otworzyć notatkę.`}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label="Graf powiązań między notatkami"
        className="block h-auto w-full rounded-xl border border-border/60 bg-card text-foreground"
        style={{ backgroundImage: "linear-gradient(hsl(var(--border) / 0.35) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.35) 1px, transparent 1px)", backgroundSize: "5% 8.06%" }}
      >
        <defs>
          {/* Lekkie drżenie linii — długopis, nie wektor. */}
          <filter id={`pen-${filterId}`} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter={`url(#pen-${filterId})`} fill="none" strokeLinecap="round">
          {graph.edges.map((e) => {
            const a = pos.get(e.a), b = pos.get(e.b);
            if (!a || !b) return null;
            const lit = active !== null && (e.a === active || e.b === active);
            return (
              <path
                key={`${e.a}-${e.b}`}
                d={edgePath(a, b, hash(e.a + e.b))}
                stroke={lit ? "hsl(var(--primary))" : "currentColor"}
                strokeWidth={lit ? 2.4 : 1.6}
                opacity={active === null ? 0.7 : lit ? 1 : 0.12}
                style={{ transition: `opacity ${dur.fast}s cubic-bezier(${ease.out.join(",")})` }}
              />
            );
          })}
        </g>
        {graph.nodes.map((n) => {
          const p = pos.get(n.id);
          if (!p) return null;
          const r = radius(n.degree);
          const seed = hash(n.id);
          const lit = n.id === active;
          const label = showAllLabels || n.degree >= 2 || lit || (active !== null && neighbors.get(active)?.has(n.id));
          return (
            <g
              key={n.id}
              data-graph-node={n.id}
              data-degree={n.degree}
              role="link"
              tabIndex={0}
              aria-label={`${n.title} — ${n.degree} powiązań`}
              className="cursor-pointer outline-hidden"
              opacity={isDim(n.id) ? 0.25 : 1}
              onClick={() => onOpenNote(n.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenNote(n.id); } }}
              onPointerEnter={() => setActive(n.id)}
              onPointerLeave={() => setActive((a) => (a === n.id ? null : a))}
              onFocus={() => setActive(n.id)}
              onBlur={() => setActive((a) => (a === n.id ? null : a))}
            >
              <title>{n.title}</title>
              <g filter={`url(#pen-${filterId})`} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${(seed * 360).toFixed(0)})`}>
                <ellipse rx={r} ry={r * 0.92} fill="hsl(var(--card))" stroke={lit ? "hsl(var(--primary))" : "currentColor"} strokeWidth={lit ? 2.8 : 2} />
                {/* Druga, lekko przesunięta kreska — jak obrysowane dwa razy. */}
                <ellipse rx={r * 0.96} ry={r * 0.99} cx={1.2} cy={-0.8} fill="none" stroke={lit ? "hsl(var(--primary))" : "currentColor"} strokeWidth={1} opacity={0.45} />
                <circle r={Math.max(2, r * 0.22)} fill="hsl(var(--primary))" opacity={n.degree > 1 ? 0.85 : 0.5} stroke="none" />
              </g>
              {/* Większy cel kliknięcia niż sam obrys. */}
              <rect x={p.x - r - 6} y={p.y - r - 6} width={(r + 6) * 2} height={(r + 6) * 2} fill="transparent" />
              {label && (
                <text
                  x={p.x}
                  y={p.y + r + 17}
                  textAnchor="middle"
                  fontSize={15}
                  fill="currentColor"
                  stroke="hsl(var(--card))"
                  strokeWidth={4}
                  paintOrder="stroke"
                  fontWeight={lit ? 700 : 500}
                >
                  {short(n.title)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
