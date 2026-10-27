import { useEffect, useId, useMemo, useState } from "react";
import type { Note, Folder } from "@/hooks/useNotes";
import { getDescendantFolderIds } from "@/hooks/useNotes";
import { useMotionPref } from "@/hooks/useMotionPref";
import { buildGraph, circleLayout, GRAPH_NODE_LIMIT, localGraph, type GraphEdge, type GraphNode, type NoteGraph as Graph, type Point } from "@/lib/noteGraph";
import { layoutGraph } from "@/workers/graphLayout";
import { ease, dur } from "@/lib/motion";
import { pluralPl } from "@/lib/plural";

const W = 1000;
const H = 620;

interface Props {
  notes: Note[];
  onOpenNote: (id: string) => void;
  /** Lokalny graf wokół tej notatki (czytnik). Bez niego — cała baza. */
  centerId?: string;
  folders?: Folder[];
  /** Węższy panel (boczny czytnika): większe etykiety, bo rysunek jest skalowany w dół. */
  compact?: boolean;
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
 * jak odręczne kreski. Układ liczy Worker (`workers/graphLayout`), tu tylko rysunek.
 */
export default function NoteGraph({ notes, onOpenNote, centerId, folders = [], compact: narrow = false }: Props) {
  const labelSize = narrow ? 34 : 15;
  const { reduced } = useMotionPref();
  const filterId = useId().replace(/:/g, "");
  const [label, setLabel] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [pos, setPos] = useState<Map<string, Point>>(() => new Map());
  const [laid, setLaid] = useState<{ nodes: GraphNode[]; target: Map<string, Point> } | null>(null);
  const [active, setActive] = useState<string | null>(null);

  const labels = useMemo(
    () => [...new Set(notes.flatMap((n) => (n.trashed || n.locked ? [] : n.labels)))].sort((a, b) => a.localeCompare(b, "pl")),
    [notes],
  );
  const graph: Graph = useMemo(() => {
    if (!centerId) return buildGraph(notes);
    const folderIds = folderId ? new Set([folderId, ...getDescendantFolderIds(folderId, folders)]) : null;
    return localGraph(notes, centerId, { label, folderIds });
  }, [notes, centerId, label, folderId, folders]);

  // Układ z Workera; poprzedni rysunek zostaje do czasu nowego, bez migotania.
  useEffect(() => {
    let cancelled = false;
    void layoutGraph(graph.nodes, graph.edges, W, H).then((l) => {
      if (!cancelled) setLaid({ nodes: graph.nodes, target: compact(l, graph.nodes.length) });
    });
    return () => { cancelled = true; };
  }, [graph]);

  // Rozkładanie z okręgu do układu siłowego; reduced motion → od razu gotowy.
  useEffect(() => {
    if (!laid) return;
    const { nodes, target } = laid;
    if (reduced || nodes.length < 2) { setPos(target); return; }
    const from = circleLayout(nodes, W, H);
    const ms = dur.slow * 1000 * 2;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / ms, 1);
      const e = 1 - Math.pow(1 - t, 3);
      const next = new Map<string, Point>();
      for (const n of nodes) {
        const a = from.get(n.id)!, b = target.get(n.id)!;
        next.set(n.id, { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e });
      }
      setPos(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [laid, reduced]);

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of graph.edges) {
      (m.get(e.a) ?? m.set(e.a, new Set()).get(e.a)!).add(e.b);
      (m.get(e.b) ?? m.set(e.b, new Set()).get(e.b)!).add(e.a);
    }
    return m;
  }, [graph]);

  const filters = centerId && (labels.length > 0 || folders.length > 0) && (
    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground" role="group" aria-label="Filtry grafu">
      {labels.length > 0 && (
        <label className="flex min-w-0 items-center gap-1.5">
          Etykieta
          <select
            value={label ?? ""}
            onChange={(e) => setLabel(e.target.value || null)}
            data-testid="graph-filter-label"
            className="min-w-0 max-w-44 truncate rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="">Wszystkie</option>
            {labels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      )}
      {folders.length > 0 && (
        <label className="flex min-w-0 items-center gap-1.5">
          Folder
          <select
            value={folderId ?? ""}
            onChange={(e) => setFolderId(e.target.value || null)}
            data-testid="graph-filter-folder"
            className="min-w-0 max-w-44 truncate rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="">Wszystkie</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
      )}
    </div>
  );

  if (graph.nodes.length === 0 || (centerId && graph.edges.length === 0)) {
    return (
      <div data-testid="link-graph">
        {filters}
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center" data-testid="link-graph-empty">
          {centerId ? (
            <>
              <p className="text-sm font-medium">{label || folderId ? "Brak połączeń w wybranych filtrach" : "Ta notatka nie ma jeszcze połączeń"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Dopisz <code className="rounded bg-muted/60 px-1">[[tytuł]]</code>, żeby pojawiła się tu jako kreska.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Nic jeszcze nie jest połączone</p>
              <p className="mt-1 text-xs text-muted-foreground">Wpisz <code className="rounded bg-muted/60 px-1">[[tytuł]]</code> w notatce, a pojawi się tu jako kreska między dwiema notatkami.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const isDim = (id: string) => active !== null && id !== active && !neighbors.get(active)?.has(id);
  const showAllLabels = graph.nodes.length <= 40;
  const count = centerId ? graph.nodes.length - 1 : graph.nodes.length;
  const summary = centerId
    ? `${count} ${pluralPl(count, ["połączona notatka", "połączone notatki", "połączonych notatek"])} w zasięgu dwóch kroków.`
    : `${graph.nodes.length} ${pluralPl(graph.nodes.length, ["powiązana notatka", "powiązane notatki", "powiązanych notatek"])}, ${graph.edges.length} ${pluralPl(graph.edges.length, ["link", "linki", "linków"])}.`;

  return (
    <div data-testid="link-graph">
      {filters}
      <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
        {graph.truncated
          ? `Pokazano ${graph.nodes.length} z ${graph.total} powiązanych notatek (limit ${GRAPH_NODE_LIMIT}) — te najbliżej i z największą liczbą linków.`
          : `${summary} Kliknij węzeł, żeby otworzyć notatkę.`}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label="Graf powiązań między notatkami"
        className="block h-auto w-full rounded-xl border border-border/60 bg-card text-foreground"
        style={{ backgroundImage: "linear-gradient(color-mix(in srgb, var(--border) 35%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--border) 35%, transparent) 1px, transparent 1px)", backgroundSize: "5% 8.06%" }}
      >
        <defs>
          {/* Lekkie drżenie linii — długopis, nie wektor. */}
          <filter id={`pen-${filterId}`} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter={`url(#pen-${filterId})`} fill="none" strokeLinecap="round">
          {graph.edges.map((e: GraphEdge) => {
            const a = pos.get(e.a), b = pos.get(e.b);
            if (!a || !b) return null;
            const lit = active !== null && (e.a === active || e.b === active);
            return (
              <path
                key={`${e.a}-${e.b}`}
                d={edgePath(a, b, hash(e.a + e.b))}
                stroke={lit ? "var(--primary)" : "currentColor"}
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
          const center = n.id === centerId;
          const hot = lit || center;
          const showLabel = showAllLabels || n.degree >= 2 || hot || (active !== null && neighbors.get(active)?.has(n.id));
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
                <ellipse rx={r} ry={r * 0.92} fill="var(--card)" stroke={hot ? "var(--primary)" : "currentColor"} strokeWidth={hot ? 2.8 : 2} />
                {/* Druga, lekko przesunięta kreska — jak obrysowane dwa razy. */}
                <ellipse rx={r * 0.96} ry={r * 0.99} cx={1.2} cy={-0.8} fill="none" stroke={hot ? "var(--primary)" : "currentColor"} strokeWidth={1} opacity={0.45} />
                <circle r={Math.max(2, r * 0.22)} fill="var(--primary)" opacity={n.degree > 1 ? 0.85 : 0.5} stroke="none" />
              </g>
              {/* Większy cel kliknięcia niż sam obrys. */}
              <rect x={p.x - r - 6} y={p.y - r - 6} width={(r + 6) * 2} height={(r + 6) * 2} fill="transparent" />
              {showLabel && (
                <text
                  x={p.x}
                  y={p.y + r + 17}
                  textAnchor="middle"
                  fontSize={labelSize}
                  fill="currentColor"
                  stroke="var(--card)"
                  strokeWidth={narrow ? 9 : 4}
                  paintOrder="stroke"
                  fontWeight={hot ? 700 : 500}
                >
                  {short(n.title, narrow ? 12 : 22)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
