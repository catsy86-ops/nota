import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MOD_KEY } from "@/lib/platform";

interface ShortcutGroup {
  heading: string;
  items: { keys: string[]; label: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    heading: "Ogólne",
    items: [
      { keys: [MOD_KEY, "N"], label: "Nowa notatka" },
      { keys: [MOD_KEY, "K"], label: "Paleta poleceń" },
      { keys: [MOD_KEY, "Z"], label: "Cofnij ostatnią akcję" },
      { keys: ["/"], label: "Fokus na wyszukiwarkę" },
      { keys: ["Alt", "S"], label: "Fokus na wyszukiwarkę" },
      { keys: ["Alt", "T"], label: "Przejdź do „Dziś”" },
      { keys: ["Alt", "W"], label: "Przejdź do „Ten tydzień”" },
      { keys: ["Esc"], label: "Zamknij panel / wyczyść zaznaczenie" },
      { keys: ["?"], label: "Pokaż tę listę skrótów" },
    ],
  },
  {
    // Operatory łączą się ze sobą i ze zwykłym tekstem: „label:praca has:reminder raport”.
    heading: "Wyszukiwanie",
    items: [
      { keys: ["label:praca"], label: "Notatki z etykietą" },
      { keys: ["color:mint"], label: "Notatki w kolorze" },
      { keys: ["has:reminder"], label: "Z przypomnieniem" },
      { keys: ["has:checklist"], label: "Z listą zadań" },
      { keys: ["has:image"], label: "Ze zdjęciem" },
    ],
  },
  {
    heading: "Lista notatek",
    items: [
      { keys: ["←", "→", "↑", "↓"], label: "Nawigacja między notatkami" },
      { keys: ["Home", "End"], label: "Pierwsza / ostatnia notatka" },
      { keys: ["Spacja"], label: "Szybki podgląd" },
      { keys: ["Enter"], label: "Otwórz notatkę" },
      { keys: ["Delete"], label: "Usuń zaznaczoną notatkę" },
      { keys: ["A"], label: "Archiwizuj" },
      { keys: ["P"], label: "Przypnij / odepnij" },
      { keys: ["D"], label: "Duplikuj" },
    ],
  },
  {
    heading: "Szybki podgląd",
    items: [
      { keys: ["↑", "↓", "PgUp", "PgDn"], label: "Przewiń treść" },
      { keys: ["Enter"], label: "Edytuj notatkę" },
      { keys: ["Spacja", "Esc"], label: "Zamknij podgląd" },
    ],
  },
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Skróty klawiszowe</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {GROUPS.map((group) => (
            <div key={group.heading}>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">{group.heading}</h3>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-foreground/90">{item.label}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-muted-foreground text-xs">/</span>}
                          <kbd className="font-mono text-xs font-semibold bg-muted border border-border/60 rounded px-1.5 py-0.5 text-foreground/80">
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
