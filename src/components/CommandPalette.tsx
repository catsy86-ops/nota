import { useEffect, useState } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { StickyNote, Archive, Bell, Trash, Plus, Moon, Sparkles, Trophy, Calendar, Brain } from "lucide-react";
import type { Note } from "@/hooks/useNotes";

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  run: () => void;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: Note[];
  onOpenNote: (id: string) => void;
  onNewNote: () => void;
  onGo: (view: "notes" | "today" | "week" | "archive" | "reminders" | "trash" | "widget") => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenStats: () => void;
  onOpenFocusMode: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  notes,
  onOpenNote,
  onNewNote,
  onGo,
  onToggleTheme,
  onOpenSettings,
  onOpenStats,
  onOpenFocusMode,
}: Props) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  function run(fn: () => void) {
    onOpenChange(false);
    setTimeout(fn, 0);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Szukaj notatek lub akcji…" value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-2">
            <span>Brak wyników.</span>
            {search.trim() && (
              <button
                type="button"
                onClick={() => run(onNewNote)}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Utwórz notatkę „{search.trim()}”
              </button>
            )}
          </div>
        </CommandEmpty>
        <CommandGroup heading="Akcje">
          <CommandItem onSelect={() => run(onNewNote)}>
            <Plus className="w-4 h-4 mr-2" /> Nowa notatka <span className="ml-auto text-xs text-muted-foreground">Ctrl+N</span>
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenSettings)}>
            <Sparkles className="w-4 h-4 mr-2" /> Ustawienia
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenStats)}>
            <Trophy className="w-4 h-4 mr-2" /> Statystyki i osiągnięcia
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenFocusMode)}>
            <Brain className="w-4 h-4 mr-2" /> Tryb skupienia
          </CommandItem>
          <CommandItem onSelect={() => run(onToggleTheme)}>
            <Moon className="w-4 h-4 mr-2" /> Przełącz motyw jasny/ciemny
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Nawigacja">
          <CommandItem onSelect={() => run(() => onGo("notes"))}>
            <StickyNote className="w-4 h-4 mr-2" /> Notatki
          </CommandItem>
          <CommandItem onSelect={() => run(() => onGo("today"))}>
            <Calendar className="w-4 h-4 mr-2" /> Dziś <span className="ml-auto text-xs text-muted-foreground">Alt+T</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => onGo("reminders"))}>
            <Bell className="w-4 h-4 mr-2" /> Przypomnienia
          </CommandItem>
          <CommandItem onSelect={() => run(() => onGo("archive"))}>
            <Archive className="w-4 h-4 mr-2" /> Archiwum
          </CommandItem>
          <CommandItem onSelect={() => run(() => onGo("trash"))}>
            <Trash className="w-4 h-4 mr-2" /> Kosz
          </CommandItem>
        </CommandGroup>
        {notes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Notatki">
              {notes.slice(0, 30).map((n) => (
                <CommandItem key={n.id} value={`${n.title} ${n.content}`} onSelect={() => run(() => onOpenNote(n.id))}>
                  <StickyNote className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span className="truncate">{n.title || n.content.slice(0, 60) || "(bez tytułu)"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
