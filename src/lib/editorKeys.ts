/**
 * Czysta logika skrótów edytora tekstu (textarea): formatowanie, linki,
 * kontynuacja list, wcięcia i przerzucanie linii. Każda funkcja dostaje
 * (value, selStart, selEnd) i zwraca nowy stan albo `null`, gdy skrót nie
 * ma w tym miejscu nic do zrobienia (wtedy przeglądarka robi swoje).
 * Podpięcie do DOM jest w `editorKeysDom.ts`.
 */

export interface Edit {
  value: string;
  selStart: number;
  selEnd: number;
}

export type Marker = "**" | "*" | "~~" | "`";

// ---------- linie ----------

function lineStart(v: string, i: number): number {
  return i <= 0 ? 0 : v.lastIndexOf("\n", i - 1) + 1;
}

function lineEnd(v: string, i: number): number {
  const x = v.indexOf("\n", i);
  return x === -1 ? v.length : x;
}

/** Zakres pełnych linii dotkniętych zaznaczeniem; `end` jest bez znaku nowej linii. */
function blockRange(v: string, s: number, e: number): { start: number; end: number } {
  const start = lineStart(v, s);
  // Zaznaczenie kończące się tuż za „\n” nie obejmuje następnej linii.
  const endPos = e > s && v[e - 1] === "\n" ? e - 1 : e;
  return { start, end: lineEnd(v, endPos) };
}

function ordered(s: number, e: number): [number, number] {
  return s <= e ? [s, e] : [e, s];
}

// ---------- formatowanie (Ctrl+B / Ctrl+I) ----------

function runBefore(v: string, i: number, ch: string): number {
  let n = 0;
  while (i - 1 - n >= 0 && v[i - 1 - n] === ch) n++;
  return n;
}

function runAfter(v: string, i: number, ch: string): number {
  let n = 0;
  while (i + n < v.length && v[i + n] === ch) n++;
  return n;
}

/** Czy `left`/`right` znaków `*` wokół tekstu oznacza dany znacznik (`***x***` to pogrubienie i kursywa naraz). */
function starRunHas(marker: "*" | "**", left: number, right: number): boolean {
  const run = Math.min(left, right);
  return marker === "*" ? run % 2 === 1 : run >= 2;
}

/** Czy tekst [a, b) jest otoczony znacznikiem z zewnątrz. */
function wrappedOutside(v: string, a: number, b: number, marker: Marker): boolean {
  if (marker === "*" || marker === "**") return starRunHas(marker, runBefore(v, a, "*"), runAfter(v, b, "*"));
  const m = marker.length;
  return a - m >= 0 && v.slice(a - m, a) === marker && v.slice(b, b + m) === marker;
}

/** Czy sam tekst zaczyna i kończy się znacznikiem (zaznaczono razem ze znacznikami). */
function wrappedInside(text: string, marker: Marker): boolean {
  const m = marker.length;
  if (marker === "*" || marker === "**") {
    const lead = /^\*+/.exec(text)?.[0].length ?? 0;
    const trail = /\*+$/.exec(text)?.[0].length ?? 0;
    if (text.length <= lead + trail) return false;
    if (!starRunHas(marker, lead, trail)) return false;
    const inner = text.slice(m, text.length - m);
    // „**a** i **b**” zaznaczone w całości nie jest jednym pogrubieniem.
    return marker === "*" ? !inner.replace(/\*\*/g, "").includes("*") : !inner.includes("**");
  }
  return text.length > 2 * m && text.startsWith(marker) && text.endsWith(marker) && !text.slice(m, -m).includes(marker);
}

const LINE_PREFIX_RE = /^(?:\s*(?:[-*+>]|\d+[.)])\s+(?:\[[ xX]\]\s+)?|\s*#{1,6}\s+)/;

/** Niepuste fragmenty linii w zaznaczeniu, bez wcięć i znaczników listy / nagłówka. */
function coreSegments(v: string, s: number, e: number): { a: number; b: number }[] {
  const out: { a: number; b: number }[] = [];
  let pos = lineStart(v, s);
  while (pos <= e) {
    const le = lineEnd(v, pos);
    let a = Math.max(s, pos);
    const b0 = Math.min(e, le);
    if (a === pos) {
      const m = LINE_PREFIX_RE.exec(v.slice(pos, le));
      if (m && pos + m[0].length <= b0) a = pos + m[0].length;
    }
    let b = b0;
    while (a < b && /\s/.test(v[a])) a++;
    while (b > a && /\s/.test(v[b - 1])) b--;
    if (b > a) out.push({ a, b });
    if (le >= v.length) break;
    pos = le + 1;
  }
  return out;
}

