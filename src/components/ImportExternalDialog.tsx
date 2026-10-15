import { useRef, useState } from "react";
import { m as motion } from "framer-motion";
import { TriangleAlert, FileArchive, FolderOpen, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import type { ExternalImportStage } from "@/hooks/useImportExport";
import type { ImportPlan } from "@/lib/import";
import { pluralPl } from "@/lib/plural";
import { tween } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface ImportExternalDialogProps {
  open: boolean;
  stage: ExternalImportStage;
  plan: ImportPlan | null;
  error: string | null;
  onPickFiles: (files: File[]) => void;
  onConfirm: () => void;
  onBack: () => void;
  onClose: () => void;
}

const ACCEPT = ".json,.html,.htm,.md,.markdown,.zip,application/json,text/html,text/markdown,application/zip";

/** Wiersz „rejestru”: etykieta, kropkowana prowadnica jak w zeszycie, liczba. */
function LedgerRow({ label, value, hint, index }: { label: string; value: number; hint?: string; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...tween.enter, delay: index * 0.03 }}
      className="flex items-baseline gap-2 text-sm"
    >
      <span className="text-foreground/90">
        {label}
        {hint && <span className="ml-1.5 text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span aria-hidden className="flex-1 border-b border-dotted border-foreground/25 translate-y-[-3px]" />
      <span className="font-mono font-semibold tabular-nums text-foreground">{value}</span>
    </motion.li>
  );
}

export function ImportExternalDialog({ open, stage, plan, error, onPickFiles, onConfirm, onBack, onClose }: ImportExternalDialogProps) {
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // pozwala wybrać ten sam plik jeszcze raz
    onPickFiles(files);
  };

  const busy = stage === "reading" || stage === "saving";
  const c = plan?.counts;
  const importCount = plan?.notes.length ?? 0;

  const added: { label: string; value: number; hint?: string }[] = [];
  if (plan && c) {
    added.push({
      label: pluralPl(importCount, ["Notatka", "Notatki", "Notatek"]),
      value: importCount,
      hint: c.keep && c.markdown ? `Keep ${c.keep}, Markdown ${c.markdown}` : c.keep ? "z Google Keep" : "z Markdown",
    });
    if (plan.labels.length) added.push({ label: "Etykiety", value: plan.labels.length });
    if (plan.folders.length) added.push({ label: "Foldery", value: plan.folders.length });
    if (plan.imageCount) added.push({ label: "Obrazy", value: plan.imageCount });
  }
  const skipped: { label: string; value: number }[] = [];
  if (c) {
    if (c.duplicates) skipped.push({ label: "Duplikaty (już w aplikacji lub w paczce)", value: c.duplicates });
    if (c.trashed) skipped.push({ label: "Z kosza Google Keep", value: c.trashed });
    if (c.empty) skipped.push({ label: "Puste", value: c.empty });
    if (c.failed) skipped.push({ label: "Uszkodzone lub nieczytelne", value: c.failed });
    if (c.ignored) skipped.push({ label: "Inne pliki", value: c.ignored });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && stage !== "saving") onClose(); }}>
      <ResponsiveDialogContent className="max-w-md max-h-[88dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import z Google Keep / Markdown</DialogTitle>
          <DialogDescription>
            {stage === "summary" || stage === "saving"
              ? "Sprawdź, co zostanie dodane. Nic nie jest jeszcze zapisane."
              : "Wskaż pliki z Google Takeout (.json, .html lub cały .zip) albo notatki Markdown, także z Obsidiana."}
          </DialogDescription>
        </DialogHeader>

        {/* Pola plików są zawsze w DOM — także dla testów i czytników ekranu. */}
        <input
          ref={filesRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          data-testid="import-files-input"
          onChange={handleInput}
        />
        <input
          ref={folderRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          data-testid="import-folder-input"
          onChange={handleInput}
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        />

        {(stage === "pick" || stage === "reading") && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!busy) onPickFiles(Array.from(e.dataTransfer.files));
            }}
            className={cn(
              "rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors duration-fast",
              dragOver ? "border-primary bg-primary/10" : "border-primary/40 bg-primary/5",
            )}
          >
            {stage === "reading" ? (
              <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden />
                Czytam pliki…
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">Przeciągnij tu pliki albo wybierz je ręcznie.</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button type="button" onClick={() => filesRef.current?.click()}>
                    <FileArchive aria-hidden />
                    Wybierz pliki lub ZIP
                  </Button>
                  <Button type="button" variant="outline" onClick={() => folderRef.current?.click()}>
                    <FolderOpen aria-hidden />
                    Wybierz folder
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive flex items-start gap-2">
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        {(stage === "summary" || stage === "saving") && plan && (
          <div className="space-y-4" data-testid="import-summary">
            {importCount > 0 ? (
              <ul className="space-y-1.5 rounded-lg bg-muted/50 px-3 py-3">
                {added.map((r, i) => <LedgerRow key={r.label} index={i} {...r} />)}
              </ul>
            ) : (
              <p className="text-sm rounded-lg bg-muted/50 px-3 py-3">
                W wybranych plikach nie znaleziono notatek do zaimportowania.
              </p>
            )}

            {skipped.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Pominięte</h3>
                <ul className="space-y-1">
                  {skipped.map((r, i) => <LedgerRow key={r.label} index={added.length + i} {...r} />)}
                </ul>
              </div>
            )}

            {plan.warnings.length > 0 && (
              <ul className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5" aria-label="Ostrzeżenia">
                {plan.warnings.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-xs text-foreground/90">
                    <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary-ink" aria-hidden />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            )}

            {plan.failures.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none">Pliki z błędami ({plan.failures.length})</summary>
                <ul className="mt-1.5 space-y-1 max-h-32 overflow-y-auto">
                  {plan.failures.slice(0, 50).map((f) => (
                    <li key={f.path} className="break-all"><span className="font-mono">{f.path}</span> — {f.reason}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <ResponsiveDialogFooter className="gap-2 sm:gap-0">
          {(stage === "summary" || stage === "saving") ? (
            <>
              <Button type="button" variant="ghost" onClick={onBack} disabled={stage === "saving"}>Wybierz inne pliki</Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={stage === "saving"}>Anuluj</Button>
              <Button type="button" onClick={onConfirm} disabled={importCount === 0 || stage === "saving"}>
                {stage === "saving" && <LoaderCircle className="animate-spin" aria-hidden />}
                {stage === "saving" ? "Zapisuję…" : `Importuj ${importCount}`}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
