import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { readSnapshotFile } from "@/lib/dailySnapshot";
import { getSyncState } from "@/lib/yjsSync";
import { readDocState, yjsStore, type DocState } from "@/lib/yjsStore";
import { privateNotes } from "@/lib/privateNotes";
import { compareSnapshot, restoreSnapshotCopies, restoredFolderName, type SnapshotComparison, type SnapshotItem } from "@/lib/snapshotRestore";
import { pluralPl } from "@/lib/plural";

const dayLabel = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });
const fullTime = (at: number) => {
  const d = new Date(at);
  return `${dayLabel(at)}, godz. ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const changedAt = (at: number) => new Date(at).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function titleOf(item: SnapshotItem): string {
  if (item.note.locked) return "Notatka prywatna";
  const firstLine = item.note.content.split("\n").find((l) => l.trim())?.trim() ?? "";
  return item.note.title.trim() || firstLine.slice(0, 80) || "(bez tytułu)";
}

const BLOCKED: Record<string, string> = {
  locked: "Odblokuj skarbiec, żeby przywrócić tę notatkę.",
  "other-key": "Zaszyfrowana poprzednim hasłem — przywróć cały dokument albo użyj kopii do pliku.",
};

function Row({ item, checked, onToggle }: { item: SnapshotItem; checked: boolean; onToggle: (on: boolean) => void }) {
  const id = useId();
  const [preview, setPreview] = useState(false);
  const blocked = item.privacy === "locked" || item.privacy === "other-key";
  const canPreview = !item.note.locked && item.note.content.trim().length > 0;
  return (
    <li className="px-3 py-2 space-y-1">
      <div className="flex items-start gap-2.5">
        <Checkbox id={id} className="mt-0.5" checked={checked} disabled={blocked} onCheckedChange={(v) => onToggle(v === true)} />
        <label htmlFor={id} className="min-w-0 flex-1 text-sm">
          <span className={blocked ? "text-muted-foreground" : "text-foreground"}>{titleOf(item)}</span>
          <span className="block text-xs text-muted-foreground tabular-nums">
            w kopii: zmieniona {changedAt(item.note.updatedAt)}
            {item.note.trashed && " · była w koszu"}
          </span>
          {blocked && <span className="block text-xs text-warning-ink">{BLOCKED[item.privacy]}</span>}
        </label>
        {canPreview && (
          <Button type="button" size="sm" variant="ghost" aria-expanded={preview} onClick={() => setPreview((p) => !p)}>
            {preview ? "Zwiń" : "Podgląd"}
          </Button>
        )}
      </div>
      {preview && (
        <p className="ml-7 max-h-48 overflow-auto whitespace-pre-wrap rounded-card bg-muted/40 p-2 text-xs text-foreground">
          {item.note.content.slice(0, 2000)}
        </p>
      )}
    </li>
  );
}

function Group({ title, items, selected, toggle, children }: {
  title: string; items: SnapshotItem[]; selected: Set<string>; toggle: (id: string, on: boolean) => void; children?: React.ReactNode;
}) {
  if (!items.length) return null;
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title} ({items.length})</h3>
        {children}
      </div>
      <ul className="rounded-card border border-border/60 bg-muted/20 divide-y divide-border/60">
        {items.map((i) => <Row key={i.note.id} item={i} checked={selected.has(i.note.id)} onToggle={(on) => toggle(i.note.id, on)} />)}
      </ul>
    </section>
  );
}

/**
 * „Przywróć z dnia DD.MM” (Z-16.1B, `docs/plan-dane-lokalne.md` §1.5): notatki z kopii dziennej w trzech grupach,
 * wybrane wracają jako kopie w folderze „Przywrócone DD.MM”. Obecne notatki nie są zmieniane.
 */
/**
 * Ścieżka awaryjna (§1.6): cały dokument wraca do stanu z kopii. Potwierdzenie z opisem skutków; przy synchronizacji
 * urządzenie opuszcza grupę. Moduł wymiany ładowany dopiero przy kliknięciu.
 */
function ReplaceWholeDocument({ snapshotRef, createdAt, disabled }: { snapshotRef: string; createdAt: number; disabled: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const inGroup = getSyncState().code !== null;

  async function run() {
    setBusy(true);
    try {
      const { requestDocReplace } = await import("@/lib/docReplace");
      await requestDocReplace({ kind: "snapshot", file: snapshotRef, createdAt });
    } catch (err) {
      setBusy(false);
      setConfirm(false);
      toast.error("Nie zaczęto wymiany danych" + (err instanceof Error ? `: ${err.message}` : "") + ". Dane są bez zmian.");
    }
  }

  return (
    <section className="space-y-1.5 border-t border-border/60 pt-3">
      <h3 className="text-sm font-semibold">Gdy brakuje dużo więcej niż kilku notatek</h3>
      <p className="ui-hint">
        Cały dokument — notatki, foldery, Grafik, Praca, Nauka — wraca do stanu z kopii. Używaj, gdy dane są uszkodzone albo zniknęły.
      </p>
      <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => setConfirm(true)}>
        Przywróć cały dokument…
      </Button>
      <AlertDialog open={confirm} onOpenChange={(o) => { if (!busy) setConfirm(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Przywrócić cały dokument?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Wszystkie dane w aplikacji wrócą do stanu z {fullTime(createdAt)}. Zmiany zrobione później znikną z tego urządzenia (zostanie ich kopia na 30 dni). Zdjęcia i załączniki nie są częścią kopii dziennej.
                </p>
                {inGroup && (
                  <p>
                    To urządzenie opuści grupę synchronizacji. Pozostałe urządzenia zachowają obecne dane, dopóki nie zastąpisz ich danymi z tego urządzenia.
                  </p>
                )}
                <p>Aplikacja przeładuje się, także w innych otwartych kartach.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Anuluj</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void run(); }}>
              {busy ? "Zapisuję kopię obecnych danych…" : "Przywróć cały dokument"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function DailySnapshotRestore({ snapshotRef, createdAt, open, onOpenChange }: { snapshotRef: string; createdAt: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [state, setState] = useState<{ snap: DocState; cmp: SnapshotComparison } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState(null);
    setError(null);
    setSelected(new Set());
    readSnapshotFile(snapshotRef)
      .then(({ body }) => {
        const snap = readDocState(body);
        const cmp = compareSnapshot(snap, yjsStore.projectNotes(), yjsStore.getVaultMeta(), privateNotes.isUnlocked());
        if (!cancelled) setState({ snap, cmp });
      })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Nie udało się odczytać kopii"); });
    return () => { cancelled = true; };
  }, [snapshotRef, open]);

  const selectable = useMemo(() => {
    const all = state ? [...state.cmp.deleted, ...state.cmp.changed] : [];
    return all.filter((i) => i.privacy === "plain" || i.privacy === "ok");
  }, [state]);

  const toggle = (id: string, on: boolean) => setSelected((prev) => {
    const next = new Set(prev);
    if (on) next.add(id); else next.delete(id);
    return next;
  });

  const deletedSelectable = state ? state.cmp.deleted.filter((i) => i.privacy === "plain" || i.privacy === "ok") : [];
  const allDeletedOn = deletedSelectable.length > 0 && deletedSelectable.every((i) => selected.has(i.note.id));
  const folder = restoredFolderName(createdAt);

  async function restore() {
    if (!state) return;
    setBusy(true);
    try {
      const items = selectable.filter((i) => selected.has(i.note.id));
      const r = await restoreSnapshotCopies(items, state.snap, createdAt, {
        store: yjsStore, reencryptCopy: privateNotes.reencryptCopy, adoptCopy: privateNotes.adoptCopy,
      });
      if (r.restored) toast.success(`Przywrócono ${r.restored} ${pluralPl(r.restored, ["notatkę", "notatki", "notatek"])} do folderu „${folder}”`);
      if (r.skipped.length) toast.warning(`Nie przywrócono ${r.skipped.length} ${pluralPl(r.skipped.length, ["notatki prywatnej", "notatek prywatnych", "notatek prywatnych"])} — skarbiec się zablokował albo zmieniło się hasło`);
      onOpenChange(false);
    } catch (err) {
      toast.error("Nie udało się przywrócić notatek" + (err instanceof Error ? `: ${err.message}` : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <ResponsiveDialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Przywróć z dnia {dayLabel(createdAt)}</DialogTitle>
          <DialogDescription>
            Zaznaczone notatki wrócą jako kopie w folderze „{folder}”. Obecne notatki zostaną bez zmian. Zdjęcia wrócą, jeśli są jeszcze na tym urządzeniu.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {error && <p role="alert" className="text-sm text-warning-ink">{error}</p>}
          {!state && !error && <p className="text-sm text-muted-foreground" role="status">Czytam kopię…</p>}
          {state && state.cmp.deleted.length === 0 && state.cmp.changed.length === 0 && (
            <p className="text-sm text-muted-foreground">Od tamtej pory żadna notatka nie zniknęła ani się nie zmieniła.</p>
          )}
          {state && (
            <>
              <Group title="Usunięte od tamtej pory" items={state.cmp.deleted} selected={selected} toggle={toggle}>
                {deletedSelectable.length > 1 && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelected((prev) => {
                    const next = new Set(prev);
                    for (const i of deletedSelectable) if (allDeletedOn) next.delete(i.note.id); else next.add(i.note.id);
                    return next;
                  })}>
                    {allDeletedOn ? "Odznacz usunięte" : "Zaznacz wszystkie usunięte"}
                  </Button>
                )}
              </Group>
              <Group title="Zmienione od tamtej pory" items={state.cmp.changed} selected={selected} toggle={toggle} />
              {state.cmp.unchanged.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Bez zmian ({state.cmp.unchanged.length})</summary>
                  <ul className="mt-1.5 max-h-48 overflow-auto rounded-card border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    {state.cmp.unchanged.map((i) => <li key={i.note.id}>{titleOf(i)}</li>)}
                  </ul>
                </details>
              )}
            </>
          )}
          {!error && <ReplaceWholeDocument snapshotRef={snapshotRef} createdAt={createdAt} disabled={!state || busy} />}
        </div>
        <ResponsiveDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Anuluj</Button>
          <Button type="button" onClick={restore} disabled={busy || selected.size === 0}>
            Przywróć zaznaczone{selected.size ? ` (${selected.size})` : ""}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