function toggleCollapsed(v: string, at: number, marker: Marker): Edit {
  const m = marker.length;
  if (wrappedOutside(v, at, at, marker) && runBefore(v, at, marker[0]) >= m) {
    return { value: v.slice(0, at - m) + v.slice(at + m), selStart: at - m, selEnd: at - m };
  }
  return { value: v.slice(0, at) + marker + marker + v.slice(at), selStart: at + m, selEnd: at + m };
}

/** Otacza zaznaczenie znacznikiem albo zdejmuje go, gdy zaznaczenie jest już otoczone. */
export function toggleWrap(value: string, selStart: number, selEnd: number, marker: Marker): Edit {
  const [s, e] = ordered(selStart, selEnd);
  const m = marker.length;
  if (s === e) return toggleCollapsed(value, s, marker);

  const segs = coreSegments(value, s, e);
  if (segs.length === 0) return toggleCollapsed(value, e, marker);

  if (segs.length === 1) {
    const { a, b } = segs[0];
    if (wrappedOutside(value, a, b, marker)) {
      return { value: value.slice(0, a - m) + value.slice(a, b) + value.slice(b + m), selStart: a - m, selEnd: b - m };
    }
    const text = value.slice(a, b);
    if (wrappedInside(text, marker)) {
      return { value: value.slice(0, a) + text.slice(m, -m) + value.slice(b), selStart: a, selEnd: b - 2 * m };
    }
    return { value: value.slice(0, a) + marker + text + marker + value.slice(b), selStart: a + m, selEnd: b + m };
  }

  // Wiele linii: znacznik na każdą linię osobno (markdown nie pogrubia ponad akapitami).
  const allWrapped = segs.every(({ a, b }) => wrappedInside(value.slice(a, b), marker));
  let out = "";
  let cursor = segs[0].a;
  for (const { a, b } of segs) {
    out += value.slice(cursor, a);
    const text = value.slice(a, b);
    if (allWrapped) out += text.slice(m, -m);
    else out += wrappedInside(text, marker) ? text : marker + text + marker;
    cursor = b;
  }
  const first = segs[0].a;
  const last = segs[segs.length - 1].b;
  return {
    value: value.slice(0, first) + out + value.slice(last),
    selStart: first,
    selEnd: first + out.length,
  };
}

// ---------- link (Ctrl+K) ----------

const URL_RE = /^(?:https?:\/\/|www\.)\S+$/i;

/** Zaznaczenie → `[tekst](url)` z zaznaczonym „url”; bez zaznaczenia → `[](url)`; ponownie na linku → sam tekst. */
export function insertLink(value: string, selStart: number, selEnd: number): Edit {
  const [s, e] = ordered(selStart, selEnd);

  // Link wokół zaznaczenia / karetki → zdejmij.
  const ls = lineStart(value, s);
  const le = lineEnd(value, s);
  const re = /\[([^\]\n]*)\]\(([^)\n]*)\)/g;
  const line = value.slice(ls, le);
  for (let m = re.exec(line); m; m = re.exec(line)) {
    const start = ls + m.index;
    const end = start + m[0].length;
    if (start <= s && e <= end) {
      const text = m[1];
      const textStart = start + 1;
      const textEnd = textStart + text.length;
      const inText = s >= textStart && e <= textEnd;
      const from = inText ? s - textStart : 0;
      const to = inText ? e - textStart : text.length;
      return {
        value: value.slice(0, start) + text + value.slice(end),
        selStart: start + from,
        selEnd: start + to,
      };
    }
  }

  if (s === e) {
    return { value: value.slice(0, s) + "[](url)" + value.slice(s), selStart: s + 1, selEnd: s + 1 };
  }
  const sel = value.slice(s, e);
  if (URL_RE.test(sel.trim())) {
    return { value: value.slice(0, s) + `[](${sel})` + value.slice(e), selStart: s + 1, selEnd: s + 1 };
  }
  const urlStart = s + 1 + sel.length + 2;
  return {
    value: value.slice(0, s) + `[${sel}](url)` + value.slice(e),
    selStart: urlStart,
    selEnd: urlStart + 3,
  };
}

// ---------- listy ----------

const LIST_RE = /^(\s*)(?:([-*+])|(\d+)([.)]))[ \t](\[[ xX]\][ \t])?/;

interface ListLine {
  indent: string;
  bullet: string | null;
  num: number | null;
  delim: string;
  box: boolean;
  markerLen: number;
}

function parseListLine(line: string): ListLine | null {
  const m = LIST_RE.exec(line);
  if (!m) return null;
  return {
    indent: m[1],
    bullet: m[2] ?? null,
    num: m[3] !== undefined ? Number(m[3]) : null,
    delim: m[4] ?? "",
    box: m[5] !== undefined,
    markerLen: m[0].length,
  };
}

/** Czy linia z karetką jest elementem listy (dla wyjścia z pułapki Tab). */
export function isListLineAt(value: string, pos: number): boolean {
  return parseListLine(value.slice(lineStart(value, pos), lineEnd(value, pos))) !== null;
}

