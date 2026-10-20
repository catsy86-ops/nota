import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/** Minimalny kształt Web Speech API — brak typów w lib.dom. */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type Ctor = new () => SpeechRecognitionLike;

function getCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const CONSENT_KEY = "kaczy.dictation.consent";

/** Czy użytkownik zgodził się na dyktowanie (usługa przeglądarki). */
export function hasDictationConsent(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === "1"; } catch { return false; }
}

/** Cofa zgodę: następne dyktowanie znowu zapyta. Nie rusza uprawnienia mikrofonu w przeglądarce. */
export function withdrawDictationConsent(): void {
  try { localStorage.removeItem(CONSENT_KEY); } catch { /* bez localStorage nie ma czego cofać */ }
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Brak zgody na mikrofon. Zezwól na nią w ustawieniach przeglądarki.",
  "service-not-allowed": "Przeglądarka zablokowała rozpoznawanie mowy.",
  "no-speech": "Nic nie usłyszałem — spróbuj jeszcze raz.",
  "audio-capture": "Nie znaleziono mikrofonu.",
  network: "Rozpoznawanie mowy wymaga połączenia z internetem.",
};

/**
 * Dyktowanie przez Web Speech API. W Chrome nagranie jest wysyłane do usługi
 * rozpoznawania mowy Google, więc przy pierwszym użyciu pokazujemy to wprost
 * i zapamiętujemy zgodę na tym urządzeniu.
 */
export function useDictation(onText: (text: string) => void) {
  const supported = getCtor() !== null;
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stop = useCallback(() => { recRef.current?.stop(); }, []);

  const begin = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "pl-PL";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onTextRef.current(r[0].transcript.trim());
      }
    };
    rec.onerror = (e) => {
      if (e.error !== "aborted") toast.error(ERRORS[e.error] ?? "Dyktowanie nie powiodło się");
    };
    rec.onend = () => { setListening(false); recRef.current = null; };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }, []);

  const toggle = useCallback(() => {
    if (recRef.current) { stop(); return; }
    if (!hasDictationConsent()) {
      toast("Dyktowanie używa usługi przeglądarki", {
        description: "W Chrome nagranie głosu jest wysyłane do rozpoznawania mowy Google. Notatki zostają na urządzeniu.",
        duration: 12000,
        action: {
          label: "Rozumiem, dyktuj",
          onClick: () => {
            try { localStorage.setItem(CONSENT_KEY, "1"); } catch { /* ignore */ }
            begin();
          },
        },
      });
      return;
    }
    begin();
  }, [begin, stop]);

  useEffect(() => () => { recRef.current?.abort(); }, []);

  return { supported, listening, toggle };
}
