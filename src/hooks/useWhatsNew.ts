import { useEffect } from "react";
import { toast } from "sonner";
import { APP_VERSION, CHANGELOG } from "@/content/changelog";
import { lastSeenVersionStore, whatsNewDecision } from "@/lib/whatsNew";

/** Jednorazowy dymek „Co nowego” po zmianie wersji (U-4). Najwyżej 5 punktów; pełna lista w changelog.ts. */
export function useWhatsNew(): void {
  useEffect(() => {
    try {
      const decision = whatsNewDecision(lastSeenVersionStore.get(), APP_VERSION);
      if (decision === "none") return;
      lastSeenVersionStore.set(APP_VERSION);
      if (decision === "remember") return;
      const entry = CHANGELOG.find((e) => e.version === APP_VERSION);
      if (!entry) return;
      toast(`Co nowego w wersji ${APP_VERSION}`, {
        id: "whats-new",
        description: entry.items.slice(0, 5).map((s) => `• ${s}`).join("\n"),
        duration: 20000,
      });
    } catch {
      // Brak dostępu do pamięci: dymek jest tylko dodatkiem, więc nic nie robimy.
    }
  }, []);
}
