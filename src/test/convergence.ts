import fc from "fast-check";
import * as Y from "yjs";

/**
 * Z-17.9: zestaw zbieżności (specyfikacja `docs/plan-zestaw-zbieznosci.md`). Repliki wymieniają aktualizacje losowo —
 * częściowo, pomieszane, z powtórzeniem, z wymianą różnicową i ponownym otwarciem — a na końcu sprawdzamy pięć własności
 * na **projekcji** (publicznym odczycie działu), nie na surowym dokumencie:
 * W1 równość projekcji (z kolejnością list), W2 zimna = ciepła, W3 spokój po wymianie, W4 niezmienniki, W5 nic nie ginie.
 * Bez przesuwania zegara (`tick` ze specyfikacji): działy, które go potrzebują, podają czas w operacji.
 */

/** Liczba przebiegów: 200 w `npm test`, więcej w `npm run test:convergence` (zmienna `CONVERGENCE_RUNS`). */
export const convergenceRuns = (fallback = 200) => Number(process.env.CONVERGENCE_RUNS) || fallback;

/** Pochodzenie aktualizacji z innej repliki — nie wraca do kolejek. */
const REMOTE = Symbol("convergence-remote");

export interface ConvergenceDomain<S, Op> {
  name: string;
  /** Magazyn działu nad dokumentem (repliką). */
  create(doc: Y.Doc): S;
  /** Operacje urządzenia `device` (identyfikatory nowych obiektów z przestrzeni tego urządzenia). */
  ops(device: number): fc.Arbitrary<Op>;
  /** Wykonuje operację; nie rzuca przy celu, którego nie ma. */
  apply(store: S, op: Op, device: number): void;
  /** Publiczny odczyt w kolejności interfejsu; wynik serializowalny. */
  project(store: S): unknown;
  /** Naruszenia niezmienników działu (W4). */
  invariants?(projection: unknown): string[];
  /** Naruszenia W5 na podstawie historii operacji wszystkich replik. */
  losses?(history: readonly Applied<Op>[], projection: unknown): string[];
  /** Odczyt, który może pisać (start działu) — wołany przed W3. */
  settle?(store: S): void;
}

export interface Applied<Op> { device: number; op: Op }

export type Step<Op> =
  | { k: "op"; d: number; op: Op }
  | { k: "deliver"; from: number; to: number; n: number }
  | { k: "shuffle"; from: number; to: number; seed: number }
  | { k: "sync"; from: number; to: number }
  | { k: "reopen"; d: number };

export interface ConvergenceReport { ok: boolean; property?: "W1" | "W2" | "W3" | "W4" | "W5"; detail?: string }

/** JSON z kluczami obiektów po kolei — kolejność list zostaje (W1 sprawdza też kolejność). */
export function stable(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x));
}

/** Pierwsza ścieżka, na której projekcje się różnią — zamiast całego zrzutu w komunikacie. */
export function firstDiff(a: unknown, b: unknown, path = "$"): string | null {
  if (stable(a) === stable(b)) return null;
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = Array.isArray(a) && Array.isArray(b) ? [...Array(Math.max(a.length, b.length)).keys()].map(String) : [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const k of keys) {
      const d = firstDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
      if (d) return d;
    }
  }
  return `${path}: ${stable(a)?.slice(0, 160)} ≠ ${stable(b)?.slice(0, 160)}`;
}

interface Replica<S> { doc: Y.Doc; store: S; off: () => void }

