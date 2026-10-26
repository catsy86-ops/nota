import { APP_VERSION } from "@/content/changelog";

/**
 * Numer zmian formatu danych (plan Ustawień 2.1). Rośnie, gdy zmienia się kształt danych (Praca, Ćwiczenia,
 * Terminy, Skarbiec). Urządzenia ogłaszają go w awareness; nowego formatu nie zapisuje się, dopóki wszystkie
 * widziane urządzenia go znają (`canWriteSchema`).
 */
export const SCHEMA_VERSION = 1;

export interface DeviceSchema {
  /** Wersja aplikacji (np. „2026.10.26”); brak u urządzeń sprzed tej zmiany. */
  version?: string;
  /** Numer formatu; brak = urządzenie sprzed tej zmiany, traktowane jak `0`. */
  schema?: number;
}

/** Dane, które każde urządzenie ogłasza w awareness. */
export function localDeviceSchema(): { version: string; schema: number } {
  return { version: APP_VERSION, schema: SCHEMA_VERSION };
}

/** Czy wszystkie widziane urządzenia znają format `required` (więc można go zapisać). */
export function canWriteSchema(required: number, devices: readonly DeviceSchema[]): boolean {
  return devices.every((d) => (d.schema ?? 0) >= required);
}

/** Urządzenia z niższym numerem formatu niż ten w aplikacji — im część danych może być niewidoczna. */
export function olderDevices<T extends DeviceSchema>(devices: readonly T[], current: number = SCHEMA_VERSION): T[] {
  return devices.filter((d) => (d.schema ?? 0) < current);
}
