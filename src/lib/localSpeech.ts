/**
 * H6.1 Dyktowanie bez internetu: rozpoznawanie mowy na urządzeniu w Chrome (Web Speech API,
 * `SpeechRecognition.available` / `install` i `processLocally`). Bez tego zostaje dyktowanie przez
 * usługę przeglądarki.
 *
 * **Pułapka:** w części wersji Chromium samo `available()` wywraca kartę (sprawdzone w Chromium
 * testów 2026-11-02). Dlatego aplikacja nigdy nie pyta sama — tylko po stuknięciu w Ustawieniach,
 * a wynik („polski jest na urządzeniu”) trzyma we fladze `kaczy.dictation.local.v1`. Dyktowanie
 * czyta wyłącznie flagę; błąd lokalnego rozpoznawania ją zdejmuje.
 */

/** Minimalny kształt Web Speech API — brak typów w lib.dom. Wspólny dla dyktowania i tekstu na żywo. */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  /** H6.1: rozpoznawanie na urządzeniu (Chrome z pobranym językiem). */
  processLocally?: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type LocalSpeechStatus = "unsupported" | "unavailable" | "downloadable" | "downloading" | "available";

interface Options { langs: string[]; processLocally: boolean }
interface LocalSpeechApi {
  available(o: Options): Promise<string>;
  install(o: Options): Promise<boolean>;
}

export const DICTATION_LANG = "pl-PL";
const FLAG = "kaczy.dictation.local.v1";
const KNOWN = new Set<LocalSpeechStatus>(["unavailable", "downloadable", "downloading", "available"]);

function api(): LocalSpeechApi | null {
  const c = speechRecognitionCtor() as unknown as Partial<LocalSpeechApi> | null;
  return c && typeof c.available === "function" && typeof c.install === "function" ? (c as LocalSpeechApi) : null;
}

/** Czy przeglądarka w ogóle ma API rozpoznawania na urządzeniu (bez wywoływania go). */
export const hasLocalSpeechApi = () => api() !== null;

/** Polski potwierdzony na urządzeniu (flaga z Ustawień). Bez pytania przeglądarki. */
export function localSpeechReady(): boolean {
  if (!api()) return false;
  try { return localStorage.getItem(FLAG) === "1"; } catch { return false; }
}

export function setLocalSpeechReady(on: boolean): void {
  try { if (on) localStorage.setItem(FLAG, "1"); else localStorage.removeItem(FLAG); } catch { /* bez localStorage — tylko usługa przeglądarki */ }
}

/**
 * Pyta przeglądarkę, czy polski jest na urządzeniu — **tylko po stuknięciu** (patrz pułapka wyżej).
 * Ustawia flagę zgodnie z odpowiedzią. Błąd albo nieznana odpowiedź = „unavailable”.
 */
export async function localSpeechStatus(lang = DICTATION_LANG): Promise<LocalSpeechStatus> {
  const a = api();
  if (!a) return "unsupported";
  let st: LocalSpeechStatus;
  try {
    const r = await a.available({ langs: [lang], processLocally: true });
    st = KNOWN.has(r as LocalSpeechStatus) ? (r as LocalSpeechStatus) : "unavailable";
  } catch {
    st = "unavailable";
  }
  setLocalSpeechReady(st === "available");
  return st;
}

/** Pobiera model języka na urządzenie (wymaga internetu). `true` = gotowe do dyktowania offline. */
export async function installLocalSpeech(lang = DICTATION_LANG): Promise<boolean> {
  const a = api();
  if (!a) return false;
  try { await a.install({ langs: [lang], processLocally: true }); } catch { /* stan i tak sprawdzamy niżej */ }
  return (await localSpeechStatus(lang)) === "available";
}
