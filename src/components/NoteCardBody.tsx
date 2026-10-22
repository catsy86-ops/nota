import type { ComponentProps } from "react";
import { Check, CornerLeftUp, Link2, Lock, RotateCcw, Trash } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import type { Note } from "@/hooks/useNotes";
import type { useNoteViewActions } from "@/hooks/NoteViewActionsContext";
import type { useTrashCountdown } from "@/hooks/useTrashCountdown";
import { backlinksOf } from "@/lib/wikiLinks";
import { haptic } from "@/lib/haptics";
import { celebrate } from "@/lib/celebrate";
import { toastWithUndo } from "@/lib/undoToast";
import { snoozeTimes } from "@/lib/reminderAgenda";
import { doneTarget, seriesDay, snoozeTarget } from "@/lib/reminderRepeat";
import { pluralPl } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { firstSnippet } from "@/lib/searchHighlight";
import { Marked } from "@/components/SearchMarks";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ChecklistCount, ChecklistPreview } from "./ChecklistEditor";
import { LabelBadges } from "./LabelPicker";
import { ReminderBadge } from "./ReminderPicker";
import { useReminderPassed } from "@/hooks/useReminderPassed";
import { PriorityBadge } from "./PriorityPicker";
import { AttachmentsBadge } from "./AttachmentsList";
import { NoteCoverStrip } from "./NoteLookPicker";

type Actions = ReturnType<typeof useNoteViewActions>;

/** Na kaflu jeden link zwrotny i „+N” — pełna lista jest w czytniku. */
const BACKLINKS_SHOWN = 1;

/**
 * Po odhaczeniu albo odłożeniu kafel znika z listy, więc fokus nie może wrócić na początek strony.
 * Zwraca funkcję wywoływaną po zapisie: sąsiedni kafel w tej samej grupie, a gdy go nie ma — nagłówek grupy (2c planu).
 */
function focusAfterRemoval(el: HTMLElement): () => void {
  const wrap = el.closest<HTMLElement>("[data-note-id-wrap]");
  const neighbour = (wrap?.nextElementSibling ?? wrap?.previousElementSibling) as HTMLElement | null | undefined;
  const heading = el.closest("section")?.querySelector<HTMLElement>("h2") ?? null;
  return () => requestAnimationFrame(() => {
    const target = neighbour?.isConnected ? neighbour.querySelector<HTMLElement>("button") : null;
    if (target) { target.focus(); return; }
    if (heading) { heading.tabIndex = -1; heading.focus(); }
  });
}

/**
 * Zawartość kafla w trybie podglądu (nie edycji): okładka, tytuł, treść (albo fragment
 * trafienia wyszukiwania), lista zadań, etykiety i terminy, linki zwrotne, podstrony,
 * odliczanie kosza i stopka z datą. Akcje kafla są osobno (`NoteCardActions`).
 */
