import { Repeat } from "lucide-react";
import type { Note } from "@/hooks/useNotes";
import { ReminderQuickActions } from "@/components/ReminderQuickActions";
import { formatReminderShort } from "@/lib/reminderTime";
import { REPEAT_KIND_LABELS, ruleOf } from "@/lib/reminderRepeat";
import { cn } from "@/lib/utils";

export interface ReminderListGroup {
  key: string;
  label: string;
  notes: Note[];
  tone?: "alert" | "default";
}

interface ReminderListGroupsProps {
  groups: ReminderListGroup[];
  onOpen: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<Note, "reminder" | "reminderDay" | "reminderBase" | "reminderRepeatUntil">>) => void;
}

/**
 * Terminy jako lista (2.6, widok „Lista”): wiersz jak na Dziś — tytuł, termin w mono, odznaka serii,
 * akcje przy terminie. Grupy i kolejność dostaje od rodzica (`groupReminders`).
 */
export function ReminderListGroups({ groups, onOpen, onUpdate }: ReminderListGroupsProps) {
  return (
    <div className="space-y-5" data-reminders-list>
      {groups.map((g) => (
        <section key={g.key} data-reminders-list-group={g.key} aria-label={g.label}>
          <h2 className={cn("text-xs font-medium mb-1", g.tone === "alert" ? "text-destructive-ink" : "text-muted-foreground")}>
            {g.label} <span className="tabular-nums">({g.notes.length})</span>
          </h2>
          <ul className="divide-y divide-border/50 rounded-card border border-border/70 bg-card">
            {g.notes.map((n) => (
              <li key={n.id} className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => onOpen(n.id)} className="pressable flex min-w-0 flex-1 items-center gap-2 text-left coarse:min-h-11">
                  <span className="min-w-0 flex-1 truncate text-sm">{n.title || n.content.trim().split("\n")[0] || "Bez tytułu"}</span>
                  {ruleOf(n).kind !== "none" && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-2xs text-muted-foreground" title={REPEAT_KIND_LABELS[ruleOf(n).kind]}>
                      <Repeat className="h-3 w-3" aria-hidden />
                      <span className="sr-only">Seria: {REPEAT_KIND_LABELS[ruleOf(n).kind].toLowerCase()}</span>
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {n.reminder !== null ? formatReminderShort(n.reminder) : ""}
                  </span>
                </button>
                <ReminderQuickActions note={n} onUpdate={onUpdate} className="shrink-0 justify-end" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
