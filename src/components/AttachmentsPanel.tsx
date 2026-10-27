import { forwardRef, lazy, Suspense, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Mic, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { AttachmentRow } from "@/components/AttachmentsList";
import {
  addAttachmentFiles, describeRejections, formatFileSize, MAX_ATTACHMENT_BYTES, type Attachment,
} from "@/lib/attachments";
import { yjsStore } from "@/lib/yjsStore";
import { cn } from "@/lib/utils";
import { canRecordVoice } from "@/lib/voiceSupport";

export interface AttachmentsPanelHandle {
  /** Otwiera systemowy wybór plików (przycisk w pasku narzędzi edytora). */
  pick: () => void;
  /** Notatka głosowa: zaczyna nagrywanie albo kończy trwające (przycisk mikrofonu w pasku). */
  record: () => void;
}

// Nagrywanie — leniwie, poza główną paczką.
const VoiceRecorder = lazy(() => import("./VoiceAttachmentParts").then((m) => ({ default: m.VoiceRecorder })));

interface Props {
  attachments: Attachment[];
  onChange: (next: Attachment[]) => void;
  /** Pokazuje własny przycisk „Dodaj plik” (gdy edytor nie ma go w pasku narzędzi). */
  showAddButton?: boolean;
  /** Element edytora przyjmujący upuszczone pliki; domyślnie najbliższa karta/composer. */
  dropTargetSelector?: string;
  className?: string;
}

/**
 * Załączniki w edytorze: lista z „Pobierz” / „Usuń” (z „Cofnij”), wybór pliku
 * i upuszczanie plików na cały edytor. Zapis bajtów idzie przez
 * `addAttachmentFiles` (limity, hash, dedup, błąd quota bez utraty danych).
 */
export const AttachmentsPanel = forwardRef<AttachmentsPanelHandle, Props>(function AttachmentsPanel(
  { attachments, onChange, showAddButton = false, dropTargetSelector = "[data-note-id],[data-composer-open]", className },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const latest = useRef(attachments);
  latest.current = attachments;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  // Notatka głosowa: cały mechanizm w leniwym `VoiceRecorder` — tu tylko przełącznik.
  // Wyłączenie (drugie „record()” albo zamknięcie edytora) kończy nagranie, a plik i tak trafia do notatki.
  const [recording, setRecording] = useState(false);

  useImperativeHandle(ref, () => ({ pick: () => inputRef.current?.click(), record: () => setRecording((r) => !r) }));

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const used = new Map<string, number>();
      yjsStore.referencedAttachments().forEach((a, h) => used.set(h, a.size));
      for (const a of latest.current) used.set(a.hash, a.size);
      const { added, rejected } = await addAttachmentFiles(files, { current: latest.current, used });
      if (added.length) {
        const next = [...latest.current, ...added];
        latest.current = next;
        onChangeRef.current(next);
      }
      const problem = describeRejections(rejected);
      if (problem) toast.error(added.length ? "Część plików nie została dodana" : "Nie dodano pliku", { description: problem, duration: 9000 });
    } finally {
      setBusy(false);
    }
  }, []);
  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;

  // Upuszczanie plików na cały edytor (kartę albo composer), nie tylko na listę.
  useEffect(() => {
    const root = rootRef.current;
    const target = (root?.closest(dropTargetSelector) as HTMLElement | null) ?? root?.parentElement;
    if (!target) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setOver(true); };
    const onOver = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; };
    const onLeave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (depth === 0) setOver(false); };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      depth = 0;
      setOver(false);
      void addFiles(Array.from(e.dataTransfer?.files ?? []));
    };
    target.addEventListener("dragenter", onEnter);
    target.addEventListener("dragover", onOver);
    target.addEventListener("dragleave", onLeave);
    target.addEventListener("drop", onDrop);
    return () => {
      target.removeEventListener("dragenter", onEnter);
      target.removeEventListener("dragover", onOver);
      target.removeEventListener("dragleave", onLeave);
      target.removeEventListener("drop", onDrop);
    };
  }, [dropTargetSelector, addFiles]);

  function remove(a: Attachment) {
    const before = latest.current;
    const index = before.findIndex((x) => x.hash === a.hash);
    if (index < 0) return;
    const next = before.filter((x) => x.hash !== a.hash);
    latest.current = next;
    onChange(next);
    // Bajty zostają w store (GC sprząta tylko nieużywane i starsze niż karencja),
    // więc „Cofnij” przywraca wpis bez ponownego wczytywania pliku.
    toast(`Usunięto załącznik „${a.name}”`, {
      duration: 7000,
      action: {
        label: "Cofnij",
        onClick: () => {
          if (latest.current.some((x) => x.hash === a.hash)) return;
          const cur = [...latest.current];
          cur.splice(Math.min(index, cur.length), 0, a);
          latest.current = cur;
          onChangeRef.current(cur);
        },
      },
    });
  }

  const empty = attachments.length === 0;
  if (empty && !showAddButton && !over && !recording) {
    return (
      <div ref={rootRef} className="hidden">
        <input ref={inputRef} data-testid="attachment-input" type="file" multiple className="hidden" onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      data-testid="attachments-panel"
      onClick={(e) => e.stopPropagation()}
      className={cn("space-y-1.5 rounded-card", over && "outline-solid outline-2 outline-dashed outline-primary/60 outline-offset-2 bg-primary/5", className)}
    >
      <input ref={inputRef} data-testid="attachment-input" type="file" multiple className="hidden" onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      {!empty && (
        <ul className="space-y-1.5" aria-label="Załączniki">
          {attachments.map((a) => <AttachmentRow key={a.hash} attachment={a} onRemove={remove} />)}
        </ul>
      )}
      {over && <p className="text-center text-xs text-primary-ink py-1">Upuść plik, aby dodać go do notatki</p>}
      {recording && <Suspense fallback={null}><VoiceRecorder onFile={(f) => void addFilesRef.current([f])} onClose={() => setRecording(false)} /></Suspense>}
      {showAddButton && (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="pressable inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title={`Maks. ${formatFileSize(MAX_ATTACHMENT_BYTES)} na plik`}
        >
          <Paperclip className="w-3.5 h-3.5" aria-hidden />
          {busy ? "Dodawanie…" : "Dodaj plik"}
        </button>
      )}
      {showAddButton && !recording && canRecordVoice() && (
        <button
          type="button"
          disabled={busy}
          onClick={() => setRecording(true)}
          className="pressable ml-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="Notatka głosowa, do 3 minut"
        >
          <Mic className="w-3.5 h-3.5" aria-hidden />
          Nagraj
        </button>
      )}
    </div>
  );
});
