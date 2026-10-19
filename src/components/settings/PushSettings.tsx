import { useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { disablePush, enablePush, pushSupport, sendTestPush } from "@/lib/push/client";
import { normalizePushServer, pushPrefs } from "@/lib/push/prefs";
import { PUSH_SUMMARY_KEY, readPushSummary } from "@/lib/push/summary";
import { cn } from "@/lib/utils";
import { Section } from "./SettingsShared";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Coś poszło nie tak.");

/**
 * Powiadomienia przy zamkniętej aplikacji: adres własnego serwera (`push-server/`), włączenie
 * (zgoda + subskrypcja), próbne powiadomienie i stan ostatniej wysyłki harmonogramu.
 */
const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

export function PushSettings() {
  const prefs = pushPrefs.use();
  const [server, setServer] = useState(prefs.server);
  const [busy, setBusy] = useState<null | "on" | "off" | "test">(null);
  const support = pushSupport();

  const run = async (kind: "on" | "off" | "test", fn: () => Promise<void>, done: string) => {
    setBusy(kind);
    try {
      await fn();
      toast.success(done);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const onEnable = () => {
    const url = normalizePushServer(server);
    if (!url) { toast.error("Wpisz adres serwera zaczynający się od https://"); return; }
    setServer(url);
    void run("on", () => enablePush(url), "Powiadomienia włączone — przypomnienia przyjdą też przy zamkniętej aplikacji");
  };

  const last = prefs.last;
  const summary = readPushSummary(safeGet(PUSH_SUMMARY_KEY));
  const status = !prefs.enabled
    ? "Wyłączone — przypomnienia działają tylko przy otwartej aplikacji."
    : !last
      ? "Włączone — harmonogram wyśle się za chwilę."
      : last.ok
        ? `Włączone — zaplanowane terminy: ${last.count ?? 0}, wysłane na serwer ${formatDistanceToNow(last.at, { locale: pl, addSuffix: true })}.`
        : `Nie udało się wysłać harmonogramu: ${last.error ?? "błąd serwera"}`;

  return (
    <Section title="Powiadomienia przy zamkniętej aplikacji">
      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Przypomnienia notatek, Grafik na jutro, raport dnia i tygodnia, problemy i materiał z budowy przyjdą o czasie także wtedy,
          gdy NOTKI są zamknięte. Wysyła je Twój serwer powiadomień (folder <code className="font-mono whitespace-nowrap">push-server</code>).
          Trafiają na niego terminy i tytuły na 14 dni — bez treści notatek, a z notatek prywatnych bez tytułów.
        </p>
        {support !== "ok" ? (
          <p className="text-xs text-destructive-ink">
            {support === "ios-browser"
              ? "Na iPhonie dodaj NOTKI do ekranu początkowego (Udostępnij → Do ekranu początkowego) i otwórz je stamtąd."
              : "Ta przeglądarka nie obsługuje powiadomień push."}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="push-server" className="sr-only">Adres serwera powiadomień</label>
              <Input
                id="push-server"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://powiadomienia.example.pl"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                disabled={prefs.enabled || busy !== null}
                className="font-mono text-sm"
              />
              {prefs.enabled ? (
                <Button type="button" variant="outline" className="pressable shrink-0" disabled={busy !== null}
                  onClick={() => void run("off", disablePush, "Powiadomienia przy zamkniętej aplikacji wyłączone")}>
                  {busy === "off" && <Loader2 className="w-4 h-4 animate-spin" />}Wyłącz
                </Button>
              ) : (
                <Button type="button" className="pressable shrink-0" disabled={busy !== null || !server.trim()} onClick={onEnable}>
                  {busy === "on" && <Loader2 className="w-4 h-4 animate-spin" />}Włącz
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p role="status" className={cn("text-xs", prefs.enabled && last && !last.ok ? "text-destructive-ink" : "text-muted-foreground")}>{status}</p>
              {prefs.enabled && summary && (
                <p className={cn("text-xs", summary.dropped > 0 ? "text-warning-ink" : "text-muted-foreground")}>
                  Serwer przyjmuje do {summary.limit} przypomnień: wysłano {summary.sent} z {summary.total}.
                  {summary.dropped > 0 && ` ${summary.dropped} nie zmieściło się — najpierw zostają przypomnienia z notatek, potem Praca, na końcu Grafik.`}
                </p>
              )}
              {prefs.enabled && (
                <Button type="button" size="sm" variant="outline" className="pressable gap-1.5" disabled={busy !== null}
                  onClick={() => void run("test", sendTestPush, "Wysłano próbne powiadomienie")}>
                  {busy === "test" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />}Wyślij próbne
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Section>
  );
}
