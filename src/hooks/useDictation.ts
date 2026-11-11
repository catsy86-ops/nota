import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { localSpeechReady, setLocalSpeechReady, speechRecognitionCtor as getCtor, type SpeechRecognitionLike } from "@/lib/localSpeech";

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
  "language-not-supported": "Polski nie jest już na urządzeniu — dyktuj z internetem albo pobierz go w Ustawienia → Ogólne.",
};

/**
 * Dyktowanie przez Web Speech API. W Chrome nagranie jest wysyłane do usługi
 * rozpoznawania mowy Google, więc przy pierwszym użyciu pokazujemy to wprost
 * i zapamiętujemy zgodę na tym urządzeniu. H6.1: gdy polski jest potwierdzony na urządzeniu
 * (flaga z Ustawień, `localSpeech.ts`), dyktowanie idzie lokalnie — bez internetu i bez zgody na usługę.
 */
export function useDictation(onText: (text: string) => void) {
  const supported = getCtor() !== null;
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stop = useCallback(() => { recRef.current?.stop(); }, []);

  const begin = useCallback((local: boolean) => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "pl-PL";
    if (local) rec.processLocally = true;
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onTextRef.current(r[0].transcript.trim());
      }
    };
    rec.onerror = (e) => {
      // Lokalne rozpoznawanie zawiodło (np. model usunięty) — następne dyktowanie przez usługę przeglądarki.
      if (local && e.error !== "aborted" && e.error !== "no-speech") setLocalSpeechReady(false);
      if (e.error !== "aborted") toast.error(ERRORS[e.error] ?? "Dyktowanie nie powiodło się");
    };
    // Stary obiekt może zakończyć się po starcie nowego — wtedy nie wolno zgubić referencji do aktywnego nasłuchu.
    rec.onend = () => { setListening(false); if (recRef.current === rec) recRef.current = null; };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }, []);

  const toggle = useCallback(() => {
    if (recRef.current) { stop(); return; }
    if (localSpeechReady()) { begin(true); return; }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast.error("Bez internetu dyktowanie wymaga pobranego polskiego", {
        description: "Ustawienia → Ogólne → Dyktowanie głosem: „Sprawdź i pobierz polski”, gdy będziesz w sieci.",
      });
      return;
    }
    if (!hasDictationConsent()) {
      toast("Dyktowanie używa usługi przeglądarki", {
        description: "W Chrome nagranie głosu jest wysyłane do rozpoznawania mowy Google. Notatki zostają na urządzeniu.",
        duration: 12000,
        action: {
          label: "Rozumiem, dyktuj",
          onClick: () => {
            try { localStorage.setItem(CONSENT_KEY, "1"); } catch { /* ignore */ }
            begin(false);
          },
        },
      });
      return;
    }
    begin(false);
  }, [begin, stop]);

  useEffect(() => () => { recRef.current?.abort(); }, []);

  return { supported, listening, toggle, stop };
}
