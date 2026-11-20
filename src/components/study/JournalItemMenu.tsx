import { Button } from "@/components/ui/button";
import { CircleCheck, Copy, Ellipsis, Pencil, RotateCcw, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { haptic } from "@/lib/haptics";
import { shareOrCopy } from "@/lib/shareOrCopy";
import { toastWithUndo } from "@/lib/undoToast";
import { openJournalEdit } from "@/lib/study/entrySheet";
import { entryShareText } from "@/lib/study/journalView";
import { removeJournalEntry, restoreJournalEntry, type JournalEntry } from "@/lib/study/store";

/**
 * Menu „⋯” przy wpisie dziennika (prośba właściciela 2026-10-30): edycja w tym samym arkuszu co nowy wpis,
 * rozwiązanie problemu, kopiowanie i wysyłka tekstu, usunięcie z „Cofnij”. Zastępuje sam ołówek.
 */
export function JournalItemMenu({ entry: e, resolved, onToggleResolved }: {
  entry: JournalEntry;
  resolved: boolean;
  onToggleResolved: () => void;
}) {
  const item = "gap-2 coarse:min-h-11";

  async function copy() {
    try {
      await navigator.clipboard.writeText(entryShareText(e));
      toast.success("Skopiowano wpis");
    } catch {
      toast.error("Nie udało się skopiować");
    }
  }

  async function share() {
    const outcome = await shareOrCopy({ title: e.site.trim() || "Wpis z budowy", text: entryShareText(e) });
    if (outcome === "copied") toast.success("Skopiowano wpis — wklej, gdzie trzeba");
    else if (outcome === "failed") toast.error("Nie udało się udostępnić ani skopiować");
  }

  function remove() {
    const removed = removeJournalEntry(e.id);
    if (!removed) return;
    haptic("tap");
    toastWithUndo("Usunięto wpis", () => restoreJournalEntry(removed), { id: "journal-removed" });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          aria-label="Opcje wpisu"
          title="Edytuj, kopiuj, usuń"
          variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground data-[state=open]:bg-muted"
        >
          <Ellipsis className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem onSelect={() => openJournalEdit(e)} className={item}>
          <Pencil className="size-4" aria-hidden />Edytuj wpis
        </DropdownMenuItem>
        {e.kind === "problem" && (
          <DropdownMenuItem onSelect={onToggleResolved} className={item}>
            {resolved ? <RotateCcw className="size-4" aria-hidden /> : <CircleCheck className="size-4" aria-hidden />}
            {resolved ? "Otwórz problem ponownie" : "Oznacz jako rozwiązany"}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => void copy()} className={item}>
          <Copy className="size-4" aria-hidden />Kopiuj tekst
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void share()} className={item}>
          <Share2 className="size-4" aria-hidden />Udostępnij
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={remove} className={`${item} text-destructive-ink focus:text-destructive-ink`}>
          <Trash2 className="size-4" aria-hidden />Usuń wpis
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
