/**
 * Propozycje tras z obrazu planu (faza 5, eksperymentalne). Zrzuty z DWG FastView mają warstwy
 * w kolorach, więc najmocniejszym sygnałem jest kolor rury wskazany przez użytkownika pipetą:
 *  1. maska pikseli w pobliżu koloru (odcień, nasycenie, jasność),
 *  2. domknięcie 3×3 (łata przerwy po antyaliasingu i przecięciach z innymi liniami),
 *  3. szkielet Zhang–Suen (linia o grubości 1 px),
 *  4. łamane między końcami i rozgałęzieniami,
 *  5. uproszczenie Ramera–Douglasa–Peuckera, odsiew krótkich kresek i tych w ramkach opisów.
 * Ściany, wymiary i tekst w innym kolorze odpadają już w kroku 1; w tym samym kolorze — tylko
 * przez długość i ramki opisów. Wynik to zawsze propozycja do zatwierdzenia. Czysty kod (bez DOM):
 * działa w workerze i w testach.
 */

/** Najwięcej odcinków szkieletu do łączenia — powyżej przerywamy z komunikatem (przegląd D1). */
export const DETECT_PIECES_MAX = 20_000;

export interface DetectOptions {
  /** Kolor rury `#rrggbb`. */
  color: string;
  /** Tolerancja 0–1 (0,25 = rozsądny domyślny). */
  tolerance: number;
  /** Najkrótsza propozycja w pikselach obrazu wejściowego. */
  minLength: number;
  /** Ramki opisów (piksele obrazu wejściowego) — kreski w środku to litery, nie rury. */
  ignore?: readonly { x: number; y: number; w: number; h: number }[];
}

export interface DetectedPolyline {
  /** `[x0, y0, x1, y1, …]` w pikselach obrazu wejściowego. */
  pts: number[];
  length: number;
  /** 0–1: dłuższe i prostsze = pewniejsze. */
  confidence: number;
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max / 255];
}

/** Maska 0/1 pikseli podobnych do koloru. Kolory nasycone porównujemy po odcieniu (odporne na antyaliasing). */
export function colorMask(rgba: Uint8ClampedArray, w: number, h: number, color: string, tolerance: number): Uint8Array {
  const target = hexToRgb(color) ?? [0, 0, 0];
  const [th, ts, tv] = rgbToHsv(...target);
  const mask = new Uint8Array(w * h);
  const chromatic = ts > 0.25 && tv > 0.2;
  const hueTol = 10 + tolerance * 50;
  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    if (rgba[p + 3] < 128) continue;
    const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
    if (chromatic) {
      const [hh, ss, vv] = rgbToHsv(r, g, b);
      const dh = Math.min(Math.abs(hh - th), 360 - Math.abs(hh - th));
      if (dh <= hueTol && ss >= ts * (0.45 - tolerance * 0.3) && vv >= 0.15) mask[i] = 1;
    } else {
      // Rura czarna/szara: odległość w RGB.
      const dist = Math.hypot(r - target[0], g - target[1], b - target[2]) / 441.7;
      if (dist <= 0.08 + tolerance * 0.35) mask[i] = 1;
    }
  }
  return mask;
}

function dilate(m: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let on = 0;
    for (let dy = -1; dy <= 1 && !on; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && m[yy * w + xx]) { on = 1; break; }
    }
    out[y * w + x] = on;
  }
  return out;
}

function erode(m: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(m.length);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    let all = 1;
    for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1; dx++) if (!m[(y + dy) * w + x + dx]) { all = 0; break; }
    out[y * w + x] = all;
  }
  return out;
}

/** Domknięcie: rozszerzenie i zwężenie — zamyka przerwy do 2 px. */
export const closeMask = (m: Uint8Array, w: number, h: number) => erode(dilate(m, w, h), w, h);