/** Enter na linii listy: kolejny znacznik; na pustym znaczniku — koniec listy. */
export function continueList(value: string, selStart: number, selEnd: number): Edit | null {
  if (selStart !== selEnd) return null;
  const pos = selStart;
  const ls = lineStart(value, pos);
  const le = lineEnd(value, pos);
  const info = parseListLine(value.slice(ls, le));
  if (!info) return null;
  if (pos < ls + info.markerLen) return null; // karetka w samym znaczniku

  const rest = value.slice(ls + info.markerLen, le);
  if (rest.trim() === "") {
    return { value: value.slice(0, ls) + value.slice(le), selStart: ls, selEnd: ls };
  }
  const marker = info.bullet !== null ? info.bullet : `${(info.num ?? 0) + 1}${info.delim}`;
  const prefix = `${info.indent}${marker} ${info.box ? "[ ] " : ""}`;
  const insert = "\n" + prefix;
  return {
    value: value.slice(0, pos) + insert + value.slice(pos),
    selStart: pos + insert.length,
    selEnd: pos + insert.length,
  };
}

/** Tab / Shift+Tab: wcięcie o 2 spacje na liniach listy w zaznaczeniu. `null`, gdy nie ma czego zmieniać. */
export function indentList(value: string, selStart: number, selEnd: number, outdent: boolean): Edit | null {
  const [s, e] = ordered(selStart, selEnd);
  const { start, end } = blockRange(value, s, e);
  const lines = value.slice(start, end).split("\n");

  // pozycja → nowa pozycja, z uwzględnieniem zmian długości wcześniejszych linii
  const changes: { ls: number; delta: number; removed: number }[] = [];
  let pos = start;
  let any = false;
  const outLines = lines.map((l) => {
    const ls = pos;
    pos += l.length + 1;
    if (!parseListLine(l)) { changes.push({ ls, delta: 0, removed: 0 }); return l; }
    if (!outdent) {
      any = true;
      changes.push({ ls, delta: 2, removed: 0 });
      return "  " + l;
    }
    const m = /^(?: {1,2}|\t)/.exec(l);
    if (!m) { changes.push({ ls, delta: 0, removed: 0 }); return l; }
    any = true;
    changes.push({ ls, delta: -m[0].length, removed: m[0].length });
    return l.slice(m[0].length);
  });
  if (!any) return null;

  const mapPos = (p: number): number => {
    let shift = 0;
    for (let i = 0; i < changes.length; i++) {
      const c = changes[i];
      const nextStart = i + 1 < changes.length ? changes[i + 1].ls : Infinity;
      if (p >= c.ls && p < nextStart) {
        return c.delta > 0 ? p + shift + c.delta : p + shift - Math.min(c.removed, p - c.ls);
      }
      shift += c.delta;
    }
    return p + shift;
  };

  return {
    value: value.slice(0, start) + outLines.join("\n") + value.slice(end),
    selStart: mapPos(s),
    selEnd: mapPos(e),
  };
}

// ---------- przerzucanie i duplikowanie linii ----------

/** Alt+↑/↓: bieżąca linia (albo zaznaczone linie) zamienia się miejscami z sąsiednią. */
export function moveLines(value: string, selStart: number, selEnd: number, dir: "up" | "down"): Edit | null {
  const [s, e] = ordered(selStart, selEnd);
  const { start, end } = blockRange(value, s, e);
  const block = value.slice(start, end);
  if (dir === "up") {
    if (start === 0) return null;
    const prevStart = lineStart(value, start - 1);
    const prev = value.slice(prevStart, start - 1);
    const delta = -(prev.length + 1);
    return {
      value: value.slice(0, prevStart) + block + "\n" + prev + value.slice(end),
      selStart: s + delta,
      selEnd: e + delta,
    };
  }
  if (end >= value.length) return null;
  const nextEnd = lineEnd(value, end + 1);
  const next = value.slice(end + 1, nextEnd);
  const delta = next.length + 1;
  return {
    value: value.slice(0, start) + next + "\n" + block + value.slice(nextEnd),
    selStart: s + delta,
    selEnd: e + delta,
  };
}

/** Shift+Alt+↓/↑: kopia linii (linii) pod / nad oryginałem; zaznaczenie zostaje na kopii przy ↓. */
export function duplicateLines(value: string, selStart: number, selEnd: number, dir: "up" | "down" = "down"): Edit {
  const [s, e] = ordered(selStart, selEnd);
  const { start, end } = blockRange(value, s, e);
  const block = value.slice(start, end);
  const next = value.slice(0, end) + "\n" + block + value.slice(end);
  const delta = dir === "down" ? block.length + 1 : 0;
  return { value: next, selStart: s + delta, selEnd: e + delta };
}
