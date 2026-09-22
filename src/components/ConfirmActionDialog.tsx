import { useCallback, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Archive, Trash2 } from "lucide-react";
import { getConfirmPrefs, setConfirmPref, type ConfirmKey } from "@/lib/confirmPrefs";

interface PendingAction {
  kind: ConfirmKey;
  title: string;
  description: string;
  run: () => void;
}

const META: Record<ConfirmKey, { heading: string; cta: string; icon: typeof Trash2; tone: string }> = {
  trash: { heading: "Przenieść do kosza?", cta: "Przenieś do kosza", icon: Trash2, tone: "text-destructive" },
  archive: { heading: "Zarchiwizować?", cta: "Archiwizuj", icon: Archive, tone: "text-primary" },
};

/**
 * Friendly confirmation gate for destructive actions.
 * Skips the dialog when the user checked "Nie pytaj ponownie".
 */
export function useConfirmAction() {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [dontAsk, setDontAsk] = useState(false);

  const confirmAction = useCallback((action: PendingAction) => {
    if (!getConfirmPrefs()[action.kind]) {
      action.run();
      return;
    }
    setDontAsk(false);
    setPending(action);
  }, []);

  const accept = useCallback(() => {
    if (!pending) return;
    if (dontAsk) setConfirmPref(pending.kind, false);
    pending.run();
    setPending(null);
  }, [pending, dontAsk]);

  const meta = pending ? META[pending.kind] : null;
  const Icon = meta?.icon;

  const dialog = (
    <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {Icon && meta && <Icon className={`w-4 h-4 ${meta.tone}`} />}
            {pending ? meta?.heading : ""}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.description}
            <span className="block mt-2 text-xs">
              Spokojnie — zaraz po akcji pojawi się przycisk „Cofnij”.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <Checkbox checked={dontAsk} onCheckedChange={(v) => setDontAsk(v === true)} />
          Nie pytaj ponownie
        </label>

        <AlertDialogFooter>
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={accept}>{meta?.cta ?? "OK"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirmAction, confirmDialog: dialog };
}
