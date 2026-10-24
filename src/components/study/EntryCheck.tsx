import { useMemo, useState } from "react";
import { Check, DoorOpen, HardHat, MapPin, Navigation, Pencil, Phone, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { useDayClock } from "@/lib/dayClock";
import { localDayKey } from "@/lib/dayDone";
import { haptic } from "@/lib/haptics";
import { pluralPl } from "@/lib/plural";
import { cn } from "@/lib/utils";
import {
  addCheckItem, checkStatus, CHECK_ITEM_MAX, CHECK_ITEMS_MAX, presenceMinutes, recordKey, siteContextItems, type CheckItem,
} from "@/lib/study/entryCheck";
import {
  enterEntryCheck, leaveEntryCheck, reopenEntryCheck, resetEntryCheckItems, saveEntryCheckItems, toggleEntryCheck, unleaveEntryCheck, useEntryCheck,
} from "@/lib/study/entryCheckStore";
import { setSite, useSiteDirectory, useStudy } from "@/lib/study/store";
import { entrySiteId, findSiteByName, type SiteInfo } from "@/lib/study/sites";
import { mapsHref, primaryCall } from "@/lib/study/contact";
import { QuickLink } from "./QuickLink";
import { toastWithUndo } from "@/lib/undoToast";
import { formatHoursShort } from "@/lib/shifts/time";

const hhmm = (at: number) => new Date(at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
const pointsPl = (n: number) => `${n} ${pluralPl(n, ["punktu", "punktów", "punktów"])}`;
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); };

/** Ile budów naraz w przełączniku karty — reszta i tak jest w filtrze dziennika. */
const PICK_MAX = 4;

/** Budowa wybrana w karcie (id) — w `sessionStorage`, żeby przetrwała przejście na inny widok i powrót. */
const PICK_KEY = "kaczy.study.entryPick.v1";
const session = () => { try { return typeof sessionStorage === "undefined" ? null : sessionStorage; } catch { return null; } };
const readPick = () => { try { return session()?.getItem(PICK_KEY) ?? null; } catch { return null; } };
const writePick = (id: string) => { try { session()?.setItem(PICK_KEY, id); } catch { /* bez pamięci karty wybór żyje do zmiany widoku */ } };

/**
 * Dzisiejsza budowa listy: ta z dzisiejszym wpisem, potem bieżąca budowa arkusza, potem ostatnio
 * używana. Archiwalne się nie liczą.
 */
function defaultSite(active: readonly SiteInfo[], dir: readonly SiteInfo[], study: ReturnType<typeof useStudy>, today: string): string | null {
  const todays = [...study.journal].reverse().find((e) => localDayKey(new Date(e.at)) === today && entrySiteId(e));
  const fromEntry = todays ? entrySiteId(todays) : undefined;
  if (fromEntry && active.some((s) => s.id === fromEntry)) return fromEntry;
  const current = study.site ? findSiteByName(dir, study.site) : undefined;
  if (current && current.archived === undefined) return current.id;
  return active[0]?.id ?? null;
}

/** Lista przed wejściem i jej punkty na dziś dla jednej budowy. */
function useSiteCheck(site: SiteInfo | null, today: string) {
  const study = useStudy();
  const check = useEntryCheck();
  const context = useMemo(
    () => (site ? siteContextItems(site, study.journal, today, endOfToday()) : []),
    [site, study.journal, today],
  );
  const record = site ? check.records.get(recordKey(site.id, today)) : undefined;
  const all = useMemo(() => [...context, ...check.items], [context, check.items]);
  return { context, items: check.items, custom: check.custom, record, status: checkStatus(all, record) };
}

/**
 * Karta „Przed wejściem” nad dziennikiem: dzisiejsza budowa, kratki postępu i „Sprawdź listę”,
 * pod spodem Nawiguj / Zadzwoń / + Wpis tutaj z karty budowy (1.2 planu Praca 2026-10-24).
 * Po „Wchodzę” karta zwija się do pieczątki z godziną wejścia — zostaje jako ślad na dziś.
 */