/** Szkielet Zhang–Suen (w miejscu). */
export function skeletonize(m: Uint8Array, w: number, h: number): Uint8Array {
  const img = m.slice();
  const del: number[] = [];
  let changed = true;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : img[y * w + x]);
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (!img[y * w + x]) continue;
        const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1);
        const p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;
        const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
        let a = 0;
        for (let i = 0; i < 8; i++) if (!seq[i] && seq[i + 1]) a++;
        if (a !== 1) continue;
        if (step === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
        del.push(y * w + x);
      }
      for (const i of del) img[i] = 0;
      if (del.length) changed = true;
    }
  }
  return img;
}

const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;

/** Łamane szkieletu: od każdego końca/rozgałęzienia wzdłuż pikseli do następnego węzła; pętle osobno. */
export function tracePaths(skel: Uint8Array, w: number, h: number): number[][] {
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && skel[y * w + x] === 1;
  const degree = (x: number, y: number) => N8.reduce((n, [dx, dy]) => n + (on(x + dx, y + dy) ? 1 : 0), 0);
  const visited = new Uint8Array(w * h); // krawędź przechodzona raz: oznaczamy piksele poza węzłami
  const isNode = (x: number, y: number) => degree(x, y) !== 2;
  const paths: number[][] = [];

  const walk = (sx: number, sy: number, nx: number, ny: number) => {
    const path = [sx, sy];
    let px = sx, py = sy, x = nx, y = ny;
    for (;;) {
      path.push(x, y);
      if (isNode(x, y)) break;
      visited[y * w + x] = 1;
      let next: [number, number] | null = null;
      for (const [dx, dy] of N8) {
        const xx = x + dx, yy = y + dy;
        if ((xx === px && yy === py) || !on(xx, yy) || visited[yy * w + xx]) continue;
        if (xx === sx && yy === sy && path.length <= 4) continue;
        next = [xx, yy];
        break;
      }
      if (!next) break;
      px = x; py = y; [x, y] = next;
    }
    return path;
  };

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on(x, y) || !isNode(x, y) || degree(x, y) === 0) continue;
    for (const [dx, dy] of N8) {
      const nx = x + dx, ny = y + dy;
      if (!on(nx, ny) || visited[ny * w + nx]) continue;
      if (isNode(nx, ny)) { if (ny * w + nx > y * w + x) paths.push([x, y, nx, ny]); continue; }
      paths.push(walk(x, y, nx, ny));
    }
  }
  // Zamknięte pętle bez węzłów.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on(x, y) || visited[y * w + x] || isNode(x, y)) continue;
    visited[y * w + x] = 1;
    const n = N8.find(([dx, dy]) => on(x + dx, y + dy));
    if (n) paths.push(walk(x, y, x + n[0], y + n[1]));
  }
  return paths;
}

/** Ramer–Douglas–Peucker na płaskiej liście punktów. */
export function simplify(pts: readonly number[], epsilon: number): number[] {
  const n = pts.length / 2;
  if (n <= 2) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = pts[a * 2], ay = pts[a * 2 + 1], bx = pts[b * 2], by = pts[b * 2 + 1];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let best = -1, bestD = epsilon;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((by - ay) * pts[i * 2] - (bx - ax) * pts[i * 2 + 1] + bx * ay - by * ax) / len;
      if (d > bestD) { bestD = d; best = i; }
    }
    if (best >= 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
  return out;
}

const pathLength = (p: readonly number[]) => {
  let s = 0;
  for (let i = 2; i < p.length; i += 2) s += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
  return s;
};

const inside = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) => x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;

