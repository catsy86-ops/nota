import { cleanFittings, fittingKey, FITTING_QTY_MAX, type Fitting } from "./fittings";
import { cleanPipes, PIPE_CM_MAX, type Pipe } from "./pipes";

/**
 * Zestawy materiału (H1.2, plan 2026-10-29): nazwana lista kształtek i rur, np. „Podejście umywalki”.
 * Jedno stuknięcie w arkuszu dopisuje cały zestaw do wpisu, a ilości można potem poprawić. Czyste dane;
 * zapis w Yjs w `yKits.ts`, akcje w `kitsStore.ts`.
 */
export interface Kit {
  id: string;
  name: string;
  fittings: Fitting[];
  pipes: Pipe[];
}

export const KIT_NAME_MAX = 40;
export const KITS_MAX = 30;

/**
 * Przykładowe zestawy na start — do zmiany pod własną robotę (nazwy z katalogu PEX/kanalizacja,
 * żeby sumy i ceny pasowały). Pojawiają się, dopóki użytkownik nie zmieni listy.
 */
export const DEFAULT_KITS: readonly Kit[] = [
  {
    id: "kit-umywalka", name: "Podejście umywalki",
    fittings: [{ name: "Kolano naścienne 16", qty: 2 }, { name: "Trójnik 16", qty: 2 }, { name: "Kolano 50/45°", qty: 1 }],
    pipes: [{ name: "Rura PEX 16×2", cm: 300 }, { name: "Rura PVC 50", cm: 100 }],
  },
  {
    id: "kit-wc", name: "Podejście WC (stelaż)",
    fittings: [{ name: "Kolano naścienne 16", qty: 1 }, { name: "Trójnik 16", qty: 1 }, { name: "Kolano 110/87°", qty: 1 }],
    pipes: [{ name: "Rura PEX 16×2", cm: 150 }, { name: "Rura PVC 110", cm: 100 }],
  },
  {
    id: "kit-zlew", name: "Podejście zlewu i zmywarki",
    fittings: [{ name: "Kolano naścienne 16", qty: 2 }, { name: "Trójnik 16", qty: 2 }, { name: "Trójnik 50/87°", qty: 1 }],
    pipes: [{ name: "Rura PEX 16×2", cm: 400 }, { name: "Rura PVC 50", cm: 150 }],
  },
];

/** Dowolne wejście (dokument, kopia, drugi telefon) → zestaw; `null` = bez nazwy albo bez pozycji. */
export function cleanKit(raw: unknown): Kit | null {
  const k = raw as Partial<Kit> | null;
  if (!k || typeof k !== "object" || typeof k.id !== "string" || !k.id || k.id.length > 64) return null;
  const name = typeof k.name === "string" ? k.name.trim().replace(/\s+/g, " ").slice(0, KIT_NAME_MAX) : "";
  const fittings = cleanFittings(k.fittings);
  const pipes = cleanPipes(k.pipes);
  if (!name || (fittings.length === 0 && pipes.length === 0)) return null;
  return { id: k.id, name, fittings, pipes };
}

/**
 * Zestaw dopisany do pozycji wpisu: ta sama nazwa (bez wielkości liter i ogonków) dokłada sztuki albo
 * centymetry, nowe pozycje idą na koniec. Puste wiersze z formularza zostają (czyści je zapis wpisu).
 */
export function applyKit(fittings: readonly Fitting[], pipes: readonly Pipe[], kit: Kit): { fittings: Fitting[]; pipes: Pipe[] } {
  const f = fittings.map((x) => ({ ...x }));
  for (const add of kit.fittings) {
    const i = f.findIndex((x) => x.name && fittingKey(x.name) === fittingKey(add.name));
    if (i >= 0) f[i] = { ...f[i], qty: Math.min(FITTING_QTY_MAX, f[i].qty + add.qty) };
    else f.push({ ...add });
  }
  const p = pipes.map((x) => ({ ...x }));
  for (const add of kit.pipes) {
    const i = p.findIndex((x) => x.name && fittingKey(x.name) === fittingKey(add.name));
    if (i >= 0) p[i] = { ...p[i], cm: Math.min(PIPE_CM_MAX, p[i].cm + add.cm) };
    else p.push({ ...add });
  }
  return { fittings: f, pipes: p };
}

/** „2 kształtki · 4,5 m rur” — podpis pigułki zestawu. */
export function kitSummary(kit: Kit): string {
  const pieces = kit.fittings.reduce((s, f) => s + f.qty, 0);
  const cm = kit.pipes.reduce((s, p) => s + p.cm, 0);
  const parts = [pieces > 0 && `${pieces} szt.`, cm > 0 && `${(cm / 100).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} m rur`].filter(Boolean);
  return parts.join(" · ");
}
