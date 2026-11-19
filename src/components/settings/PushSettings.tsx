import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { disablePush, enablePush, pushSupport, sendTestPush } from "@/lib/push/client";
import { cleanPushToken, normalizePushServer, pushPrefs, pushToken, PUSH_TOKEN_MAX, setPushCategory } from "@/lib/push/prefs";
import { PUSH_CATEGORIES } from "@/lib/push/schedule";
import { PUSH_SUMMARY_KEY, readPushSummary } from "@/lib/push/summary";
import { isNativeShell } from "@/lib/native/platform";
import { loadNativeSink, nativeAlarmPrefs } from "@/lib/reminders/sink";
import { cn } from "@/lib/utils";
import { Section, ToggleRow } from "./SettingsShared";
import type { PushSummary } from "@/lib/push/summary";

/**
 * Lista obcięta limitem (S1 audytu 2): odpadają najdalsze terminy, więc mówimy, do kiedy przypomnienia są zaplanowane
 * i z których kategorii coś czeka na kolejne odświeżenie (przy otwarciu aplikacji i co godzinę).
 */
function droppedText(s: PushSummary): string {
  const cats = PUSH_CATEGORIES.filter((c) => (s.droppedBy?.[c.id] ?? 0) > 0).map((c) => `${c.label.toLowerCase()} (${s.droppedBy?.[c.id]})`);
  const until = s.horizonEnd ? `Zaplanowane do ${format(s.horizonEnd, "dd.MM HH:mm")}; ` : "";
  return `${until}dalsze terminy (${s.dropped}${cats.length ? `: ${cats.join(", ")}` : ""}) dojdą przy kolejnym otwarciu aplikacji.`;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Coś poszło nie tak.");

/**
 * Powiadomienia przy zamkniętej aplikacji: adres własnego serwera (`push-server/`), włączenie
 * (zgoda + subskrypcja), próbne powiadomienie i stan ostatniej wysyłki harmonogramu.
 */
const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

export function PushSettings() {
  return isNativeShell() ? <NativeAlarmSettings /> : <WebPushSettings />;
}

function WebPushSettings() {
  const prefs = pushPrefs.use();
  const [server, setServer] = useState(prefs.server);
  const [token, setToken] = useState(() => pushToken.get());
  const [busy, setBusy] = useState<null | "on" | "off" | "test">(null);
  // Wskaźnik dopiero po 300 ms (plan 3.3): szybkie włączenie/wyłączenie bez mignięcia.
  const spinOn = useDelayedFlag(busy === "on");
  const spinOff = useDelayedFlag(busy === "off");
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
    const secret = cleanPushToken(token);
    if (!secret) { toast.error("Wpisz token serwera — ten sam, który ustawiono jako PUSH_TOKEN na serwerze"); return; }
    setServer(url);
    void run("on", () => enablePush(url, secret), "Powiadomienia włączone — przypomnienia przyjdą też przy zamkniętej aplikacji");
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
      <div className="space-y-3 rounded-card border border-border/60 bg-muted/30 px-4 py-3">
        <p className="ui-hint">
          Przypomnienia notatek, Grafik na jutro, raport dnia i tygodnia, problemy i materiał z budowy przyjdą o czasie także wtedy,
          gdy aplikacja jest zamknięta. Wysyła je Twój serwer powiadomień.
          Trafiają na niego terminy i tytuły na 14 dni — bez treści notatek, a z notatek prywatnych bez tytułów.
        </p>
        {support !== "ok" ? (
          <p className="text-xs text-destructive-ink">
            {support === "ios-browser"
              ? "Na iPhonie dodaj G do ekranu początkowego (Udostępnij → Do ekranu początkowego) i otwórz je stamtąd."
              : "Ta przeglądarka nie obsługuje powiadomień push."}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
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
              <label htmlFor="push-token" className="sr-only">Token serwera powiadomień</label>
              <Input
                id="push-token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="Token serwera"
                maxLength={PUSH_TOKEN_MAX}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={prefs.enabled || busy !== null}
                className="font-mono text-sm"
                data-testid="push-token"
              />
              {prefs.enabled ? (
                <Button type="button" variant="outline" className="pressable shrink-0 sm:self-start" disabled={busy !== null}
                  onClick={() => void run("off", disablePush, "Powiadomienia przy zamkniętej aplikacji wyłączone")}>
                  {spinOff && <Loader2 className="size-4 animate-spin" />}Wyłącz
                </Button>
              ) : (
                <Button type="button" className="pressable shrink-0 sm:self-start" disabled={busy !== null || !server.trim() || !token.trim()} onClick={onEnable}>
                  {spinOn && <Loader2 className="size-4 animate-spin" />}Włącz
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p role="status" className={cn("text-xs", prefs.enabled && last && !last.ok ? "text-destructive-ink" : "text-muted-foreground")}>{status}</p>
              {prefs.enabled && summary && (
                <p className={cn("text-xs", summary.dropped > 0 ? "text-warning-ink" : "text-muted-foreground")}>
                  Serwer przyjmuje do {summary.limit} przypomnień: wysłano {summary.sent} z {summary.total}.
                  {summary.dropped > 0 && ` ${droppedText(summary)}`}
                </p>
              )}
              {prefs.enabled && (
                <Button type="button" size="sm" variant="outline" className="pressable gap-1.5" disabled={busy !== null}
                  onClick={() => void run("test", sendTestPush, "Wysłano próbne powiadomienie")}>
                  {busy === "test" ? <Loader2 className="size-3.5 animate-spin" /> : <BellRing className="size-3.5" />}Wyślij próbne
                </Button>
              )}
            </div>
          </>
        )}
      </div>
      <div className="mt-3 space-y-2">
        <p className="ui-hint">Co ma przypominać, gdy aplikacja jest zamknięta:</p>
        {PUSH_CATEGORIES.map((c) => (
          <ToggleRow
            key={c.id}
            label={c.label}
            desc={`Po wyłączeniu terminy tej kategorii nie trafiają na serwer.`}
            checked={!(prefs.off ?? []).includes(c.id)}
            onCheck={(on) => setPushCategory(c.id, on)}
          />
        ))}
      </div>
    </Section>
  );
}

/**
 * APK (F1): alarmy planuje sam telefon — bez serwera i bez sieci. Zgoda systemowa, próbny alarm
 * i stan ostatniego planowania; kategorie te same co w PWA.
 */
function NativeAlarmSettings() {
  const alarms = nativeAlarmPrefs.use();
  const off = pushPrefs.use().off ?? [];
  const [busy, setBusy] = useState(false);

  const run = async (fn: (m: Awaited<ReturnType<typeof loadNativeSink>>) => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await fn(await loadNativeSink());
      toast.success(done);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const last = alarms.last;
  const status = !alarms.enabled
    ? "Wyłączone — przypomnienia działają tylko przy otwartej aplikacji."
    : !last
      ? "Włączone — alarmy zaplanują się za chwilę."
      : last.ok
        ? `Włączone — zaplanowane terminy: ${last.count ?? 0}, ${formatDistanceToNow(last.at, { locale: pl, addSuffix: true })}.`
        : last.error ?? "Nie udało się zaplanować alarmów.";

  return (
    <Section title="Powiadomienia przy zamkniętej aplikacji">
      <div className="space-y-3">
        <ToggleRow
          label="Alarmy telefonu"
          desc="Przypomnienia przychodzą o czasie także przy zamkniętej aplikacji i bez sieci. Planuje je telefon, na 14 dni naprzód."
          checked={alarms.enabled}
          onCheck={(on) => {
            if (busy) return;
            void (on
              ? run((m) => m.enableNativeAlarms(), "Alarmy włączone")
              : run((m) => m.disableNativeAlarms(), "Alarmy wyłączone"));
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" className={cn("text-xs", alarms.enabled && last && !last.ok ? "text-destructive-ink" : "text-muted-foreground")}>{status}</p>
          {alarms.enabled && (
            <Button type="button" size="sm" variant="outline" className="pressable gap-1.5" disabled={busy}
              onClick={() => void run((m) => m.scheduleTestAlarm(), "Próbny alarm przyjdzie za minutę — możesz zamknąć aplikację")}>
              <BellRing className="size-3.5" />Próbny alarm za minutę
            </Button>
          )}
        </div>
        {alarms.enabled && last?.ok && last.exact === false && (
          <p className="text-xs text-warning-ink">
            Telefon nie pozwala na dokładne alarmy — przypomnienia mogą się spóźnić o kilka minut.
            Włącz „Alarmy i przypomnienia” w ustawieniach telefonu: Aplikacje → NOTKI.
          </p>
        )}
      </div>
      <div className="mt-3 space-y-2">
        <p className="ui-hint">Co ma przypominać, gdy aplikacja jest zamknięta:</p>
        {PUSH_CATEGORIES.map((c) => (
          <ToggleRow
            key={c.id}
            label={c.label}
            desc="Po wyłączeniu telefon nie planuje alarmów tej kategorii."
            checked={!off.includes(c.id)}
            onCheck={(on) => setPushCategory(c.id, on)}
          />
        ))}
      </div>
    </Section>
  );
}