/** Cały przebieg: obraz RGBA → propozycje tras (piksele obrazu wejściowego). */
export function detectLines(rgba: Uint8ClampedArray, w: number, h: number, opts: DetectOptions): DetectedPolyline[] {
  const mask = closeMask(colorMask(rgba, w, h, opts.color, opts.tolerance), w, h);
  const skel = skeletonize(mask, w, h);
  // Odcinki przecięte innymi liniami albo rozgałęzieniem szkieletu — najpierw łączymy stykające się końce.
  const paths = tracePaths(skel, w, h);
  // Gęsty plan w tym kolorze (ściany, tekst) przy dużej tolerancji — wynik i tak byłby bezużyteczny.
  if (paths.length > DETECT_PIECES_MAX) throw new Error("Za dużo linii w tym kolorze — zmniejsz tolerancję albo wskaż kolor dokładniej na rurze.");
  const pieces = paths.map((raw) => { const pts = simplify(raw, 1.5); return { pts, length: pathLength(pts), confidence: 0 }; });
  const out: DetectedPolyline[] = [];
  for (const joined of joinPolylines(pieces, 3)) {
    const pts = simplify(joined.pts, 1.5);
    const length = pathLength(pts);
    if (length < opts.minLength) continue;
    const mid = Math.floor(pts.length / 4) * 2;
    if (opts.ignore?.some((r) => inside(pts[mid], pts[mid + 1], r))) continue;
    // Prostota: długość cięciwy do długości łamanej (rura z kilkoma załamaniami nadal wysoko).
    const chord = Math.hypot(pts[pts.length - 2] - pts[0], pts[pts.length - 1] - pts[1]);
    const straight = Math.min(1, chord / length + 0.3);
    const confidence = Math.round(Math.min(1, (0.4 + Math.min(0.4, length / 1000)) * straight + 0.2) * 100) / 100;
    out.push({ pts, length, confidence });
  }
  return out.sort((a, b) => b.length - a.length);
}

/**
 * Łączy odcinki, których końce się stykają (rura przecięta inną linią) — do `gap` pikseli. Końce trzyma
 * w siatce komórek o boku `gap`, więc koszt rośnie liniowo z liczbą odcinków (przegląd bezpieczeństwa D1:
 * wersja „każdy z każdym od nowa po każdym scaleniu” była sześcienna i potrafiła zawiesić worker).
 */
export function joinPolylines(lines: readonly DetectedPolyline[], gap: number): DetectedPolyline[] {
  const list = lines.map((l) => ({ pts: l.pts.slice(), confidence: l.confidence, alive: true }));
  const cell = Math.max(1, gap);
  const grid = new Map<string, Set<number>>();
  const keyOf = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  const ends = (p: readonly number[]) => [[p[0], p[1]], [p[p.length - 2], p[p.length - 1]]] as const;
  const index = (i: number, on: boolean) => {
    for (const [x, y] of ends(list[i].pts)) {
      const k = keyOf(x, y);
      let set = grid.get(k);
      if (on) { if (!set) grid.set(k, (set = new Set())); set.add(i); } else set?.delete(i);
    }
  };
  list.forEach((_, i) => index(i, true));
  /** Inny żywy odcinek z końcem przy (x, y): numer i czy pasuje jego początek. */
  const near = (self: number, x: number, y: number): [number, boolean] | null => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const j of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
        if (j === self || !list[j].alive) continue;
        const [[hx, hy], [tx, ty]] = ends(list[j].pts);
        if (Math.hypot(hx - x, hy - y) <= gap) return [j, true];
        if (Math.hypot(tx - x, ty - y) <= gap) return [j, false];
      }
    }
    return null;
  };
  for (let i = 0; i < list.length; i++) {
    if (!list[i].alive) continue;
    for (let side = 0; side < 2; side++) {
      // Doklejamy do końca łamanej, póki coś się styka; potem odwracamy i robimy to samo z drugiej strony.
      for (;;) {
        const p = list[i].pts;
        const hit = near(i, p[p.length - 2], p[p.length - 1]);
        if (!hit) break;
        const [j, head] = hit;
        index(i, false);
        index(j, false);
        list[j].alive = false;
        const q = head ? list[j].pts : rev(list[j].pts);
        list[i].pts = [...p, ...q.slice(2)];
        list[i].confidence = Math.max(list[i].confidence, list[j].confidence);
        index(i, true);
      }
      index(i, false);
      list[i].pts = rev(list[i].pts);
      index(i, true);
    }
  }
  return list.filter((l) => l.alive).map((l) => ({ pts: l.pts, length: pathLength(l.pts), confidence: l.confidence }));
}

function rev(p: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = p.length - 2; i >= 0; i -= 2) out.push(p[i], p[i + 1]);
  return out;
}
