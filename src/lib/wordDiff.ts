/**
 * Porównanie wersji notatki (nowy plan 6.2, Notatki 5.1): diff słów i akapitów bez biblioteki.
 * LCS (programowanie dynamiczne) na tokenach. Notatki bywają długie, więc powyżej
 * `MAX_CELLS` porównań przechodzimy na tokeny-linie — wynik zgrubny, ale bez zamrożenia karty.
 */
export type DiffOp = { type: "eq" | "del" | "ins"; text: string };

const MAX_CELLS = 2_000_000;

/** Słowa z przylegającą interpunkcją i osobno odstępy, żeby złożone z powrotem dały tekst 1:1. */
export function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

function lcsOps(a: string[], b: string[]): DiffOp[] {
  // Wspólny początek i koniec poza tablicą — zwykle zmiana dotyczy małego fragmentu.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length, endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const head: DiffOp[] = start ? [{ type: "eq", text: a.slice(0, start).join("") }] : [];
  const tail: DiffOp[] = endA < a.length ? [{ type: "eq", text: a.slice(endA).join("") }] : [];
  const x = a.slice(start, endA), y = b.slice(start, endB);
  const n = x.length, m = y.length;
  const mid: DiffOp[] = [];
  if (n === 0 || m === 0) {
    if (n) mid.push({ type: "del", text: x.join("") });
    if (m) mid.push({ type: "ins", text: y.join("") });
    return merge([...head, ...mid, ...tail]);
  }
  // dp[i][j] = długość LCS x[i..] i y[j..]; jedna tablica Uint32 (n+1)×(m+1).
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = x[i] === y[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { mid.push({ type: "eq", text: x[i] }); i++; j++; }
    else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) { mid.push({ type: "del", text: x[i] }); i++; }
    else { mid.push({ type: "ins", text: y[j] }); j++; }
  }
  while (i < n) mid.push({ type: "del", text: x[i++] });
  while (j < m) mid.push({ type: "ins", text: y[j++] });
  return merge([...head, ...mid, ...tail]);
}

/** Sąsiednie operacje tego samego typu w jedną; odstęp między dwiema zmianami dołącza do nich, żeby nie szatkować. */
function merge(ops: DiffOp[]): DiffOp[] {
  const out: DiffOp[] = [];
  for (const op of ops) {
    if (!op.text) continue;
    const last = out[out.length - 1];
    if (last && last.type === op.type) last.text += op.text;
    else out.push({ ...op });
  }
  return out;
}

/** Diff słów `before` → `after`. Bardzo długie teksty — diff linii. */
export function diffWords(before: string, after: string): DiffOp[] {
  const a = tokenize(before), b = tokenize(after);
  if (a.length * b.length > MAX_CELLS) {
    const la = before.split(/(?<=\n)/), lb = after.split(/(?<=\n)/);
    if (la.length * lb.length > MAX_CELLS) return merge([{ type: "del", text: before }, { type: "ins", text: after }]);
    return lcsOps(la, lb);
  }
  return lcsOps(a, b);
}

/** Plan Notatek 4.8: ile słów dopisano i usunięto między `before` a `after` (na osi wersji). */
export function wordChanges(before: string, after: string): { added: number; removed: number } {
  const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
  let added = 0, removed = 0;
  for (const op of diffWords(before, after)) {
    if (op.type === "ins") added += words(op.text);
    else if (op.type === "del") removed += words(op.text);
  }
  return { added, removed };
}

/** Akapity: bloki rozdzielone pustą linią. */
export function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.replace(/^\n+|\n+$/g, ""));
}

export type ParagraphHunk = { kind: "same"; text: string } | { kind: "changed"; current: string[]; version: string[] };

/**
 * Akapity bieżącej treści i wersji ułożone obok siebie: wspólne i zmienione bloki.
 * Zmieniony blok to kolejne akapity różniące się w obu tekstach (może być pusty po jednej stronie).
 */
export function paragraphHunks(current: string, version: string): ParagraphHunk[] {
  const a = current.trim() ? splitParagraphs(current) : [];
  const b = version.trim() ? splitParagraphs(version) : [];
  const ops = lcsOps(a.map((p) => `${p}\u0000`), b.map((p) => `${p}\u0000`));
  const hunks: ParagraphHunk[] = [];
  let pending: { current: string[]; version: string[] } | null = null;
  const flush = () => { if (pending) { hunks.push({ kind: "changed", ...pending }); pending = null; } };
  for (const op of ops) {
    const paras = op.text.split("\u0000").slice(0, -1);
    if (op.type === "eq") { flush(); for (const p of paras) hunks.push({ kind: "same", text: p }); }
    else {
      pending ??= { current: [], version: [] };
      (op.type === "del" ? pending.current : pending.version).push(...paras);
    }
  }
  flush();
  return hunks;
}

/** Treść po przywróceniu jednego zmienionego bloku z wersji („Przywróć tylko ten akapit”). */
export function restoreHunk(hunks: ParagraphHunk[], index: number): string {
  return hunks
    .flatMap((h, i) => (h.kind === "same" ? [h.text] : i === index ? h.version : h.current))
    .join("\n\n");
}
