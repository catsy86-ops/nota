import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InboxCapture, type InboxCaptureExtras } from "@/components/InboxCapture";

/**
 * Skrzynka 2.3: przechwycenie z każdego miejsca (`Alt+K`, paleta „Do skrzynki…”, skrót PWA `?skrzynka=1`).
 * To samo pole co na górze Skrzynki, w małym oknie — widok pod spodem się nie zmienia. Po zapisie okno się
 * zamyka, a dymek z „Cofnij” mówi, dokąd trafiła notatka (rodzic, `captureToInbox`).
 */
export function QuickInboxDialog({ open, onOpenChange, onCapture, onFiles, labels, folders }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (title: string, content: string, extras: InboxCaptureExtras) => void;
  onFiles: (files: File[], text: string) => void;
  labels: string[];
  folders: { id: string; name: string }[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="quick-inbox">
        <DialogHeader>
          <DialogTitle>Do skrzynki</DialogTitle>
          <DialogDescription>Enter zapisuje. Posortujesz później w Skrzynce.</DialogDescription>
        </DialogHeader>
        <InboxCapture
          labels={labels}
          folders={folders}
          onCapture={(title, content, extras) => { onCapture(title, content, extras); onOpenChange(false); }}
          onFiles={(files, text) => { onFiles(files, text); onOpenChange(false); }}
        />
      </DialogContent>
    </Dialog>
  );
}
