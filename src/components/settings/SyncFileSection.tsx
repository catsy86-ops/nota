import { FileDown, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { exportSyncFile, importSyncFile } from "@/lib/yjsFileSync";
import { Section } from "./SettingsShared";

async function exportSyncNow() {
  try {
    await exportSyncFile();
    toast.success("Plik synchronizacji pobrany — wczytaj go na drugim urządzeniu");
  } catch {
    toast.error("Nie udało się zapisać pliku synchronizacji");
  }
}

function newNotesLabel(n: number): string {
  if (n === 1) return "1 nowa notatka";
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  return `${n} ${few ? "nowe notatki" : "nowych notatek"}`;
}

async function mergeSyncNow() {
  try {
    const { newNotes } = await importSyncFile();
    toast.success(newNotes ? `Scalono — ${newNotesLabel(newNotes)}` : "Scalono — zmiany z pliku są już w notatkach");
  } catch (err) {
    if (err instanceof Error && err.message !== "Nie wybrano pliku") {
      toast.error("Nie udało się scalić pliku: " + err.message);
    }
  }
}

/** Sekcja „Synchronizacja przez plik” — przeniesiona z Dane do karty Sync (faza 2a: cała synchronizacja w jednym miejscu). */
export function SyncFileSection() {
  return (
      <Section title="Synchronizacja przez plik">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button onClick={exportSyncNow} variant="outline" className="gap-2">
            <FileDown className="w-4 h-4" /> Zapisz plik synchronizacji
          </Button>
          <Button onClick={mergeSyncNow} variant="outline" className="gap-2">
            <GitMerge className="w-4 h-4" /> Scal z pliku
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          Przenosi zmiany między urządzeniami bez połączenia na żywo. Scalanie łączy notatki i Grafik zmian z obu stron — nic nie usuwa i nie nadpisuje. Używaj świeżych plików: bardzo stary może przywrócić dawno usuniętą notatkę.
        </p>
      </Section>
  );
}
