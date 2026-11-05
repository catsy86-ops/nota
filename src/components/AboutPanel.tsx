import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/content/changelog";
import { applyServiceWorkerUpdate, checkForSwUpdate, getSwInfo, subscribeSwInfo, type SwState } from "@/lib/registerSW";
import { hasUnsavedWork } from "@/lib/saveStatus";

declare const __APP_BUILD__: string | undefined;

/** `__APP_BUILD__` to „<sha> <ISO do minut>” z `vite.config.ts`; w testach i dev go nie ma. */
export function formatBuild(raw: string | undefined): string {
  if (!raw) return "wersja deweloperska";
  const [sha, iso] = raw.split(" ");
  const at = iso ? new Date(`${iso}Z`) : null;
  const when = at && !Number.isNaN(at.getTime())
    ? at.toLocaleString("pl-PL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
  return when ? `${sha}, ${when}` : sha;
}

const SW_TEXT: Record<SwState, string> = {
  off: "Bez pracy offline w tej karcie (tryb deweloperski, ramka albo przeglądarka bez Service Workera).",
  starting: "Przygotowuje się do pracy offline…",
  ready: "Działa offline — pliki aplikacji są zapisane w przeglądarce.",
  update: "Nowa wersja gotowa.",
};

/**
 * „O aplikacji” (nowy plan 5.7): wersja, build, stan pracy offline i aktualizacja. Ten sam panel
 * w oknie z paska bocznego i w Ustawieniach → Kopia i dane.
 */
export function AboutPanel() {
  const sw = useSyncExternalStore(subscribeSwInfo, getSwInfo, getSwInfo);
  const [checking, setChecking] = useState(false);
  const build = formatBuild(typeof __APP_BUILD__ === "string" ? __APP_BUILD__ : undefined);

  async function check() {
    setChecking(true);
    const r = await checkForSwUpdate();
    setChecking(false);
    if (r === "current") toast.success("Masz najnowszą wersję");
    else if (r === "offline") toast.error("Nie udało się sprawdzić — brak połączenia z siecią");
  }

  function refresh() {
    if (!sw.registration) return;
    if (hasUnsavedWork()) { toast("Poczekaj, aż zapisze się ostatnia zmiana", { description: "Wtedy wersja podmieni się bez utraty tekstu." }); return; }
    applyServiceWorkerUpdate(sw.registration);
  }

  return (
    <div className="space-y-2 text-sm" data-testid="about-panel">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Wersja</dt>
        <dd className="font-mono tabular-nums">{APP_VERSION}</dd>
        <dt className="text-muted-foreground">Build</dt>
        <dd className="font-mono text-xs tabular-nums break-all" data-testid="about-build">{build}</dd>
      </dl>
      <p className="text-xs text-muted-foreground" role="status" data-testid="about-sw">{SW_TEXT[sw.state]}</p>
      {sw.state === "update" ? (
        <Button size="sm" onClick={refresh} className="coarse:h-11">Odśwież do nowej wersji</Button>
      ) : sw.state !== "off" ? (
        <Button size="sm" variant="outline" onClick={() => void check()} disabled={checking} className="coarse:h-11">
          {checking ? "Sprawdzanie…" : "Sprawdź aktualizację"}
        </Button>
      ) : null}
    </div>
  );
}
