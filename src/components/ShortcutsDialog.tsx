import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SHORTCUT_GROUPS, shortcutFor } from "@/lib/shortcuts";
import { cheatSheetGroups } from "@/lib/commands/registry";
import { registerBuiltinCommands } from "@/lib/commands/builtin";
import { fold } from "@/lib/fold";

registerBuiltinCommands();

interface SheetGroup {
  heading: string;
  items: { key: string; label: string; keys: string[] }[];
}

/**
 * Ściąga skrótów pod „?” (Q5.2): klawisze z `lib/shortcuts.ts` i polecenia palety z rejestru (`lib/commands`) —
 * jedno źródło dla palety, podpowiedzi i ściągi. Pole szukania filtruje po nazwie i klawiszu, bez polskich znaków.
 */
export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const groups = useMemo<SheetGroup[]>(() => {
    const keys: SheetGroup[] = SHORTCUT_GROUPS.map((g) => ({ heading: g.heading, items: g.items.map((i, n) => ({ key: `${g.heading}-${n}`, label: i.label, keys: i.keys })) }));
    const palette = shortcutFor("Paleta poleceń");
    const commands: SheetGroup[] = cheatSheetGroups().map((g) => ({
      heading: `Paleta poleceń${palette ? ` (${palette})` : ""}: ${g.heading}`,
      items: g.items.map((i) => ({ key: i.id, label: i.label, keys: i.shortcut ? i.shortcut.split("+") : [] })),
    }));
    return [...keys, ...commands];
  }, []);
  const q = fold(query.trim());
  const shown = q
    ? groups.map((g) => ({ ...g, items: g.items.filter((i) => fold(`${i.label} ${i.keys.join(" ")} ${g.heading}`).includes(q)) })).filter((g) => g.items.length > 0)
    : groups;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQuery(""); }}>
      <DialogContent className="max-w-lg max-h-dialog overflow-y-auto" data-testid="shortcuts-dialog">
        <DialogHeader>
          <DialogTitle>Skróty klawiszowe</DialogTitle>
        </DialogHeader>
        <Input type="search" enterKeyHint="search" aria-label="Szukaj skrótu lub polecenia" placeholder="Szukaj, np. kopia, skrzynka, Alt…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="space-y-5">
          {shown.length === 0 && <p className="ui-hint">Nic nie pasuje do „{query.trim()}”. Spróbuj innego słowa albo klawisza.</p>}
          {shown.map((group) => (
            <div key={group.heading}>
              <h3 className="text-xs text-muted-foreground font-semibold mb-2">{group.heading}</h3>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-4 text-sm">
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
