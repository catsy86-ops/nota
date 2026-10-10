import type { Note } from "@/hooks/useNotes";
import { extractWikiLinks } from "@/lib/wikiLinks";

/** Powyżej tylu węzłów graf przestaje być czytelny — zostają najbardziej powiązane. */
export const GRAPH_NODE_LIMIT = 150;

export interface GraphNode {
  id: string;
  title: string;
  /** Liczba różnych notatek połączonych z tą (w obie strony). */
  degree: number;
}

export interface GraphEdge {
  a: string;
  b: string;
}

export interface NoteGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Ile notatek ma choć jeden link, zanim zadziałał limit. */
  total: number;
  truncated: boolean;
}

/** Węzły = notatki z co najmniej jednym wikilinkiem (wychodzącym lub przychodzącym). */
export function buildGraph(notes: Note[], limit = GRAPH_NODE_LIMIT): NoteGraph {
  const live = notes.filter((n) => !n.trashed);
  const byTitle = new Map<string, Note>();
  for (const n of live) {
    const t = n.title.trim().toLowerCase();
    if (t && !byTitle.has(t)) byTitle.set(t, n);
  }
  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  for (const n of live) {
    for (const t of extractWikiLinks(n.content)) {
      const target = byTitle.get(t);
      if (!target || target.id === n.id) continue;
      const key = n.id < target.id ? `${n.id}|${target.id}` : `${target.id}|${n.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a: n.id, b: target.id });
    }
  }
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
  }
  const all: GraphNode[] = live
    .filter((n) => degree.has(n.id))
    .map((n) => ({ id: n.id, title: n.title.trim() || "Bez tytułu", degree: degree.get(n.id) ?? 0 }))
    .sort((x, y) => y.degree - x.degree || x.title.localeCompare(y.title, "pl"));
  const nodes = all.slice(0, limit);
  const kept = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    edges: edges.filter((e) => kept.has(e.a) && kept.has(e.b)),
    total: all.length,
    truncated: all.length > nodes.length,
  };
}

export interface Point { x: number; y: number }

/** Początkowy układ: węzły na okręgu (najbardziej powiązane bliżej środka). */
export function circleLayout(nodes: GraphNode[], w: number, h: number): Map<string, Point> {
  const out = new Map<string, Point>();
  const cx = w / 2, cy = h / 2;
  const n = nodes.length;
  nodes.forEach((node, i) => {
    const a = (i / Math.max(n, 1)) * Math.PI * 2;
    out.set(node.id, { x: cx + Math.cos(a) * w * 0.4, y: cy + Math.sin(a) * h * 0.4 });
  });
  return out;
}

/**
 * Siłowy układ (Fruchterman–Reingold) liczony od razu, bez animowania kroków:
 * odpychanie par, sprężyny na krawędziach, lekka grawitacja do środka.
 * Deterministyczny, więc ten sam graf układa się tak samo.
 */
export function forceLayout(nodes: GraphNode[], edges: GraphEdge[], w: number, h: number, iterations = 220): Map<string, Point> {
  const n = nodes.length;
  const pos = circleLayout(nodes, w, h);
  if (n < 2) return pos;
  const idx = new Map(nodes.map((nd, i) => [nd.id, i]));
  const xs = nodes.map((nd) => pos.get(nd.id)!.x);
  const ys = nodes.map((nd) => pos.get(nd.id)!.y);
  // Mała deterministyczna perturbacja — symetryczne układy inaczej się zaklinują.
  for (let i = 0; i < n; i++) { xs[i] += ((i * 37) % 11) - 5; ys[i] += ((i * 53) % 13) - 6; }
  const pairs = edges
    .map((e) => [idx.get(e.a), idx.get(e.b)] as const)
    .filter((p): p is readonly [number, number] => p[0] !== undefined && p[1] !== undefined);
  const k = Math.sqrt((w * h) / n) * 0.75;
  let temp = w / 8;
  const dx = new Array<number>(n);
  const dy = new Array<number>(n);
  for (let it = 0; it < iterations; it++) {
    dx.fill(0); dy.fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let vx = xs[i] - xs[j], vy = ys[i] - ys[j];
        let d2 = vx * vx + vy * vy;
        if (d2 < 0.01) { vx = 0.1; vy = 0.1; d2 = 0.02; }
        const d = Math.sqrt(d2);
        const f = (k * k) / d / d;
        dx[i] += vx * f; dy[i] += vy * f;
        dx[j] -= vx * f; dy[j] -= vy * f;
      }
    }
    for (const [a, b] of pairs) {
      const vx = xs[a] - xs[b], vy = ys[a] - ys[b];
      const d = Math.sqrt(vx * vx + vy * vy) || 0.1;
      const f = d / k;
      dx[a] -= vx * f; dy[a] -= vy * f;
      dx[b] += vx * f; dy[b] += vy * f;
    }
    for (let i = 0; i < n; i++) {
      dx[i] -= (xs[i] - w / 2) * 0.06;
      dy[i] -= (ys[i] - h / 2) * 0.06;
      const len = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1;
      const step = Math.min(len, temp);
      xs[i] += (dx[i] / len) * step;
      ys[i] += (dy[i] / len) * step;
    }
    temp *= 0.97;
  }
  // Dopasowanie do ramki z marginesem (zachowuje proporcje rozkładu).
  const pad = 56;
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = maxX > minX ? (w - pad * 2) / (maxX - minX) : 1;
  const sy = maxY > minY ? (h - pad * 2) / (maxY - minY) : 1;
  const out = new Map<string, Point>();
  nodes.forEach((nd, i) => {
    out.set(nd.id, {
      x: maxX > minX ? pad + (xs[i] - minX) * sx : w / 2,
      y: maxY > minY ? pad + (ys[i] - minY) * sy : h / 2,
    });
  });
  return out;
}