export function EntryCheckCard({ onNewEntry }: { onNewEntry: (siteName: string) => void }) {
  useDayClock();
  const today = localDayKey();
  const study = useStudy();
  const dir = useSiteDirectory();
  const active = useMemo(() => dir.filter((s) => s.archived === undefined), [dir]);
  const [picked, setPickedState] = useState<string | null>(readPick);
  const setPicked = (id: string) => { setPickedState(id); writePick(id); };
  const [open, setOpen] = useState(false);
  /** Pieczątka wbita przed chwilą — tylko wtedy animacja. */
  const [fresh, setFresh] = useState(false);
  const siteId = picked && active.some((s) => s.id === picked) ? picked : defaultSite(active, dir, study, today);
  const site = active.find((s) => s.id === siteId) ?? null;
  const { status, record } = useSiteCheck(site, today);
  if (!site) return null;

  /** „Wychodzę”: godzina wyjścia; czas na budowie podpowie godziny w oknie „Godziny na budowach”. */
  function leave() {
    if (!site) return;
    const at = Date.now();
    leaveEntryCheck(site.id, today, at);
    haptic("success");
    const min = record ? presenceMinutes({ ...record, leftAt: at }) : null;
    const id = site.id;
    toastWithUndo(min ? `Wyjście ${hhmm(at)} — ${formatHoursShort(min)} h na budowie` : `Wyjście ${hhmm(at)} zapisane`, () => unleaveEntryCheck(id, today));
  }

  const nav = mapsHref(site.address);
  const call = primaryCall(site);

  const choices = active.slice(0, PICK_MAX);
  if (!choices.some((s) => s.id === site.id)) choices[choices.length - 1] = site;

  return (
    <section
      aria-label="Przed wejściem na budowę"
      data-testid="entry-check"
      className="entry-pass relative mb-4 rounded-card border border-border/70 bg-card p-3 shadow-elevation-1 xl:col-start-1"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="flex items-center gap-1.5 font-display text-base leading-tight">
            <HardHat className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />Przed wejściem
          </h4>
          {choices.length > 1 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Wybór budowy na dziś">
              {choices.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === site.id}
                  onClick={() => { setPicked(s.id); setFresh(false); }}
                  className={cn(
                    "pressable max-w-40 truncate rounded-full border px-2.5 py-0.5 text-xs coarse:min-h-11 coarse:px-3 coarse:text-sm",
                    s.id === site.id ? "border-primary/60 bg-primary/12 font-medium text-foreground" : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />{site.name}</p>
          )}
        </div>
        {status.entered && (
          <span
            className="entry-stamp stamp-tag shrink-0 text-primary-ink"
            data-fresh={fresh || undefined}
            data-testid="entry-check-stamp"
          >
            {status.leftAt !== undefined ? `${hhmm(status.at!)}–${hhmm(status.leftAt)}` : `Wejście ${hhmm(status.at!)}`}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Ticks done={status.done} total={status.total} />
        <span className="font-mono text-xs tabular-nums text-muted-foreground" data-testid="entry-check-progress">{status.done}/{status.total}</span>
        <Button
          size="sm"
          variant={status.entered ? "outline" : "default"}
          onClick={() => setOpen(true)}
          className="ml-auto shrink-0 coarse:h-11"
        >
          {status.entered ? "Pokaż listę" : status.done > 0 ? "Dokończ listę" : "Sprawdź listę"}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Szybkie akcje: ${site.name}`} data-testid="entry-check-actions">
        {status.entered && status.leftAt === undefined && (
          <Button size="sm" onClick={leave} className="pressable h-10 gap-1.5 coarse:h-11" data-testid="entry-check-leave">
            <DoorOpen className="h-4 w-4 shrink-0" aria-hidden />Wychodzę
          </Button>
        )}
        {nav && <QuickLink href={nav} icon={Navigation}>Nawiguj</QuickLink>}
        {call && <QuickLink href={call.href} icon={Phone} label={call.label}>Zadzwoń</QuickLink>}
        <Button size="sm" variant="outline" onClick={() => onNewEntry(site.name)} className="pressable h-10 gap-1.5 coarse:h-11">
          <Plus className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />Wpis tutaj
        </Button>
      </div>

      {open && (
        <EntryCheckDialog
          site={site}
          today={today}
          onEntered={() => setFresh(true)}
          onOpenChange={setOpen}
        />
      )}
    </section>
  );
}

/** Kratki zeszytu zamiast paska: jedna na punkt, odhaczona = zamalowana. */
function Ticks({ done, total }: { done: number; total: number }) {
  return (
    <span className="flex min-w-0 flex-1 flex-wrap gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-3 rounded-[3px] border transition-colors duration-base",
            i < done ? "border-primary bg-primary" : "border-foreground/25 bg-background",
          )}
        />
      ))}
    </span>
  );
}

function CheckRow({ item, done, onToggle, note }: { item: CheckItem; done: boolean; onToggle: () => void; note?: boolean }) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        onClick={onToggle}
        className="pressable flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted coarse:min-h-14"
      >
        <span
          aria-hidden
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-md border-2 transition-colors duration-fast",
            done ? "border-primary bg-primary text-primary-foreground" : "border-foreground/30 bg-background",
          )}
        >
          {done && <Check className="h-4.5 w-4.5" strokeWidth={3} />}
        </span>
        <span className={cn("min-w-0 flex-1 text-base sm:text-sm", note && "font-medium", done && "text-muted-foreground")}>{item.text}</span>
      </button>
    </li>
  );
}

/**
 * Okno listy: najpierw to, co dziś ważne na tej budowie (z karty), potem stałe punkty. Duże pola —
 * do stukania w rękawicach. „Wchodzę” zapisuje godzinę także przy brakach; liczba braków jest na przycisku.
 */
function EntryCheckDialog({ site, today, onEntered, onOpenChange }: {
  site: SiteInfo;
  today: string;
  onEntered: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { context, items, custom, record, status } = useSiteCheck(site, today);
  const [editing, setEditing] = useState(false);
  const done = new Set(record?.done ?? []);
  const left = status.total - status.done;
  const dateLabel = new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });

  function toggle(id: string) {
    haptic(done.has(id) ? "tap" : "success");
    toggleEntryCheck(site.id, today, id);
  }

  function enter() {
    enterEntryCheck(site.id, today);
    // Następny „+ Wpis” ma iść na tę budowę, nie na wczoraj używaną (Etap 0.4).
    setSite(site.name);
    haptic("success");
    onEntered();
    toast.success(left === 0 ? `Wejście na budowę ${site.name} zapisane` : `Wejście zapisane — bez ${pointsPl(left)}`);
    onOpenChange(false);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-md" data-testid="entry-check-dialog">
        <div className="space-y-1 border-b border-border px-5 pb-4 pt-5 pr-12">
          <DialogTitle className="flex items-center gap-1.5 font-display text-lg">
            <HardHat className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />Przed wejściem: {site.name}
          </DialogTitle>
          <DialogDescription className="text-xs first-letter:uppercase">{dateLabel}</DialogDescription>
        </div>

        {editing ? (
          <ItemsEditor items={items} custom={custom} onDone={() => setEditing(false)} />
        ) : (
          <div className="max-h-[60dvh] space-y-4 overflow-y-auto px-3 py-3">
            {context.length > 0 && (
              <section aria-label="Na tej budowie">
                <h5 className="section-label px-2 pb-1">Na tej budowie</h5>
                <ul>{context.map((i) => <CheckRow key={i.id} item={i} note done={done.has(i.id)} onToggle={() => toggle(i.id)} />)}</ul>
              </section>
            )}
            <section aria-label="Zawsze">
              <div className="flex items-center justify-between px-2 pb-1">
                <h5 className="section-label">Zawsze</h5>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="pressable inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground coarse:min-h-11"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />Zmień listę
                </button>
              </div>
              <ul>{items.map((i) => <CheckRow key={i.id} item={i} done={done.has(i.id)} onToggle={() => toggle(i.id)} />)}</ul>
            </section>
          </div>
        )}

        {!editing && (
          <div className="space-y-2 border-t border-border px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <p className="sr-only" role="status">{status.done} z {status.total}</p>
            {status.entered ? (
              <div className="flex items-center justify-between gap-3">
                <span className="stamp-tag text-primary-ink">
                  Wejście {hhmm(status.at!)}{status.leftAt !== undefined && `, wyjście ${hhmm(status.leftAt)}`}
                </span>
                {status.leftAt !== undefined ? (
                  <Button variant="outline" onClick={() => { unleaveEntryCheck(site.id, today); haptic("tap"); }} className="coarse:h-11">
                    <RotateCcw className="h-4 w-4" aria-hidden />Cofnij wyjście
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => { reopenEntryCheck(site.id, today); haptic("tap"); }} className="coarse:h-11">
                    <RotateCcw className="h-4 w-4" aria-hidden />Cofnij wejście
                  </Button>
                )}
              </div>
            ) : (
              <Button onClick={enter} className="h-11 w-full text-base coarse:h-12" data-testid="entry-check-enter">
                {left === 0 ? "Wszystko jest — wchodzę" : `Wchodzę bez ${pointsPl(left)}`}
              </Button>
            )}
          </div>
        )}
      </ResponsiveDialogContent>
    </Dialog>
  );
}

/** Zmiana stałych punktów: wspólna lista dla wszystkich budów, zapis dopiero po „Zapisz listę”. */
function ItemsEditor({ items, custom, onDone }: { items: readonly CheckItem[]; custom: boolean; onDone: () => void }) {
  const [draft, setDraft] = useState<CheckItem[]>(() => items.map((i) => ({ ...i })));
  const [text, setText] = useState("");
  const empty = draft.some((i) => !i.text.trim());

  function add() {
    const next = addCheckItem(draft, text);
    if (next.length === draft.length) return;
    setDraft(next);
    setText("");
  }

  function save() {
    if (empty) return;
    saveEntryCheckItems(draft);
    toast.success("Zapisano listę przed wejściem");
    onDone();
  }

  return (
    <div className="space-y-3 px-5 py-4" data-testid="entry-check-editor">
      <p className="text-xs text-muted-foreground">Te punkty są na liście każdej budowy. Punkty „Na tej budowie” biorą się z karty budowy.</p>
      <ul className="space-y-1.5">
        {draft.map((item, idx) => (
          <li key={item.id} className="flex items-center gap-1.5">
            <input
              value={item.text}
              onChange={(e) => setDraft((d) => d.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x)))}
              maxLength={CHECK_ITEM_MAX}
              aria-label={`Punkt ${idx + 1}`}
              aria-invalid={!item.text.trim()}
              className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-base outline-hidden focus:ring-2 focus:ring-ring aria-invalid:border-destructive coarse:h-11 sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setDraft((d) => d.filter((_, i) => i !== idx))}
              aria-label={`Usuń punkt: ${item.text || idx + 1}`}
              className="pressable grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground coarse:size-11"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {draft.length < CHECK_ITEMS_MAX && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={CHECK_ITEM_MAX}
            placeholder="Nowy punkt, np. Klucz do skrzynki"
            aria-label="Nowy punkt"
            autoComplete="off"
            className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-base outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm"
          />
          <Button type="submit" variant="outline" disabled={!text.trim()} className="shrink-0 coarse:h-11">
            <Plus className="h-4 w-4" aria-hidden />Dodaj
          </Button>
        </form>
      )}
      {empty && <p className="text-xs text-destructive-ink" role="alert">Wpisz treść punktu albo go usuń.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {custom ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => { resetEntryCheckItems(); toast.success("Przywrócono listę domyślną"); onDone(); }} className="coarse:h-11">
            Przywróć domyślną
          </Button>
        ) : <span />}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone} className="coarse:h-11">Anuluj</Button>
          <Button type="button" onClick={save} disabled={empty} className="coarse:h-11">Zapisz listę</Button>
        </div>
      </div>
    </div>
  );
}
