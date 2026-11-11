/**
 * Odczyt tagu NFC (naklejka na budowie, w aucie, na pudełku). B3.11.
 * Web NFC: globalny `NDEFReader` (Chrome na Androidzie, tylko https i po geście użytkownika). Nie ma `navigator.nfc`.
 */
import { cleanCode } from "@/lib/barcode";

interface NdefRecordLike {
  recordType: string;
  data?: DataView;
  encoding?: string;
}

export interface NdefReadingEvent {
  serialNumber?: string;
  message?: { records?: readonly NdefRecordLike[] };
}

interface NdefReaderLike {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  onreading: ((event: NdefReadingEvent) => void) | null;
  onreadingerror: (() => void) | null;
}

declare global {
  interface Window {
    NDEFReader?: new () => NdefReaderLike;
  }
}

export const hasNFC = (): boolean => typeof window !== "undefined" && typeof window.NDEFReader === "function";

const decode = (data: DataView, encoding = "utf-8"): string => {
  try { return new TextDecoder(encoding).decode(data); } catch { return new TextDecoder().decode(data); }
};

/**
 * Wartość z odczytanego tagu: pierwszy rekord tekstowy albo adres, a gdy tag nie ma danych NDEF — jego numer
 * seryjny (unikalny dla naklejki, więc wystarcza do rozpoznania). Dane w Web NFC są już bez bajtu flag. `null` = pusty tag.
 */
export function tagValue(event: NdefReadingEvent): string | null {
  for (const r of event.message?.records ?? []) {
    if ((r.recordType === "text" || r.recordType === "url" || r.recordType === "absolute-url") && r.data) {
      const text = cleanCode(decode(r.data, r.recordType === "text" ? r.encoding : "utf-8"));
      if (text) return text;
    }
  }
  const serial = cleanCode(event.serialNumber ?? "");
  return serial || null;
}

export type NfcResult = { ok: true; value: string } | { ok: false; reason: "unsupported" | "denied" | "empty" | "aborted" | "timeout" | "error" };

/** Czeka na przyłożenie tagu i zwraca jego wartość; `signal` przerywa (zamknięcie okna), `timeoutMs` kończy czekanie. */
export async function readNFCTag(signal?: AbortSignal, timeoutMs = 30_000): Promise<NfcResult> {
  if (!hasNFC() || !window.NDEFReader) return { ok: false, reason: "unsupported" };
  const reader = new window.NDEFReader();
  const stop = new AbortController();
  const onAbort = () => stop.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await new Promise<NfcResult>((resolve) => {
      const timer = setTimeout(() => { stop.abort(); resolve({ ok: false, reason: "timeout" }); }, timeoutMs);
      // Najpierw wynik, potem przerwanie nasłuchu — przerwanie samo też rozwiązuje obietnicę (jako „timeout”).
      const done = (r: NfcResult) => { clearTimeout(timer); resolve(r); stop.abort(); };
      reader.onreading = (e) => { const value = tagValue(e); done(value ? { ok: true, value } : { ok: false, reason: "empty" }); };
      reader.onreadingerror = () => done({ ok: false, reason: "empty" });
      stop.signal.addEventListener("abort", () => resolve({ ok: false, reason: signal?.aborted ? "aborted" : "timeout" }), { once: true });
      reader.scan({ signal: stop.signal }).catch((e: unknown) => {
        const name = (e as { name?: string } | null)?.name;
        done({ ok: false, reason: name === "NotAllowedError" ? "denied" : name === "AbortError" ? "aborted" : "error" });
      });
    });
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}
