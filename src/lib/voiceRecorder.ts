/**
 * Notatka głosowa: nagranie z mikrofonu jako plik do załączenia. Moduł ładowany leniwie
 * (dopiero po „Nagraj”), żeby nie obciążać startu aplikacji.
 *
 * Nagranie trwa najwyżej 3 min. Przy 32 kb/s to ok. 0,7 MB, więc mieści się w limicie
 * synchronizacji załączników (`ATTACHMENT_SYNC_MAX_BYTES`, 2 MB) i trafia na inne urządzenia.
 */
export const VOICE_MAX_MS = 3 * 60 * 1000;
const BITRATE = 32_000;

/** Formaty w kolejności: Opus w WebM (Chrome/Android), AAC w MP4 (Safari/iPhone). */
const CANDIDATES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];

/** Pierwszy obsługiwany format; `""` = przeglądarka wybierze sama. */
export function pickAudioType(isSupported: (type: string) => boolean): string {
  return CANDIDATES.find((t) => isSupported(t)) ?? "";
}

/** „Nagranie 2026-10-18 14-52.webm” — data i godzina w nazwie, bez dwukropków (Windows). */
export function voiceFileName(at: Date, type: string): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const ext = type.startsWith("audio/mp4") ? "m4a" : type.startsWith("audio/ogg") ? "ogg" : "webm";
  return `Nagranie ${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())} ${p(at.getHours())}-${p(at.getMinutes())}.${ext}`;
}

export interface VoiceSession {
  /** Kończy nagranie; plik przychodzi w `onDone`. */
  stop: () => void;
}

/**
 * Zaczyna nagrywanie. `onDone(file)` dostaje plik po zatrzymaniu (ręcznie albo po 3 min),
 * `null`, gdy nic się nie nagrało. Mikrofon jest zwalniany po zakończeniu.
 * Rzuca, gdy brak zgody na mikrofon albo mikrofonu (`NotAllowedError`, `NotFoundError`).
 */
export async function startVoiceRecording(onDone: (file: File | null) => void): Promise<VoiceSession> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const type = pickAudioType((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: BITRATE });
  const chunks: Blob[] = [];
  const startedAt = new Date();
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = () => {
    clearTimeout(limit);
    stream.getTracks().forEach((t) => t.stop());
    const mime = (recorder.mimeType || type || "audio/webm").split(";")[0];
    const blob = new Blob(chunks, { type: mime });
    onDone(blob.size > 0 ? new File([blob], voiceFileName(startedAt, mime), { type: mime }) : null);
  };
  recorder.start(1000);
  const limit = setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, VOICE_MAX_MS);
  return { stop: () => { if (recorder.state !== "inactive") recorder.stop(); } };
}

/** Komunikat dla użytkownika po nieudanym starcie nagrywania. */
export function voiceErrorMessage(err: unknown): string {
  const name = (err as { name?: string } | null)?.name;
  if (name === "NotAllowedError") return "Brak zgody na mikrofon — włącz ją w ustawieniach przeglądarki";
  if (name === "NotFoundError") return "Nie znaleziono mikrofonu";
  return "Nie udało się zacząć nagrywania";
}
