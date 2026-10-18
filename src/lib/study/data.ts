import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import { logDiag } from "@/lib/diagnostics";
import { STUDY_STORAGE_KEY } from "./keys";
import { createYStudy, dumpFromLegacy } from "./yStudy";

/**
 * Jedna instancja Nauki w dokumencie notatek. Bez materiału do nauki — tę część
 * importują odśmiecanie zdjęć i kopia zapasowa z głównej paczki; `store.ts`
 * (z materiałem) jest fasadą dla widoków /nauka.
 */
export const yStudy = createYStudy(yjsStore.doc);

const DEVICE_KEY = `${STUDY_STORAGE_KEY}.device`;
let memoryDevice: string | null = null;

/** Id tego urządzenia dla licznika rund (stały między sesjami). */
export function studyDevice(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = `dev-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`; localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch {
    memoryDevice ??= `dev-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    return memoryDevice;
  }
}

/** Czy stary zapis tego urządzenia jest już w dokumencie (wtedy jego zdjęcia chroni dokument). */
export function legacyStudyMerged(): boolean {
  try { return yStudy.isMerged(studyDevice()); } catch (err) {
    // Błąd tu oznacza, że nie wiemy, czy zdjęcia są chronione — zostawiamy ślad, zamiast zgadywać po cichu.
    logDiag("warn", "study", "błąd scalania starego zapisu", err);
    return false;
  }
}

/**
 * Przenosi stary zapis do dokumentu — raz na urządzenie, scalając z tym, co
 * już przyszło z innych urządzeń. Znacznik siedzi w dokumencie (jak w Grafiku):
 * flaga w localStorage zapisana przed zrzutem do IndexedDB zgubiłaby dziennik.
 * Stary klucz zostaje jako kopia.
 */
function migrateFromLocalStorage(): void {
  try {
    const raw = localStorage.getItem(STUDY_STORAGE_KEY);
    if (!raw) return;
    const device = studyDevice();
    if (yStudy.isMerged(device)) return;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { parsed = undefined; }
    if (parsed === undefined) {
      logDiag("error", "study", `uszkodzony stary zapis Nauki — zostaje w ${STUDY_STORAGE_KEY}`);
      return;
    }
    yStudy.mergeIn(dumpFromLegacy(parsed, device), device);
    logDiag("info", "study", "Nauka przeniesiona z localStorage do Yjs");
  } catch (err) {
    logDiag("error", "study", "migracja Nauki nie powiodła się", err);
  }
}

let readyPromise: Promise<void> | null = null;
let ready = false;
const readyListeners = new Set<() => void>();

/** Czeka na wczytanie dokumentu i migrację (widok, testy, kopia zapasowa). */
export function studyReady(): Promise<void> {
  readyPromise ??= yjsStore.ready().then(() => {
    migrateFromLocalStorage();
    ready = true;
    readyListeners.forEach((l) => l());
  });
  return readyPromise;
}

/** Czy dokument jest już wczytany — wcześniej widok pokazałby pustą Naukę. */
export const useStudyReady = () => useSyncExternalStore(
  (cb) => { readyListeners.add(cb); return () => readyListeners.delete(cb); },
  () => ready,
);

/** Test-only: po `yjsStore.resetForTests()` migracja ma znów się wykonać. */
export function resetStudyForTests(): void {
  readyPromise = null;
}

// Migracja przy starcie aplikacji, nie dopiero na /nauka — inaczej dziennik
// nie poszedłby do innych urządzeń, dopóki ktoś nie otworzy Nauki.
void studyReady();
