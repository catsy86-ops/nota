import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { haptic } from "@/lib/haptics";
import { pluralPl } from "@/lib/plural";
import { prepareImage } from "@/lib/imagePrepare";
import { imageStore } from "@/lib/imageStore";
import { requestPersistentStorage } from "@/lib/storagePersistence";
import { EXIF_READ_BYTES, readExif } from "@/lib/exif";
import { dayKeyOf } from "@/lib/study/report";
import { dayLabel } from "@/lib/study/journalView";
import { addJournalEntry, getStudy, siteDirectoryOf, useSiteDirectory } from "@/lib/study/store";
import { entrySiteId, findSiteByName } from "@/lib/study/sites";
import { groupPhotos, PHOTO_IMPORT_MAX, type PhotoGroup, type PhotoInfo, type SiteReason } from "@/lib/study/photoImport";
import { photoSaveFailed } from "./useJournalPhotoEdits";

const selectClass =
  "h-10 w-full rounded-field border border-border bg-background px-3 text-sm outline-hidden focus:ring-2 focus:ring-ring coarse:h-11";

const WHY: Record<SiteReason, string> = {
  gps: "z lokalizacji zdjęcia",
  day: "z godzin i wpisów tego dnia",
  current: "bieżąca budowa",
  none: "wybierz budowę",
};

const time = (at: number) => new Date(at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });

/** Budowy z godzinami albo wpisami danego dnia — podpowiedź dla zdjęć bez lokalizacji. */
function daySitesOf(day: string): string[] {
  const s = getStudy();
  const ids = new Set<string>();
  for (const card of siteDirectoryOf(s)) if (card.hours?.some((h) => h.id === day && h.minutes > 0)) ids.add(card.id);
  for (const e of s.journal) { const id = entrySiteId(e); if (id && dayKeyOf(e.at) === day) ids.add(id); }
  return [...ids];
}

/**
 * H4.3 „Zdjęcia z dnia”: zdjęcia z galerii → wpisy z godziną zrobienia, pogrupowane po przerwach
 * i budowach (`groupPhotos`). Czas i GPS czyta `readExif` z pierwszych 128 KB pliku — przed
 * zmniejszeniem, które gubi EXIF. Lokalizacja zdjęcia tylko podpowiada budowę, do wpisu nie trafia.
 */