/** Deterministyczne przemieszanie (ziarno z generatora — kurczenie i powtórka dają ten sam przebieg). */
function permute<T>(xs: T[], seed: number): T[] {
  const out = [...xs];
  let s = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Jeden przebieg kroków na `replicas` replikach, potem pełna wymiana i W1–W5. */
export function runScript<S, Op>(domain: ConvergenceDomain<S, Op>, steps: readonly Step<Op>[], replicas = 2): ConvergenceReport {
  let nextClient = 1;
  const queues: Uint8Array[][][] = Array.from({ length: replicas }, () => Array.from({ length: replicas }, () => []));
  const history: Applied<Op>[] = [];
  const everything: Uint8Array[] = [];
  let quietBroken = 0;
  let counting = false;

  const open = (i: number, from?: Uint8Array): Replica<S> => {
    const doc = new Y.Doc();
    // Powtarzalność: stały identyfikator klienta (zwycięzca równoległych zapisów zależy od niego).
    doc.clientID = nextClient++;
    if (from) Y.applyUpdate(doc, from, REMOTE);
    const store = domain.create(doc);
    const onUpdate = (u: Uint8Array, origin: unknown) => {
      if (origin === REMOTE) return;
      everything.push(u);
      if (counting) quietBroken++;
      for (let j = 0; j < replicas; j++) if (j !== i) queues[i][j].push(u);
    };
    doc.on("update", onUpdate);
    return { doc, store, off: () => doc.off("update", onUpdate) };
  };
  const rs: Replica<S>[] = Array.from({ length: replicas }, (_, i) => open(i));
  const deliver = (from: number, to: number, n = Infinity) => {
    const q = queues[from][to];
    for (const u of q.splice(0, Math.min(n, q.length))) Y.applyUpdate(rs[to].doc, u, REMOTE);
  };
  const sync = (from: number, to: number) => {
    Y.applyUpdate(rs[to].doc, Y.encodeStateAsUpdate(rs[from].doc, Y.encodeStateVector(rs[to].doc)), REMOTE);
  };
  const ok = (d: number) => d >= 0 && d < replicas;

  for (const s of steps) {
    if (s.k === "op") { if (!ok(s.d)) continue; domain.apply(rs[s.d].store, s.op, s.d); history.push({ device: s.d, op: s.op }); }
    else if (s.k === "deliver") { if (ok(s.from) && ok(s.to) && s.from !== s.to) deliver(s.from, s.to, s.n); }
    else if (s.k === "shuffle") {
      if (!ok(s.from) || !ok(s.to) || s.from === s.to) continue;
      const q = queues[s.from][s.to].splice(0);
      const mixed = permute(q, s.seed);
      if (mixed.length) mixed.push(mixed[s.seed % mixed.length]); // jedna aktualizacja dostarczona dwa razy
      for (const u of mixed) Y.applyUpdate(rs[s.to].doc, u, REMOTE);
    } else if (s.k === "sync") { if (ok(s.from) && ok(s.to) && s.from !== s.to) sync(s.from, s.to); }
    else if (s.k === "reopen") {
      if (!ok(s.d)) continue;
      const state = Y.encodeStateAsUpdate(rs[s.d].doc);
      rs[s.d].off();
      rs[s.d] = open(s.d, state);
    }
  }

  // Koniec przebiegu: wszystkie kolejki, potem wymiana różnicowa każdy z każdym dwa razy.
  for (let round = 0; round < 3; round++) for (let a = 0; a < replicas; a++) for (let b = 0; b < replicas; b++) if (a !== b) deliver(a, b);
  for (let round = 0; round < 2; round++) for (let a = 0; a < replicas; a++) for (let b = 0; b < replicas; b++) if (a !== b) sync(a, b);

  const proj = rs.map((r) => domain.project(r.store));
  for (let i = 1; i < replicas; i++) {
    const d = firstDiff(proj[0], proj[i]);
    if (d) return { ok: false, property: "W1", detail: `replika 0 ≠ ${i}: ${d}` };
  }
  for (let i = 0; i < replicas; i++) {
    const cold = new Y.Doc();
    Y.applyUpdate(cold, Y.encodeStateAsUpdate(rs[i].doc));
    const d = firstDiff(proj[i], domain.project(domain.create(cold)));
    if (d) return { ok: false, property: "W2", detail: `replika ${i}, ciepła ≠ zimna: ${d}` };
  }
  counting = true;
  for (const r of rs) { domain.settle?.(r.store); domain.project(r.store); }
  for (let a = 0; a < replicas; a++) for (let b = 0; b < replicas; b++) if (a !== b) { deliver(a, b); sync(a, b); }
  for (const r of rs) for (const u of everything.slice()) Y.applyUpdate(r.doc, u, REMOTE);
  counting = false;
  if (quietBroken > 0) return { ok: false, property: "W3", detail: `po pełnej wymianie powstało ${quietBroken} nowych aktualizacji` };
  const after = domain.project(rs[0].store);
  const d3 = firstDiff(proj[0], after);
  if (d3) return { ok: false, property: "W3", detail: `ponowne dostarczenie zmieniło projekcję: ${d3}` };
  const broken = domain.invariants?.(proj[0]) ?? [];
  if (broken.length) return { ok: false, property: "W4", detail: broken.join("; ") };
  const lost = domain.losses?.(history, proj[0]) ?? [];
  if (lost.length) return { ok: false, property: "W5", detail: lost.join("; ") };
  rs.forEach((r) => r.off());
  return { ok: true };
}

/** Kroki przebiegu: zawsze co najmniej jeden odcinek 3–10 operacji jednej repliki bez dostawy (praca bez łączności). */
export function stepsArb<S, Op>(domain: ConvergenceDomain<S, Op>, replicas: number, maxSteps: number): fc.Arbitrary<Step<Op>[]> {
  const dev = fc.integer({ min: 0, max: replicas - 1 });
  const opStep = dev.chain((d) => domain.ops(d).map((op): Step<Op> => ({ k: "op", d, op })));
  const pair = fc.tuple(dev, dev);
  const other: fc.Arbitrary<Step<Op>> = fc.oneof(
    pair.chain(([from, to]) => fc.integer({ min: 1, max: 4 }).map((n): Step<Op> => ({ k: "deliver", from, to, n }))),
    pair.chain(([from, to]) => fc.integer({ min: 1, max: 1_000_000 }).map((seed): Step<Op> => ({ k: "shuffle", from, to, seed }))),
    pair.map(([from, to]): Step<Op> => ({ k: "sync", from, to })),
    dev.map((d): Step<Op> => ({ k: "reopen", d })),
  );
  const offline = dev.chain((d) => fc.array(domain.ops(d), { minLength: 3, maxLength: 10 }).map((ops) => ops.map((op): Step<Op> => ({ k: "op", d, op }))));
  const mixed = fc.array(fc.oneof({ weight: 3, arbitrary: opStep }, { weight: 2, arbitrary: other }), { maxLength: maxSteps });
  return fc.tuple(mixed, offline, mixed).map(([a, b, c]) => [...a, ...b, ...c]);
}

/**
 * Własność do `fc.assert`: losowe przebiegi na 2 albo 3 replikach (3 w co trzecim). Porażka rzuca z nazwą własności
 * i pierwszą różnicą; `fast-check` podaje ziarno i skurczone kroki.
 */
export function convergenceProperty<S, Op>(domain: ConvergenceDomain<S, Op>, opts: { maxSteps?: number } = {}) {
  const maxSteps = opts.maxSteps ?? 24;
  return fc.property(
    fc.integer({ min: 0, max: 2 }).chain((r) => { const replicas = r === 2 ? 3 : 2; return stepsArb(domain, replicas, maxSteps).map((steps) => ({ replicas, steps })); }),
    ({ replicas, steps }) => {
      const rep = runScript(domain, steps, replicas);
      if (!rep.ok) throw new Error(`${domain.name}: ${rep.property} — ${rep.detail}`);
    },
  );
}
