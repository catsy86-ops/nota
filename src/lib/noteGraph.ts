import type { Note } from "@/hooks/useNotes";
import { extractWikiLinks } from "@/lib/wikiLinks";
import { noteMatchesLabel } from "@/lib/labelTree";

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

function liveNotes(notes: Note[]): Note[] {
  return notes.filter((n) => !n.trashed && !n.locked);
}

/**
 * Krawędzie całej bazy (linki w obu kierunkach, bez duplikatów) i stopnie węzłów.
 * Cel linku: tytuł, a dopiero potem alias — tak jak `resolveWikiTarget`.
 */
function collectEdges(live: Note[]): { edges: GraphEdge[]; degree: Map<string, number> } {
  const byTitle = new Map<string, Note>();
  for (const n of live) {
    const t = n.title.trim().toLowerCase();
    if (t && !byTitle.has(t)) byTitle.set(t, n);
  }
  for (const n of live) {
    for (const a of n.aliases ?? []) {
      const t = a.trim().toLowerCase();
      if (t && !byTitle.has(t)) byTitle.set(t, n);
    }
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
  return { edges, degree };
}

/** Węzły = notatki z co najmniej jednym wikilinkiem (wychodzącym lub przychodzącym). */
export function buildGraph(notes: Note[], limit = GRAPH_NODE_LIMIT): NoteGraph {
  const live = liveNotes(notes);
  const { edges, degree } = collectEdges(live);
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

export interface LocalGraphOptions {
  /** Ile kroków od notatki (1 = bezpośredni sąsiedzi). */
  depth?: number;
  /** Etykieta z drzewa: zostają notatki pasujące do niej albo do jej dzieci. */
  label?: string | null;
  /** Foldery (z podfolderami): zostają notatki z tych folderów. `null` = bez filtra. */
  folderIds?: ReadonlySet<string> | null;
}

/**
 * Lokalny graf: notatka `centerId` i jej sąsiedzi do `depth` kroków. Filtry dotyczą
 * sąsiadów, nie środka — notatka, którą czytasz, zawsze zostaje na rysunku.
 * Przy limicie tną najdalszych, a w tym samym kroku najmniej połączonych.
 */
export function localGraph(
  notes: Note[],
  centerId: string,
  { depth = 2, label = null, folderIds = null }: LocalGraphOptions = {},
  limit = GRAPH_NODE_LIMIT,
): NoteGraph {
  const live = liveNotes(notes);
  const byId = new Map(live.map((n) => [n.id, n] as const));
  if (!byId.has(centerId)) return { nodes: [], edges: [], total: 0, truncated: false };
  const { edges, degree } = collectEdges(live);
  const allowed = (id: string) => {
    if (id === centerId) return true;
    const n = byId.get(id);
    if (!n) return false;
    if (label && !noteMatchesLabel(n.labels, label)) return false;
    return !folderIds || (n.folderId !== null && folderIds.has(n.folderId));
  };
  const adj = new Map<string, string[]>();
  const usable = edges.filter((e) => allowed(e.a) && allowed(e.b));
  for (const e of usable) {
    (adj.get(e.a) ?? adj.set(e.a, []).get(e.a)!).push(e.b);
    (adj.get(e.b) ?? adj.set(e.b, []).get(e.b)!).push(e.a);
  }
  // Wszerz od środka: `dist` to najkrótsza liczba kroków do każdego osiągalnego węzła.
  const dist = new Map<string, number>([[centerId, 0]]);
  let frontier = [centerId];
  for (let d = 1; d <= depth && frontier.length; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const nb of adj.get(id) ?? []) {
        if (dist.has(nb)) continue;
        dist.set(nb, d);
        next.push(nb);
      }
    }
    frontier = next;
  }
  const title = (id: string) => byId.get(id)?.title.trim() || "Bez tytułu";
  const ordered = [...dist.keys()].sort((a, b) =>
    (dist.get(a)! - dist.get(b)!) || ((degree.get(b) ?? 0) - (degree.get(a) ?? 0)) || title(a).localeCompare(title(b), "pl"),
  );
  const shown = ordered.slice(0, limit);
  const kept = new Set(shown);
  return {
    nodes: shown.map((id) => ({ id, title: title(id), degree: degree.get(id) ?? 0 })),
    edges: usable.filter((e) => kept.has(e.a) && kept.has(e.b)),
    total: ordered.length,
    truncated: ordered.length > shown.length,
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

/** Przybliżenie grafu (plan mobile E5): skala 1–3 i środek widoku w ułamkach płótna (0–1). */
export interface GraphView { scale: number; cx: number; cy: number }

export const GRAPH_VIEW_RESET: GraphView = { scale: 1, cx: 0.5, cy: 0.5 };
export const GRAPH_MAX_SCALE = 3;

/**
 * Zmiana skali o `factor` przy zachowaniu środka widoku. Skala w `[1, GRAPH_MAX_SCALE]`; przy 1 środek
 * wraca na płótno, żeby kolejne oddalanie nie zostawiało go przesuniętego.
 */
export function zoomView(v: GraphView, factor: number): GraphView {
  const scale = Math.min(GRAPH_MAX_SCALE, Math.max(1, v.scale * factor));
  if (scale === 1) return GRAPH_VIEW_RESET;
  return { scale, cx: v.cx, cy: v.cy };
}

/** `viewBox` dla widoku: okno o rozmiarze `W/scale` × `H/scale`, przycięte do płótna. */
export function graphViewBox(v: GraphView, W: number, H: number): string {
  const w = W / v.scale, h = H / v.scale;
  const x = Math.min(Math.max(v.cx * W - w / 2, 0), W - w);
  const y = Math.min(Math.max(v.cy * H - h / 2, 0), H - h);
  return `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
}

/**
 * Przesunięcie widoku o ułamek płótna (`dx`, `dy`, w jednostkach `[0, 1]`). Środek trzymany tak, by okno
 * zawsze mieściło się w płótnie — przy skali `s` środek leży w `[1/(2s), 1 − 1/(2s)]`. Dzięki temu
 * przeciąganie nie „zacina się” na krawędzi, bo nie zbiera nadwyżki poza nią.
 */
export function panView(v: GraphView, dx: number, dy: number): GraphView {
  if (v.scale <= 1) return v;
  const lo = 1 / (2 * v.scale), hi = 1 - lo;
  const clamp = (n: number) => Math.min(hi, Math.max(lo, n));
  return { ...v, cx: clamp(v.cx + dx), cy: clamp(v.cy + dy) };
}
