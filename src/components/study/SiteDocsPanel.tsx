import { useRef, useState } from "react";
import { FileText, FolderOpen, Maximize2, Minimize2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NoteImage } from "@/components/NoteImage";
import { downloadAttachment, formatFileSize } from "@/lib/attachments";
import { haptic } from "@/lib/haptics";
import { toastWithUndo } from "@/lib/undoToast";
import { cn } from "@/lib/utils";
import { setSiteDocs } from "@/lib/study/store";
import { docLabel, isImageDoc, SITE_DOC_TYPES, SITE_DOCS_MAX, type SiteDoc } from "@/lib/study/siteDocs";
import type { SiteInfo } from "@/lib/study/sites";

/**
 * Plany i dokumenty budowy (H3) w karcie: rzuty i zdjęcia tablic jako miniatury (powiększenie
 * z „100%” do oglądania szczegółów), PDF-y jako wiersze z „Otwórz”. Wszystko na urządzeniu,
 * więc działa bez zasięgu; usunięcie ma „Cofnij”.
 */
export function SiteDocsPanel({ site }: { site: SiteInfo }) {
  const docs = site.docs ?? [];
  const images = docs.filter(isImageDoc);
  const files = docs.filter((d) => !isImageDoc(d));
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<SiteDoc | null>(null);
  const [actual, setActual] = useState(false);

  async function add(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    try {
      const { addSiteDocFiles } = await import("@/lib/study/siteDocsAdd");
      const { added, message } = await addSiteDocFiles([...list], docs);
      if (added.length > 0) {
        setSiteDocs(site.id, [...docs, ...added], docs);
        haptic("success");
        toast.success(added.length === 1 ? `Dodano „${docLabel(added[0])}”` : `Dodano plików: ${added.length}`);
      }
      if (message) toast.error(message, { duration: 8000 });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function remove(d: SiteDoc) {
    const before = docs;
    const after = docs.filter((x) => x.id !== d.id);
    setSiteDocs(site.id, after, before);
    // Bajty zostają w magazynie do sprzątania po karencji — „Cofnij” przywraca sam wpis.
    toastWithUndo(`Usunięto „${docLabel(d)}”`, () => setSiteDocs(site.id, before, after));
  }

  async function open(d: SiteDoc) {
    const ok = await downloadAttachment({ hash: d.id, name: d.name, size: d.size, type: d.type });
    if (!ok) toast.error("Tego pliku nie ma na tym urządzeniu — PDF powyżej 2 MB zostaje na telefonie, który go dodał.");
  }

  return (
    <section aria-label="Plany i dokumenty" data-testid="site-docs" className="space-y-2 rounded-card border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <FolderOpen className="h-3.5 w-3.5" aria-hidden />Plany i dokumenty
        </h3>
        {docs.length > 0 && <span className="font-mono text-xs tabular-nums text-muted-foreground">{docs.length}</span>}
      </div>

      {docs.length === 0 && (
        <p className="text-xs text-muted-foreground">Rzut, projekt, zdjęcie tablicy — zawsze pod ręką, także bez zasięgu.</p>
      )}

      {images.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {images.map((d) => (
            <li key={d.id} className="relative min-w-0">
              <button
                type="button"
                onClick={() => { setActual(false); setZoom(d); }}
                className="pressable block w-full overflow-hidden rounded-field border border-border focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Powiększ: ${docLabel(d)}`}
              >
                <NoteImage imageRef={d.id} alt="" className="aspect-square w-full object-cover" placeholderClassName="aspect-square w-full" />
              </button>
              <p className="mt-0.5 truncate text-2xs text-muted-foreground">{docLabel(d)}</p>
              <button
                type="button"
                onClick={() => remove(d)}
                aria-label={`Usuń: ${docLabel(d)}`}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm hover:text-destructive-ink coarse:h-11 coarse:w-11"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="divide-y divide-border/60">
          {files.map((d) => (
            <li key={d.id} className="flex items-center gap-2 py-1.5">
              <FileText className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{docLabel(d)}</span>
                <span className="font-mono text-2xs tabular-nums text-muted-foreground">PDF · {formatFileSize(d.size)}</span>
              </span>
              <Button type="button" variant="outline" size="sm" className="pressable shrink-0 coarse:h-11" onClick={() => void open(d)} aria-label={`Otwórz: ${docLabel(d)}`}>
                Otwórz
              </Button>
              <Button type="button" variant="ghost" size="sm" className="shrink-0 px-2 text-muted-foreground hover:text-destructive-ink coarse:h-11" onClick={() => remove(d)} aria-label={`Usuń: ${docLabel(d)}`}>
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={input}
        type="file"
        accept={SITE_DOC_TYPES}
        multiple
        className="hidden"
        onChange={(e) => void add(e.target.files)}
        aria-label="Wybierz plany i dokumenty"
      />
      <Button
        type="button"
        variant="outline"
        className="pressable w-full coarse:h-11"
        disabled={busy || docs.length >= SITE_DOCS_MAX}
        onClick={() => input.current?.click()}
      >
        <Plus className="mr-1.5 h-4 w-4" aria-hidden />{busy ? "Dodaję…" : "Dodaj plan lub dokument"}
      </Button>

      <Dialog open={!!zoom} onOpenChange={(o) => { if (!o) setZoom(null); }}>
        <DialogContent className="max-w-[min(96vw,64rem)] gap-2 p-3">
          <DialogTitle className="truncate pr-8 text-sm">{zoom ? docLabel(zoom) : ""}</DialogTitle>
          {zoom && (
            <div className={cn("max-h-[80dvh] overflow-auto rounded-field", actual ? "touch-pan-x touch-pan-y" : "")} data-testid="site-doc-zoom">
              <NoteImage
                imageRef={zoom.id}
                alt={docLabel(zoom)}
                loading="eager"
                className={actual ? "max-w-none" : "max-h-[80dvh] w-full object-contain"}
              />
            </div>
          )}
          <Button type="button" variant="outline" size="sm" className="pressable self-start coarse:h-11" onClick={() => setActual((v) => !v)}>
            {actual ? <><Minimize2 className="mr-1.5 h-4 w-4" aria-hidden />Dopasuj</> : <><Maximize2 className="mr-1.5 h-4 w-4" aria-hidden />100%</>}
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
