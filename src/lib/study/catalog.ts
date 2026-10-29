import { useSyncExternalStore } from "react";
import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Katalog systemów instalacji (H1.5, plan 2026-10-29): pigułki rur i kształtek dla wybranego systemu
 * i średnicy, zawsze w tej samej pisowni — dzięki temu sumy w raporcie, zamówienie i ceny w „Zużyciu
 * materiału” łączą te same pozycje. Nazwy PEX zostają jak dotąd („Kolano 16”, „Rura PEX 16×2”), więc
 * historia wpisów i zapisane ceny pasują. Inne systemy mają znacznik w nazwie („Kolano PP 20”,
 * „Kolano Cu 15”), żeby kolano 20 z PEX-a i z PP nie sumowały się razem.
 */

export type PipeSystem = "pex" | "pp" | "cu" | "kan";

export interface SystemDef {
  id: PipeSystem;
  /** Pełna nazwa (podpowiedź, czytnik ekranu). */
  label: string;
  /** Krótka etykieta pigułki. */
  short: string;
  /** Średnice od najmniejszej (mm, jak w opisie rury). */
  sizes: readonly string[];
  pipe: (size: string) => string;
  fittings: (size: string) => string[];
}

/** Grubość ścianki rur PEX/PE-RT w typowych wymiarach (opis „16×2”). */
const PEX_WALL: Readonly<Record<string, string>> = { "16": "16×2", "20": "20×2", "26": "26×3", "32": "32×3" };

export const SYSTEMS: readonly SystemDef[] = [
  {
    id: "pex", label: "PEX / PE-RT (zaprasowywany)", short: "PEX", sizes: ["16", "20", "26", "32"],
    pipe: (s) => `Rura PEX ${PEX_WALL[s] ?? s}`,
    fittings: (s) => [`Kolano ${s}`, `Trójnik ${s}`, `Złączka ${s}`, `Kolano naścienne ${s}`],
  },
  {
    id: "pp", label: "PP (zgrzewany)", short: "PP", sizes: ["20", "25", "32", "40"],
    pipe: (s) => `Rura PP ${s}`,
    fittings: (s) => [`Kolano PP ${s}`, `Trójnik PP ${s}`, `Mufa PP ${s}`, `Kolano PP ${s}/45°`],
  },
  {
    id: "cu", label: "Miedź", short: "Cu", sizes: ["15", "18", "22", "28"],
    pipe: (s) => `Rura Cu ${s}`,
    fittings: (s) => [`Kolano Cu ${s}`, `Trójnik Cu ${s}`, `Mufa Cu ${s}`],
  },
  {
    id: "kan", label: "Kanalizacja (PVC/PP)", short: "Kan.", sizes: ["50", "75", "110", "160"],
    pipe: (s) => `Rura PVC ${s}`,
    fittings: (s) => [`Kolano ${s}/45°`, `Kolano ${s}/87°`, `Trójnik ${s}/87°`, `Mufa kan. ${s}`],
  },
];

export const systemDef = (id: PipeSystem): SystemDef => SYSTEMS.find((s) => s.id === id) ?? SYSTEMS[0];

/** Rury systemu we wszystkich średnicach — pigułki w polu „Rury”. */
export const catalogPipes = (id: PipeSystem): string[] => { const d = systemDef(id); return d.sizes.map(d.pipe); };

/** Kształtki systemu dla średnicy; nieznana średnica → pierwsza z systemu. */
export function catalogFittings(id: PipeSystem, size: string): string[] {
  const d = systemDef(id);
  return d.fittings(d.sizes.includes(size) ? size : d.sizes[0]);
}

/** Wybór na urządzeniu: system i średnica kształtek. Telefon pamięta ostatni wybór między wpisami. */
export interface CatalogPrefs {
  system: PipeSystem;
  size: string;
}

const DEFAULT_PREFS: CatalogPrefs = { system: "pex", size: "16" };

export function cleanCatalogPrefs(_d: CatalogPrefs, raw: unknown): CatalogPrefs {
  const r = raw as Partial<CatalogPrefs> | null;
  const def = SYSTEMS.find((s) => s.id === r?.system);
  if (!def) return DEFAULT_PREFS;
  const size = typeof r?.size === "string" && def.sizes.includes(r.size) ? r.size : def.sizes[0];
  return { system: def.id, size };
}

const store = createPersistedStore<CatalogPrefs>("kaczy.study.catalog.v1", DEFAULT_PREFS, { merge: cleanCatalogPrefs });

export const useCatalogPrefs = () => useSyncExternalStore(store.subscribe, store.get);

/** Zmiana systemu ustawia jego pierwszą średnicę, chyba że podano inną z tego systemu. */
export function setCatalogPrefs(next: Partial<CatalogPrefs>) {
  const cur = store.get();
  const system = next.system ?? cur.system;
  const size = next.size ?? (system === cur.system ? cur.size : systemDef(system).sizes[0]);
  store.set(cleanCatalogPrefs(DEFAULT_PREFS, { system, size }));
}
