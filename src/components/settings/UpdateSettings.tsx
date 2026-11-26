import { useState, useSyncExternalStore } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/content/changelog";
import { setAutoUpdate, useAutoUpdate } from "@/lib/autoUpdate";
import { getSwInfo, refreshToLatest, subscribeSwInfo } from "@/lib/registerSW";
import { Section, ToggleRow } from "./SettingsShared";

/**
 * Ustawienia → Ogólne → „Aktualizacje”: „Odśwież aktualizacje” (sprawdza i od razu instaluje nową wersję) i przełącznik
 * auto-aktualizacji (`lib/autoUpdate.ts`). Bez service workera (tryb deweloperski, aplikacja Android) przycisku nie ma.
 */
export function UpdateSettings() {
  const sw = useSyncExternalStore(subscribeSwInfo, getSwInfo, getSwInfo);
  const auto = useAutoUpdate();
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    const r = await refreshToLatest();
    setBusy(false);
    if (r === "current") toast.success("Masz najnowszą wersję", { description: `Wersja ${APP_VERSION}.` });
    else if (r === "offline") toast.error("Nie udało się sprawdzić — brak połączenia z siecią");
    else if (r === "unsaved") toast("Nowa wersja czeka na zapis ostatniej zmiany", { description: "Spróbuj za chwilę — wtedy podmieni się bez utraty tekstu." });
    else if (r === "applying") toast("Instaluję nową wersję…", { description: "Aplikacja za moment się odświeży." });
  }

  return (
    <div id="ogolne-aktualizacje" className="scroll-mt-14 space-y-4">
      <Section title="Aktualizacje">
        <div className="flex flex-wrap items-center gap-3">
          {sw.state === "off" ? (
            <p className="ui-hint">Tutaj aktualizacja działa inaczej: w aplikacji na Androida nową wersją jest nowy plik APK, a w trybie deweloperskim pliki są zawsze świeże.</p>
          ) : (
            <>
              <Button size="sm" onClick={() => void refresh()} disabled={busy} className="gap-1.5 coarse:h-11" data-testid="settings-refresh-update">
                <RefreshCw className={busy ? "animate-spin motion-reduce:animate-none" : undefined} aria-hidden />
                {busy ? "Sprawdzanie…" : sw.state === "update" ? "Zainstaluj nową wersję" : "Odśwież aktualizacje"}
              </Button>
              <span className="ui-meta">Wersja {APP_VERSION}{sw.state === "update" ? " · nowa czeka" : ""}</span>
            </>
          )}
        </div>
      </Section>
      <ToggleRow
        label="Aktualizuj automatycznie"
        desc="Nowa wersja instaluje się sama, gdy wyjdziesz z aplikacji albo przez minutę nic nie robisz — nigdy w trakcie pisania. Wyłączone: tylko dymek i przycisk wyżej."
        checked={auto}
        onCheck={setAutoUpdate}
      />
    </div>
  );
}
