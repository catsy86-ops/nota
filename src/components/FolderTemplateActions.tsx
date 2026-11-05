import { ChevronDown, FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageActions } from "@/components/PageActions";
import { templateChoices, type TemplateChoice } from "@/components/QuickTemplates";
import { useCustomTemplates } from "@/lib/customTemplates";
import type { Folder } from "@/hooks/useNotes";

const NONE = "__none";

/**
 * Domyślny szablon folderu (nowy plan 5.9) w akcjach główki widoku folderu: wybór szablonu
 * (zapis w folderze, jedna wartość LWW w Yjs) i „Nowa: <szablon>”, które tworzy notatkę w tym
 * folderze z szablonu i otwiera ją do edycji. Szablon własny, którego to urządzenie nie zna
 * (zapisany na innym), jest pokazany jako brak.
 */
export function FolderTemplateActions({ folder, onSetTemplate, onCreate }: {
  folder: Folder;
  onSetTemplate: (templateId: string | undefined) => void;
  onCreate: (t: TemplateChoice) => void;
}) {
  const custom = useCustomTemplates();
  const choices = templateChoices(custom);
  const current = folder.templateId ? choices.find((c) => c.id === folder.templateId) ?? null : null;

  return (
    <PageActions>
      {current && (
        <Button size="sm" onClick={() => onCreate(current)} className="gap-1.5 coarse:h-11" data-testid="folder-template-new">
          <FilePlus2 className="h-4 w-4" aria-hidden />Nowa: {current.label}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1 coarse:h-11" aria-label={`Domyślny szablon folderu: ${current?.label ?? "brak"}`}>
            {current ? <span aria-hidden>{current.emoji}</span> : null}
            {current ? "Szablon" : "Domyślny szablon"}
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Nowe notatki w folderze „{folder.name}”</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={current?.id ?? NONE}
            onValueChange={(v) => {
              const next = v === NONE ? undefined : v;
              const prev = folder.templateId;
              onSetTemplate(next);
              const label = choices.find((c) => c.id === next)?.label;
              toast.success(label ? `Domyślny szablon folderu: ${label}` : "Folder bez domyślnego szablonu", {
                action: { label: "Cofnij", onClick: () => onSetTemplate(prev) },
              });
            }}
          >
            <DropdownMenuRadioItem value={NONE}>Bez szablonu</DropdownMenuRadioItem>
            {choices.map((c) => (
              <DropdownMenuRadioItem key={c.id} value={c.id}><span aria-hidden className="mr-1.5">{c.emoji}</span>{c.label}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </PageActions>
  );
}
