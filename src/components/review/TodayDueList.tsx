import { useBump } from "@/hooks/useBump";
import { BellRing, ChevronRight, Lock } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { noteListTitle } from "@/lib/noteListTitle";
import { Button } from "@/components/ui/button";
import type { Note } from "@/hooks/useNotes";
import { useDayClock } from "@/lib/dayClock";
import { groupReminders, type AgendaGroupKey } from "@/lib/reminderAgenda";
import { formatReminderShort } from "@/lib/reminderTime";
import { ReminderQuickActions } from "@/components/ReminderQuickActions";
import { cn } from "@/lib/utils";
import { useNextBoundary } from "@/hooks/useNextBoundary";

/** Ile pozycji z grupy pokazujemy na „Dziś”; reszta jest w widoku Przypomnień. */
const SHOWN_PER_GROUP = 4;

const GROUP_TONE: Record<Extract<AgendaGroupKey, "overdue" | "missed" | "today">, string> = {
  overdue: "text-destructive-ink",
  missed: "text-destructive-ink",
  today: "text-primary-ink",
};

/** Dziś 3.3: kropka przy nazwie grupy — kolor niesie stan, tekst zostaje czytelny w kolorze nagłówka. */
const GROUP_DOT: Record<keyof typeof GROUP_TONE, string> = {
  overdue: "bg-destructive",
  missed: "bg-destructive/60",
  today: "bg-primary",
};

/**
 * Zaległe i dzisiejsze przypomnienia w widoku „Dziś”. Grupowanie to samo co w widoku
 * Przypomnień (`groupReminders`), więc liczby się zgadzają. Pokazujemy tylko te dwie grupy —
 * dalsze terminy są w Przypomnieniach.
 */
export function TodayDueList({ notes, onOpen, onOpenReminders, onUpdate }: { notes: Note[]; onOpen: (id: string) => void; onOpenReminders: () => void; /** Brak = wiersze bez akcji „Gotowe / Jutro / +1 h”. */ onUpdate?: (id: string, patch: Partial<Note>) => void }) {
  // Subskrypcja zmiany doby (północ, powrót na kartę): po niej komponent renderuje się ponownie,
  // a `Date.now()` poniżej jest świeże. Bez tego przypomnienie, które minęło, nie przechodzi do „Zaległe”.
  useDayClock();
  // T 1.1: termin przechodzi z „Dziś” do „Zaległe” o swojej godzinie, bez czekania na północ.
  useNextBoundary(notes);
  // Archiwum też: jego przypomnienia nadal dzwonią, więc muszą być widoczne i liczone jak reszta.
  const groups = groupReminders(notes.filter((n) => !n.trashed), Date.now()).filter((g) => g.key === "overdue" || g.key === "missed" || g.key === "today");
  const total = groups.reduce((n, g) => n + g.notes.length, 0);
  // Dziś 3.5: licznik „pyka” przy zmianie (nie przy wejściu w widok).
  const bump = useBump(total);
  // Dziś 2.3: przy pustym dniu najbliższy termin (najwcześniejszy przyszły, poza koszem).
  const now = Date.now();
  const next = total > 0 ? null : notes.reduce<Note | null>((best, n) => (!n.trashed && n.reminder !== null && n.reminder > now && (!best || n.reminder < best.reminder!) ? n : best), null);

  // Dziś 3.6: bez dzisiejszych i bez przyszłych terminów karta nic nie mówi — pusty dzień pokazuje karta zmiany.
  if (total === 0 && !next) return null;

  return (
    <SectionCard aria-label="Przypomnienia" data-testid="today-due" icon={BellRing} bodyClassName="space-y-3"
      title={<>Terminy{total > 0 && <span key={bump} className={cn("stamp-tag normal-case text-primary-ink", bump > 0 && "count-bump")} data-testid="today-due-count">{total}</span>}</>}
      action={
        <Button variant="ghost" size="sm" onClick={onOpenReminders} className="coarse:h-11">
          Wszystkie<ChevronRight className="ml-0.5 h-4 w-4" aria-hidden />
        </Button>
      }>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nic nie czeka na dziś.
          {next && (
            <>
              {" "}Najbliższy:{" "}
              <button type="button" onClick={() => onOpen(next.id)} className="font-medium text-foreground underline-offset-2 hover:underline coarse:min-h-11" data-testid="today-next">
                <span className="font-mono tabular-nums">{formatReminderShort(next.reminder!)}</span> — {noteListTitle(next)}
              </button>
            </>
          )}
        </p>
      ) : (
        groups.map((g) => {
          const key = g.key as "overdue" | "missed" | "today";
          const shown = g.notes.slice(0, SHOWN_PER_GROUP);
          const rest = g.notes.length - shown.length;
          return (
            <div key={g.key} data-due-group={g.key}>
              <h3 className={cn("section-label text-xs", GROUP_TONE[key])}>
                <span aria-hidden className={cn("size-1.5 rounded-full", GROUP_DOT[key])} />
                {g.label}
                <span className="font-mono font-normal tabular-nums text-muted-foreground">{g.notes.length}</span>
              </h3>
              <ul className="mt-1 divide-y divide-border/50">
                {shown.map((n) => (
                  <li key={n.id} className="flex items-center gap-2 py-2">
                    <button
                      type="button"
                      onClick={() => onOpen(n.id)}
                      className="pressable flex min-w-0 flex-1 items-center gap-3 text-left coarse:min-h-11"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
                        {n.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                        <span className="truncate">{noteListTitle(n)}</span>
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {n.reminder !== null ? formatReminderShort(n.reminder) : ""}
                      </span>
                    </button>
                    {onUpdate && <ReminderQuickActions note={n} onUpdate={onUpdate} className="shrink-0 justify-end" />}
                  </li>
                ))}
              </ul>
              {rest > 0 && (
                <button type="button" onClick={onOpenReminders} className="mt-1 inline-flex items-center text-xs text-muted-foreground hover:text-foreground coarse:min-h-11">
                  i jeszcze {rest} w Przypomnieniach
                </button>
              )}
            </div>
          );
        })
      )}
    </SectionCard>
  );
}
