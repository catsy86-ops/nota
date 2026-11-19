import { lazy, Suspense } from "react";
import { Mic, X } from "lucide-react";
import { formatFileSize } from "@/lib/attachments";
import type { JournalDraft } from "@/lib/study/draft";

/** Odtwarzacz i nagrywanie leniwie, poza główną paczką (jak w notatkach). */
const VoiceRecorder = lazy(() => import("@/components/VoiceAttachmentParts").then((m) => ({ default: m.VoiceRecorder })));
const AudioPreview = lazy(() => import("@/components/VoiceAttachmentParts").then((m) => ({ default: m.AudioPreview })));

/** Nagrania wpisu (R2.1): rejestrator w trakcie nagrywania i lista nagrań z odsłuchem i usuwaniem. */
export function EntryRecordings(p: {
  recording: boolean;
  onCloseRecorder: () => void;
  recordings: JournalDraft["recordings"];
  onFile: (file: File) => void;
  onTranscript: (text: string) => void;
  onRemove: (hash: string) => void;
}) {
  return (
    <>
      {p.recording && (
        <Suspense fallback={null}>
          <VoiceRecorder onFile={p.onFile} onClose={p.onCloseRecorder} onTranscript={p.onTranscript} />
        </Suspense>
      )}
      {p.recordings.length > 0 && (
        <ul className="space-y-2" aria-label="Nagrania we wpisie">
          {p.recordings.map((a) => (
            <li key={a.hash} className="rounded-field border border-border px-2.5 py-2">
              <div className="flex items-center gap-2 text-sm">
                <Mic className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">{formatFileSize(a.size)}</span>
                <button
                  type="button"
                  onClick={() => p.onRemove(a.hash)}
                  aria-label={`Usuń nagranie: ${a.name}`}
                  className="pressable grid size-8 shrink-0 place-items-center rounded-field text-muted-foreground hover:bg-muted hover:text-foreground coarse:size-11"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
              <Suspense fallback={null}><AudioPreview attachment={a} /></Suspense>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
