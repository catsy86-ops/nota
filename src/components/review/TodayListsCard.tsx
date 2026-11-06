import { useState } from "react";
import { ListChecks } from "lucide-react";
import type { Note } from "@/hooks/useNotes";
import { SectionCard } from "@/components/ui/section-card";
import { CheckMark } from "@/components/ui/check-mark";
import { collapseRowThen } from "@/lib/collapseRow";
import { haptic } from "@/lib/haptics";
import { toastWithUndo } from "@/lib/undoToast";
import { checkItem, todayListRows } from "@/lib/todayLists";

/**
 * Dziś 4.2: pozycje list zmienionych dziś albo z terminem dziś, do odhaczenia bez otwierania notatki.
 * Odhaczenie jak „Gotowe” w Terminach (nowy plan 4.2): rysowany ptaszek, zwinięcie wiersza, zapis, „Cofnij”.
 * Karta znika, gdy nie ma czego odhaczać. Nagroda „Dzień zamknięty” liczy listy jak dotąd (z notatek).
 */
export function TodayListsCard({ notes, onOpen, onUpdate }: {
  notes: Note[];
  onOpen: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
}) {
  const [checking, setChecking] = useState<string | null>(null);
  const { rows, more } = todayListRows(notes, new Date());
  if (rows.length === 0) return null;

  function check(el: HTMLElement, noteId: string, itemId: string) {
    if (checking) return;
    haptic("success");
    setChecking(itemId);
    collapseRowThen(el, () => {
      const n = notes.find((x) => x.id === noteId);
      setChecking(null);
      if (!n) return;
      const before = n.checklist;
      onUpdate(noteId, { checklist: checkItem(before, itemId) });
      toastWithUndo("Odhaczono", () => onUpdate(noteId, { checklist: before }), { id: `today-list-${itemId}` });
    });
  }

  return (
    <SectionCard icon={ListChecks} title="Listy na dziś" data-testid="today-lists" bodyClassName="space-y-1">
      <ul className="divide-y divide-border/50">
        {rows.map((r) => (
          <li key={r.item.id} className="flex items-center gap-2 py-1.5">
            <button
              type="button"
              role="checkbox"
              aria-checked={checking === r.item.id}
              aria-label={`Odhacz: ${r.item.text}`}
              onClick={(e) => check(e.currentTarget, r.noteId, r.item.id)}
              className="group/check grid shrink-0 place-items-center rounded-control p-1 -m-1 coarse:size-11"
            >
              <CheckMark checked={checking === r.item.id} />
            </button>
            <span className="min-w-0 flex-1 truncate text-sm">{r.item.text}</span>
            <button type="button" onClick={() => onOpen(r.noteId)}
              className="max-w-[40%] shrink-0 truncate text-xs text-muted-foreground hover:text-foreground hover:underline coarse:min-h-11">
              {r.noteTitle}
            </button>
          </li>
        ))}
      </ul>
      {more > 0 && <p className="ui-hint">i jeszcze {more} w notatkach</p>}
    </SectionCard>
  );
}
