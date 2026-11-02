import { hasDictationConsent } from "@/hooks/useDictation";
import { DICTATION_LANG, localSpeechReady, speechRecognitionCtor as ctor, type SpeechRecognitionLike as Rec } from "./localSpeech";

/**
 * H6.2 Tekst na żywo podczas nagrania: rozpoznawanie mowy obok `MediaRecorder`. Nie sprawdzone na
 * telefonie — część Androidów nie daje mikrofonu dwóm odbiorcom naraz — dlatego to przełącznik,
 * domyślnie wyłączony. Błąd rozpoznawania wyłącza tekst, nagranie trwa dalej. Ładowane razem
 * z paskiem nagrywania (`VoiceAttachmentParts.tsx`).
 */

const KEY = "kaczy.voice.liveText.v1";

export function liveTextWanted(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function setLiveTextWanted(on: boolean): void {
  try { if (on) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch { /* bez localStorage tylko na tę sesję */ }
}

/**
 * Jak rozpoznawać teraz: „local” (polski na urządzeniu), „cloud” (usługa przeglądarki — tylko
 * z internetem i zgodą na dyktowanie) albo `null` (nie da się — przełącznika nie ma).
 */
export function transcriptMode(): "local" | "cloud" | null {
  if (!ctor()) return null;
  if (localSpeechReady()) return "local";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  return hasDictationConsent() ? "cloud" : null;
}

/** Restartów po ciszy (Chrome kończy sesję po kilku sekundach) — dalej bez tekstu. */
const RESTARTS_MAX = 60;

/**
 * Zaczyna rozpoznawanie; zdania idą do `onText`. `onFail` raz, gdy rozpoznawanie przestało działać
 * (np. mikrofon zajęty) — wtedy już się nie wznawia. `null` = nie da się zacząć.
 */
export function startTranscript(onText: (text: string) => void, onFail: (error: string) => void): { stop: () => void } | null {
  const Ctor = ctor();
  const mode = transcriptMode();
  if (!Ctor || !mode) return null;
  let stopped = false;
  let failed = false;
  let restarts = 0;
  let rec: Rec | null = null;
  const fail = (error: string) => { if (failed || stopped) return; failed = true; onFail(error); };
  const run = () => {
    const r = new Ctor();
    r.lang = DICTATION_LANG;
    r.continuous = true;
    r.interimResults = false;
    if (mode === "local") r.processLocally = true;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i].isFinal ? e.results[i][0].transcript.trim() : "";
        if (t) onText(t);
      }
    };
    r.onerror = (e) => { if (e.error !== "no-speech" && e.error !== "aborted") fail(e.error); };
    r.onend = () => {
      rec = null;
      if (stopped || failed) return;
      if (restarts++ >= RESTARTS_MAX) { fail("limit"); return; }
      run();
    };
    rec = r;
    try { r.start(); } catch { fail("start"); }
  };
  run();
  return { stop: () => { stopped = true; rec?.stop(); } };
}