export function PhotoDayDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const dir = useSiteDirectory();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [photos, setPhotos] = useState<PhotoInfo[]>([]);
  const [sites, setSites] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const live = dir.filter((s) => s.archived === undefined);

  const groups = useMemo<PhotoGroup[]>(() => {
    if (!photos.length) return [];
    const s = getStudy();
    const current = s.site ? findSiteByName(siteDirectoryOf(s), s.site)?.id ?? null : null;
    return groupPhotos(photos, { sites: siteDirectoryOf(s), daySites: daySitesOf, current, dayKeyOf });
  }, [photos]);

  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  function reset() {
    setFiles([]);
    setPhotos([]);
    setSites({});
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const all = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (!all.length) return;
    if (all.length > PHOTO_IMPORT_MAX) toast(`Naraz najwyżej ${PHOTO_IMPORT_MAX} zdjęć — wzięte pierwsze ${PHOTO_IMPORT_MAX}`);
    const chosen = all.slice(0, PHOTO_IMPORT_MAX);
    setBusy("Czytam czas zdjęć…");
    try {
      const infos = await Promise.all(chosen.map(async (f, key): Promise<PhotoInfo> => {
        const exif = readExif(new Uint8Array(await f.slice(0, EXIF_READ_BYTES).arrayBuffer()));
        return { key, at: exif.taken ?? f.lastModified, exact: exif.taken !== undefined, ...(exif.geo ? { geo: exif.geo } : {}) };
      }));
      setFiles(chosen);
      setPhotos(infos);
      setSites({});
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!groups.length || busy) return;
    void requestPersistentStorage();
    let entries = 0, skipped = 0, done = 0;
    const total = files.length;
    try {
      for (const [i, g] of groups.entries()) {
        const refs: string[] = [];
        for (const key of g.keys) {
          setBusy(`Zapisuję zdjęcia ${++done}/${total}…`);
          const prepared = await prepareImage(files[key]);
          if (!prepared) { skipped++; continue; }
          refs.push(await imageStore.putBlob(prepared));
        }
        if (refs.length && addJournalEntry({ kind: "ok", topic: null, text: "", images: refs, at: g.start, site: sites[i] ?? g.site })) entries++;
      }
    } catch {
      photoSaveFailed();
    } finally {
      setBusy(null);
    }
    if (skipped > 0) toast.error(`${skipped} ${pluralPl(skipped, ["zdjęcia", "zdjęć", "zdjęć"])} nie udało się zmniejszyć do 2 MB`);
    if (entries > 0) {
      haptic("success");
      toast.success(`Dodano ${entries} ${pluralPl(entries, ["wpis", "wpisy", "wpisów"])} ze zdjęć`);
      reset();
      onOpenChange(false);
    }
  }

  const inexact = photos.filter((p) => !p.exact).length;
  let lastDay = "";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (busy) return; if (!o) reset(); onOpenChange(o); }}>
      <ResponsiveDialogContent className="sm:max-w-md" data-testid="photo-day">
        <DialogTitle className="font-display">Zdjęcia z dnia</DialogTitle>
        <DialogDescription>
          Wybierz zdjęcia z galerii — powstaną wpisy z godziną zrobienia zdjęcia, podzielone po przerwach i budowach.
        </DialogDescription>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void pick(e)} data-testid="photo-day-file" />
        {groups.length === 0 ? (
          <Button onClick={() => inputRef.current?.click()} disabled={!!busy} className="coarse:h-11">
            <ImagePlus className="h-4 w-4" aria-hidden />{busy ?? "Wybierz zdjęcia"}
          </Button>
        ) : (
          <>
            <p className="text-sm font-medium" data-testid="photo-day-summary">
              {groups.length} {pluralPl(groups.length, ["wpis", "wpisy", "wpisów"])} z {photos.length} {pluralPl(photos.length, ["zdjęcia", "zdjęć", "zdjęć"])}
            </p>
            {inexact > 0 && (
              <p className="text-xs text-muted-foreground">
                {inexact} {pluralPl(inexact, ["zdjęcie nie ma", "zdjęcia nie mają", "zdjęć nie ma"])} czasu zrobienia — godzina z pliku, może być godziną skopiowania.
              </p>
            )}
            <ol className="max-h-[50dvh] space-y-3 overflow-y-auto">
              {groups.map((g, i) => {
                const day = dayKeyOf(g.start);
                const header = day !== lastDay ? dayLabel(g.start) : null;
                lastDay = day;
                const value = sites[i] ?? g.site;
                return (
                  <li key={g.keys.join("-")} className="space-y-1.5" data-testid="photo-day-group">
                    {header && <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{header}</p>}
                    <div className="rounded-field border border-border p-2.5">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-mono tabular-nums">{g.start === g.end ? time(g.start) : `${time(g.start)}–${time(g.end)}`}</span>
                        <span className="text-xs text-muted-foreground">{g.keys.length} {pluralPl(g.keys.length, ["zdjęcie", "zdjęcia", "zdjęć"])}</span>
                      </div>
                      <div className="my-2 flex gap-1.5 overflow-hidden">
                        {g.keys.slice(0, 5).map((k) => <img key={k} src={urls[k]} alt="" className="h-12 w-12 shrink-0 rounded-field object-cover" />)}
                      </div>
                      <select
                        aria-label={`Budowa wpisu ${time(g.start)}`}
                        value={value}
                        onChange={(e) => setSites((s) => ({ ...s, [i]: e.target.value }))}
                        className={selectClass}
                      >
                        <option value="">Bez budowy</option>
                        {value && !live.some((s) => s.name === value) && <option value={value}>{value}</option>}
                        {live.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                      {sites[i] === undefined && <p className="mt-1 text-xs text-muted-foreground">{WHY[g.why]}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={reset} disabled={!!busy}>Inne zdjęcia</Button>
              <Button onClick={() => void save()} disabled={!!busy} className="coarse:h-11">{busy ?? "Dodaj wpisy"}</Button>
            </div>
          </>
        )}
      </ResponsiveDialogContent>
    </Dialog>
  );
}
