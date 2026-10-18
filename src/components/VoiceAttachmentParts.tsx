import { useEffect, useRef, useState } from "react";
import { Square } from "lucide-react";
import { toast } from "sonner";
import { readAttachment, type Attachment } from "@/lib/attachments";
import { startVoiceRecording, voiceErrorMessage, type VoiceSession } from "@/lib/voiceRecorder";

/**
 * Części notatki głosowej ładowane leniwie (poza główną paczką): odtwarzacz nagrania
 * na liście załączników i pasek trwającego nagrywania w panelu.
 */

/** Odtwarzacz nagrania: bajty z magazynu → adres `blob:` zwalniany przy odmontowaniu. */
export function AudioPreview({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void readAttachment(attachment.hash).then((bytes) => {
      if (!alive || !bytes) return;
      made = URL.createObjectURL(new Blob([bytes], { type: attachment.type || "audio/webm" }));
      setUrl(made);
    }).catch(() => {});
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [attachment.hash, attachment.type]);
  if (!url) return null;
  return <audio controls preload="metadata" src={url} className="mt-1.5 h-9 w-full" data-testid="attachment-audio" aria-label={`Odtwórz ${attachment.name}`} />;
}

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

/** Pasek trwającego nagrywania: czas od startu z limitem 3 min i „Zatrzymaj”. */
function RecordingBar({ since, onStop }: { since: number; onStop: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div role="status" data-testid="voice-recording" className="flex items-center gap-2 rounded-lg border border-destructive/40 px-2.5 py-1.5 text-xs">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" aria-hidden />
      <span className="flex-1 font-mono tabular-nums">Nagrywanie {clock(Math.max(0, now - since))} / 3:00</span>
      <button type="button" onClick={onStop} className="pressable inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-destructive-ink hover:bg-destructive/10 coarse:min-h-11">
        <Square className="h-3 w-3 fill-current" aria-hidden /> Zatrzymaj
      </button>
    </div>
  );
}

/**
 * Nagrywanie od zamontowania do „Zatrzymaj”, limitu 3 min albo odmontowania (np. zamknięcie edytora).
 * Nagrany plik idzie do `onFile`; po zakończeniu albo błędzie zawsze `onClose`.
 */
export function VoiceRecorder({ onFile, onClose }: { onFile: (file: File) => void; onClose: () => void }) {
  const [since, setSince] = useState<number | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);
  const cb = useRef({ onFile, onClose });
  cb.current = { onFile, onClose };
  useEffect(() => {
    let cancelled = false;
    startVoiceRecording((file) => {
      sessionRef.current = null;
      // Anulowana pusta sesja (podwójny efekt w trybie deweloperskim) — bez komunikatu i bez zamykania.
      if (cancelled && !file) return;
      if (file) cb.current.onFile(file);
      else toast.error("Nic się nie nagrało — sprawdź mikrofon");
      cb.current.onClose();
    })
      .then((session) => {
        if (cancelled) { session.stop(); return; }
        sessionRef.current = session;
        setSince(Date.now());
      })
      .catch((err) => { toast.error(voiceErrorMessage(err)); cb.current.onClose(); });
    return () => { cancelled = true; sessionRef.current?.stop(); };
  }, []);
  if (since === null) return null;
  return <RecordingBar since={since} onStop={() => sessionRef.current?.stop()} />;
}
