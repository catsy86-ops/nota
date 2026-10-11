import { useState } from "react";
import { Archive, Download, File as FileIcon, FileImage, FileSpreadsheet, FileText, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { IconButton } from "@/components/ui/icon-button";
import { useAttachmentBlob } from "@/hooks/useAttachmentBlob";
import {
  attachmentKind, downloadAttachment, formatFileSize, isAttachmentSyncable, isTextPreviewable,
  readAttachment, textPreview, type Attachment, type AttachmentKind,
} from "@/lib/attachments";
import { cn } from "@/lib/utils";

const ICONS: Record<AttachmentKind, typeof FileIcon> = {
  pdf: FileText,
  text: FileText,
  image: FileImage,
  sheet: FileSpreadsheet,
  archive: Archive,
  doc: FileText,
  other: FileIcon,
};

const KIND_LABEL: Record<AttachmentKind, string> = {
  pdf: "PDF", text: "Tekst", image: "Obraz", sheet: "Arkusz", archive: "Archiwum", doc: "Dokument", other: "Plik",
};

/** Mały znacznik „📎 N” na kaflu — nic nie renderuje bez załączników. */
export function AttachmentsBadge({ attachments, className }: { attachments?: Attachment[]; className?: string }) {
  const n = attachments?.length ?? 0;
  if (!n) return null;
  return (
    <span
      data-testid="attachments-badge"
      title={`Załączniki: ${n}`}
      aria-label={`Załączniki: ${n}`}
      className={cn("inline-flex items-center gap-1 rounded-full bg-foreground/5 px-1.5 py-0.5 text-2xs font-medium text-muted-foreground", className)}
    >
      <Paperclip className="w-3 h-3" aria-hidden />
      {n}
    </span>
  );
}

async function handleDownload(a: Attachment) {
  try {
    const ok = await downloadAttachment(a);
    if (!ok) toast.error("Pliku nie ma na tym urządzeniu", { description: "Został dodany na innym urządzeniu i tu jeszcze nie dotarł." });
  } catch {
    toast.error("Nie udało się pobrać pliku");
  }
}

interface RowProps {
  attachment: Attachment;
  /** Brak = widok tylko do odczytu (czytnik). */
  onRemove?: (a: Attachment) => void;
  children?: React.ReactNode;
}

/** Jeden załącznik: ikona wg typu, nazwa, rozmiar, notka o dostępności, akcje. */
export function AttachmentRow({ attachment: a, onRemove, children }: RowProps) {
  const kind = attachmentKind(a);
  const Icon = ICONS[kind];
  const blob = useAttachmentBlob(a.hash);
  const local = !isAttachmentSyncable(a);
  const note = blob === "missing"
    ? (local ? "Plik został dodany na innym urządzeniu i tu nie dotrze" : "Pliku nie ma jeszcze na tym urządzeniu")
    : local ? "Plik jest tylko na tym urządzeniu" : null;

  return (
    <li data-testid="attachment-row" data-attachment-name={a.name} className="rounded-lg border border-border/60 bg-background/50 px-2 py-1.5">
      <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground" title={a.name}>{a.name}</p>
        <p className="truncate text-2xs text-muted-foreground">
          <span>{KIND_LABEL[kind]}</span> · <span data-testid="attachment-size">{formatFileSize(a.size)}</span>
          {note && <> · <span data-testid="attachment-note">{note}</span></>}
        </p>
      </div>
      <IconButton
        size="sm"
        disabled={blob === "missing"}
        onClick={(e) => { e.stopPropagation(); void handleDownload(a); }}
        title="Pobierz"
        aria-label={`Pobierz ${a.name}`}
      >
        <Download className="w-3.5 h-3.5" />
      </IconButton>
      {onRemove && (
        <IconButton
          size="sm"
          tone="destructive"
          onClick={(e) => { e.stopPropagation(); onRemove(a); }}
          title="Usuń"
          aria-label={`Usuń ${a.name}`}
        >
          <X className="w-3.5 h-3.5" />
        </IconButton>
      )}
      </div>
      {children}
    </li>
  );
}

/** Podgląd pierwszych ~20 linii tekstu — wyłącznie jako zwykły tekst, nigdy HTML. */
function TextPreview({ attachment }: { attachment: Attachment }) {
  const [state, setState] = useState<{ text: string; truncated: boolean } | "closed" | "error">("closed");
  async function toggle() {
    if (state !== "closed") { setState("closed"); return; }
    try {
      const bytes = await readAttachment(attachment.hash);
      if (!bytes) { setState("error"); return; }
      const head = new Uint8Array(bytes).subarray(0, 64 * 1024);
      setState(textPreview(new TextDecoder("utf-8").decode(head)));
    } catch { setState("error"); }
  }
  return (
    <div className="mt-1">
      <button type="button" onClick={toggle} className="text-2xs text-primary-ink hover:underline">
        {state === "closed" ? "Pokaż podgląd" : "Ukryj podgląd"}
      </button>
      {state === "error" && <p className="text-2xs text-muted-foreground">Nie udało się wczytać podglądu.</p>}
      {state !== "closed" && state !== "error" && (
        <pre data-testid="attachment-preview" className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-2 font-mono text-2xs text-foreground/85">
          {state.text}{state.truncated ? "\n…" : ""}
        </pre>
      )}
    </div>
  );
}

/** Lista w czytniku: te same wiersze bez usuwania, plus podgląd plików tekstowych. */
export function AttachmentsReadOnlyList({ attachments, className }: { attachments?: Attachment[]; className?: string }) {
  if (!attachments?.length) return null;
  return (
    <section aria-label="Załączniki" className={cn("mt-6", className)}>
      <p className="mb-2 flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Paperclip className="w-3 h-3" aria-hidden /> Załączniki ({attachments.length})
      </p>
      <ul className="space-y-1.5">
        {attachments.map((a) => (
          <AttachmentRow key={a.hash} attachment={a}>
            {isTextPreviewable(a) && <TextPreview attachment={a} />}
          </AttachmentRow>
        ))}
      </ul>
    </section>
  );
}