export function NoteCardBody({
  note,
  isArchived,
  selectable,
  snippet,
  searchTerms,
  knownTitles,
  onWikiClick,
  onUpdate,
  onOpenNote,
  onUnarchive,
  handleChecklistToggle,
  backlinks,
  subpage,
  trashCountdown,
  showReadingTime,
  wordCount,
  readMin,
  reminderActions,
}: {
  note: Note;
  isArchived: boolean | undefined;
  /** Widok Terminy — „Gotowe” przy każdym terminie. */
  reminderActions?: boolean;
  /** Kafel ma zaznaczanie — tytuł zostawia miejsce na pole wyboru. */
  selectable: boolean;
  snippet: ReturnType<typeof firstSnippet>;
  searchTerms: ComponentProps<typeof Marked>["terms"];
  knownTitles: ComponentProps<typeof MarkdownRenderer>["knownTitles"];
  onWikiClick: ComponentProps<typeof MarkdownRenderer>["onWikiClick"];
  handleChecklistToggle: (itemId: string) => void;
  backlinks: ReturnType<typeof backlinksOf>;
  subpage: { parentId?: string | null; parentTitle?: string | null; childCount: number } | undefined;
  trashCountdown: ReturnType<typeof useTrashCountdown>;
  showReadingTime: boolean;
  wordCount: number;
  readMin: number;
} & Pick<Actions, "onUpdate" | "onOpenNote" | "onUnarchive">) {
  // Termin mija w trakcie oglądania listy — przycisk „Gotowe” pojawia się wtedy bez odświeżania.
  const reminderPassed = useReminderPassed(note.reminder ?? 0);
  return (
    <>
              <NoteCoverStrip cover={note.cover} className="-mx-3.5 -mt-3 mb-2.5 w-[calc(100%+1.75rem)] rounded-t-[inherit]" />
              {(note.title || note.icon) && (
                // Prawy margines: tytuł nie wchodzi pod pole zaznaczenia (right-2 + w-6 = 32 px od krawędzi).
                <h3 className={cn("font-display font-semibold text-base leading-snug tracking-[-0.01em] text-foreground mb-1 line-clamp-2 wrap-anywhere", selectable && "pr-5")}>
                  {note.icon && <span className="mr-1.5" aria-hidden>{note.icon}</span>}
                  <Marked text={note.title} terms={searchTerms} />
                  {note.readOnly && <Lock className="inline-block w-3 h-3 ml-1.5 -mt-0.5 text-muted-foreground" aria-label="Zablokowana do edycji" />}
                  <ChecklistCount items={note.checklist || []} />
                </h3>
              )}
              {/* Pusta notatka: ten sam zastępnik co w tabeli, zamiast kafla z samą datą. */}
              {!note.title && !note.icon && !note.content.trim() && !(note.checklist || []).length && !(note.images || []).length && (
                <p className="font-display text-base leading-snug italic text-muted-foreground mb-1">Bez tytułu</p>
              )}
              {note.content && (
                // Kafel to zapowiedź, nie lektura: 4 linie (na telefonie 3) i zwykła interlinia — pełny tekst jest w czytniku.
                // Nagłówki z treści w rozmiarze treści — duże i pogrubione konkurowały z tytułem kafla.
                <div className="line-clamp-4 max-sm:line-clamp-3 text-foreground/85 [&_p]:leading-normal [&_li]:leading-normal [&_p]:mb-0.5 [&_:is(h1,h2,h3,h4,h5,h6)]:text-[1em]! [&_:is(h1,h2,h3,h4,h5,h6)]:leading-normal! [&_:is(h1,h2,h3,h4,h5,h6)]:m-0! [&_:is(h1,h2,h3,h4,h5,h6)]:font-semibold!">
                  {snippet ? (
                    // Szukasz: zamiast początku treści pokazujemy fragment z trafieniem.
                    <p className="text-sm leading-normal">{snippet.before}<mark className="rounded bg-primary/25 px-0.5 text-foreground">{snippet.match}</mark>{snippet.after}</p>
                  ) : (
                    <MarkdownRenderer content={note.content} knownTitles={knownTitles} onWikiClick={onWikiClick} />
                  )}
                </div>
              )}
              {(note.checklist || []).length > 0 && (
                <ChecklistPreview items={note.checklist} onToggle={handleChecklistToggle} showProgress={!note.title} />
              )}
              {/* Etykiety, przypomnienie i priorytet w jednym rzędzie — każde w osobnej linii robiło z kafla wieżę. */}
              <div className="flex items-center gap-1 flex-wrap mt-1.5 empty:hidden *:mt-0!">
                <LabelBadges labels={note.labels} />
                <ReminderBadge reminder={note.reminder} reminderRepeat={note.reminderRepeat} reminderAllDay={note.reminderAllDay} />
                <PriorityBadge priority={note.priority ?? "none"} />
                <AttachmentsBadge attachments={note.attachments} />
              </div>
              {/* Termin: odhaczenie i odłożenie bez otwierania notatki. W Terminach dotyczy każdego terminu (D2), w innych tylko zaległych. */}
              {onUpdate && note.reminder !== null && (reminderActions || reminderPassed) && !note.trashed && !isArchived && !note.locked && (
                <div className="mt-2 flex flex-wrap items-center gap-1 sm:gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => {
                      const prev = { reminder: note.reminder, reminderDay: note.reminderDay, reminderBase: note.reminderBase };
                      // Jak przy powiadomieniu: seria przechodzi do następnego wystąpienia (D3), koniec serii albo zwykły termin zdejmuje przypomnienie.
                      const next = doneTarget(note, Date.now());
                      const focus = focusAfterRemoval(e.currentTarget);
                      haptic("success");
                      if (next === null) onUpdate(note.id, { reminder: null });
                      else onUpdate(note.id, { reminder: next, reminderDay: seriesDay(note), reminderBase: undefined });
                      toastWithUndo(
                        next === null ? "Przypomnienie odhaczone" : "Wystąpienie odhaczone — następne w serii",
                        () => onUpdate(note.id, prev),
                        { id: `rem-done-${note.id}` },
                      );
                      focus();
                    }}
                    className="pressable inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 sm:px-2.5 py-1 coarse:min-h-11 text-2xs font-medium text-primary-ink hover:bg-primary/20"
                  >
                    <Check className="w-3 h-3" aria-hidden /> Gotowe
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const prev = { reminder: note.reminder, reminderDay: note.reminderDay, reminderBase: note.reminderBase };
                      haptic("tap");
                      // Odłożenie nie przepisuje dnia serii: bez jawnego `reminderDay` `updateNote` wyprowadziłby go z nowej godziny (2b planu).
                      // Odłożenie jednego wystąpienia serii (`snoozeTarget`), nie przesunięcie całej serii.
                      const snz = snoozeTarget(note, snoozeTimes().tomorrow9, Date.now());
                      onUpdate(note.id, { reminder: snz.reminder, reminderDay: note.reminderDay, reminderBase: snz.reminderBase });
                      toastWithUndo("Przesunięto na jutro, 9:00", () => onUpdate(note.id, prev), { id: `rem-snooze-${note.id}` });
                    }}
                    className="pressable inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 sm:px-2.5 py-1 coarse:min-h-11 text-2xs font-medium text-muted-foreground hover:text-foreground"
                    aria-label="Jutro rano"
                  >
                    {/* Na telefonie samo „Jutro” — z „rano” oba przyciski nie mieściły się w wąskim kaflu i szły w pion. */}
                    Jutro<span className="max-sm:hidden">rano</span>
                  </button>
                  {/* Krótkie odłożenie: karta miała tylko „jutro”, a „za godzinę” to najczęstszy wybór przy zaległym terminie (1e planu). */}
                  <button
                    type="button"
                    onClick={() => {
                      const prev = { reminder: note.reminder, reminderDay: note.reminderDay, reminderBase: note.reminderBase };
                      haptic("tap");
                      const snz = snoozeTarget(note, snoozeTimes().inHour, Date.now());
                      onUpdate(note.id, { reminder: snz.reminder, reminderDay: note.reminderDay, reminderBase: snz.reminderBase });
                      toastWithUndo("Przesunięto o godzinę", () => onUpdate(note.id, prev), { id: `rem-snooze-${note.id}` });
                    }}
                    className="pressable inline-flex items-center rounded-full bg-foreground/5 px-2 sm:px-2.5 py-1 coarse:min-h-11 text-2xs font-medium text-muted-foreground hover:text-foreground"
                    aria-label="Za godzinę"
                  >
                    +1 h
                  </button>
                </div>
              )}
              {backlinks.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1 min-w-0 text-2xs text-muted-foreground" title="Linkują tu">
                  <Link2 className="w-3 h-3 shrink-0" aria-hidden />
                  <span className="sr-only">Linkują tu:</span>
                  {backlinks.slice(0, BACKLINKS_SHOWN).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onOpenNote?.(b.id); }}
                      className="min-w-0 px-1.5 py-0.5 rounded-full bg-foreground/5 hover:bg-primary/10 hover:text-primary-ink truncate transition-colors"
                    >
                      {b.title || "Bez tytułu"}
                    </button>
                  ))}
                  {backlinks.length > BACKLINKS_SHOWN && <span className="shrink-0">+{backlinks.length - BACKLINKS_SHOWN}</span>}
                </div>
              )}
              {subpage && (
                <div className="mt-1.5 flex items-center gap-1.5 min-w-0 text-2xs text-muted-foreground" data-subpage-row="">
                  {subpage.parentId && (
                    <button
                      type="button"
                      title="Notatka nadrzędna"
                      onClick={(e) => { e.stopPropagation(); onOpenNote?.(subpage.parentId!); }}
                      className="flex min-w-0 items-center gap-1 px-1.5 py-0.5 rounded-full bg-foreground/5 hover:bg-primary/10 hover:text-primary-ink transition-colors"
                    >
                      <CornerLeftUp className="w-3 h-3 shrink-0" aria-hidden />
                      <span className="truncate">{subpage.parentTitle || "Bez tytułu"}</span>
                    </button>
                  )}
                  {subpage.childCount > 0 && (
                    <span className="shrink-0">{subpage.childCount} {pluralPl(subpage.childCount, ["podstrona", "podstrony", "podstron"])}</span>
                  )}
                </div>
              )}
              {trashCountdown && (
                <div className="flex flex-wrap items-center gap-1 mt-2">
                  <div className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium whitespace-nowrap",
                    trashCountdown.urgent ? "bg-destructive/15 text-destructive-ink" : "bg-muted text-muted-foreground"
                  )}>
                    <Trash className="w-3 h-3" />
                    {trashCountdown.label}
                  </div>
                  {onUnarchive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        celebrate(r.left + r.width / 2, r.top + r.height / 2);
                        onUnarchive(note.id);
                      }}
                      className="pressable inline-flex items-center gap-1 px-2 py-0.5 coarse:py-2.5 rounded-full text-2xs font-medium whitespace-nowrap bg-primary/10 text-primary-ink hover:bg-primary/20 transition-colors"
                      title="Przywróć notatkę"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Przywróć
                    </button>
                  )}
                </div>
              )}
              {/* Liczba słów jest w czytniku — na wąskim kaflu łamała stopkę na trzy linie. */}
              <div className="card-meta flex items-center gap-1.5 mt-1.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                {showReadingTime && wordCount > 0 && readMin >= 2 && <><span>~{readMin} min</span><span aria-hidden>·</span></>}
                <span className="tabular-nums">{format(new Date(note.updatedAt), "d MMM", { locale: pl })}</span>
              </div>
    </>
  );
}
