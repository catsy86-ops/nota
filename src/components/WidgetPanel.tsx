import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TodayDueList } from "@/components/review/TodayDueList";
import { countDueToday } from "@/lib/reminderAgenda";
import type { Note } from "@/hooks/useNotes";

/**
 * Widżet „Na dziś” (widok `widget`, adres `/widzet`): terminy na dziś i szybkie dodanie notatki,
 * bez siatki wszystkich notatek. Gotowy do przypięcia jako skrót na ekranie głównym (PWA).
 */
export function WidgetPanel({ notes, onOpen, onOpenToday, onNew, onUpdate }: {
  notes: Note[];
  onOpen: (id: string) => void;
  onOpenToday: () => void;
  onNew: () => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
}) {
  const due = countDueToday(notes);
  return (
    <section aria-label="Widżet na dziś" data-testid="widget-panel" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg">Na dziś</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onNew} className="coarse:h-11">
            <Plus className="mr-1 h-4 w-4" aria-hidden />Nowa notatka
          </Button>
          <Button variant="ghost" size="sm" onClick={onOpenToday} className="coarse:h-11">Cały dzień</Button>
        </div>
      </div>
      {due === 0 ? (
        <p className="text-sm text-muted-foreground">Nic na dziś. Dobry moment, żeby coś zapisać.</p>
      ) : (
        <TodayDueList notes={notes} onOpen={onOpen} onOpenReminders={onOpenToday} onUpdate={onUpdate} />
      )}
    </section>
  );
}
