import * as React from "react";
import { DialogContent, DialogFooter } from "@/components/ui/dialog";

/**
 * Okno-formularz (decyzja D2): na komputerze zwykłe okno na środku, na telefonie (`phone:`, także
 * w poziomie) arkusz od dołu — pola i „Zapisz” są w zasięgu kciuka. Pasek przycisków
 * (`ResponsiveDialogFooter`) przykleja się do dołu arkusza, więc długi formularz nie chowa „Zapisz”
 * pod przewinięciem. Okna, które nie są formularzami (podgląd, statystyki, skróty), zostają przy
 * `DialogContent` — wyśrodkowane z marginesem.
 *
 * Reszta API jak w `ui/dialog.tsx`: `Dialog`, `DialogHeader`, `DialogTitle`, `DialogDescription`.
 */
export const ResponsiveDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  Omit<React.ComponentPropsWithoutRef<typeof DialogContent>, "sheet">
>((props, ref) => <DialogContent ref={ref} sheet {...props} />);
ResponsiveDialogContent.displayName = "ResponsiveDialogContent";

/** Przyciski formularza; w arkuszu przyklejone do dołu (styl `[data-dialog-sheet] [data-dialog-footer]` w index.css). */
export const ResponsiveDialogFooter = DialogFooter;
