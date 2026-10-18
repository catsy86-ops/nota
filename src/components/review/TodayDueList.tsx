import { useMemo } from "react";
import { BellRing, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Note } from "@/hooks/useNotes";
import { groupReminders, type AgendaGroupKey } from "@/lib/reminderAgenda";
import { formatReminderShort } from "@/lib/reminderTime";
import { cn } from "@/lib/utils";

/** Ile pozycji z grupy pokazujemy na „Dziś”; reszta jest w widoku Przypomnień. */
const SHOWN_PER_GROUP = 4;

const GROUP_TONE: Record<Extract<AgendaGroupKey, "overdue" | "today">, string> = {
  overdue: "text-destructive-ink",
  today: "text-primary-ink",
};

/**
 * Zaległe i dzisiejsze przypomnienia w widoku „Dziś”. Grupowanie to samo co w widoku
 * Przypomnień (`groupReminders`), więc liczby się zgadzają. Pokazujemy tylko te dwie grupy —
 * dalsze terminy są w Przypomnieniach.
 */
export function TodayDueList({ notes, onOpen, onOpenReminders }: { notes: Note[]; onOpen: (id: string) => void; onOpenReminders: () => void }) {
  const groups = useMemo(
    () => groupReminders(notes.filter((n) => !n.archived && !n.trashed)).filter((g) => g.key === "overdue" || g.key === "today"),
    [notes],
  );
  const total = groups.reduce((n, g) => n + g.notes.length, 0);

  return (
    <section aria-label="Zaległe i dziś" data-testid="today-due" className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-label gap-2">
          <BellRing className="h-3.5 w-3.5" aria-hidden />
          Przypomnienia
          {total > 0 && <span className="stamp-tag normal-case text-primary-ink" data-testid="today-due-count">{total}</span>}
        </h2>
        <Button variant="ghost" size="sm" onClick={onOpenReminders} className="coarse:h-11">
          Wszystkie<ChevronRight className="ml-0.5 h-4 w-4" aria-hidden />
        </Button>
      </div>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Nic nie czeka na dziś.</p>
      ) : (
        groups.map((g) => {
          const key = g.key as "overdue" | "today";
          const shown = g.notes.slice(0, SHOWN_PER_GROUP);
          const rest = g.notes.length - shown.length;
          return (
            <div key={g.key} data-due-group={g.key}>
              <h3 className={cn("text-xs font-medium", GROUP_TONE[key])}>{g.label}</h3>
              <ul className="mt-1 divide-y divide-border/50">
                {shown.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(n.id)}
                      className="pressable flex w-full items-center gap-3 py-2 text-left coarse:min-h-11"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">{n.title || n.content.trim().split("\n")[0] || "Bez tytułu"}</span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {n.reminder !== null ? formatReminderShort(n.reminder) : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {rest > 0 && (
                <button type="button" onClick={onOpenReminders} className="mt-1 text-xs text-muted-foreground hover:text-foreground">
                  i jeszcze {rest} w Przypomnieniach
                </button>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
