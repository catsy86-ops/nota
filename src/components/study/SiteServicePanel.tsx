import { useState } from "react";
import { Check, RotateCcw, ShieldCheck, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { pluralPl } from "@/lib/plural";
import { toastWithUndo } from "@/lib/undoToast";
import { cn } from "@/lib/utils";
import { setSiteService, setSiteWarranty } from "@/lib/study/store";
import {
  addServiceCall, closeServiceCall, openServiceCalls, reopenServiceCall, SERVICE_MAX, SERVICE_TEXT_MAX,
  serviceDayKey, warrantyDaysLeft, type ServiceCall,
} from "@/lib/study/service";
import type { SiteInfo } from "@/lib/study/sites";

const fieldClass =
  "h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm";

const shortDay = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pl-PL", { weekday: "short", day: "2-digit", month: "2-digit" });
};
const shortDate = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
const daysPl = (n: number) => `${n} ${pluralPl(n, ["dzień", "dni", "dni"])}`;

/** Termin wizyty względem dziś: „dziś”, „zaległe 2 dni”, „śr 21.10”. */
function dueText(due: string, today: string): { text: string; late: boolean } {
  const diff = warrantyDaysLeft(due, today);
  if (diff === 0) return { text: "dziś", late: true };
  if (diff < 0) return { text: `zaległe ${daysPl(-diff)}`, late: true };
  return { text: diff === 1 ? "jutro" : shortDay(due), late: false };
}

/**
 * Serwis i gwarancja (H4) w karcie budowy: zgłoszenia po odbiorze z terminem wizyty, zamknięcie
 * z „co zrobiono”, historia załatwionych i koniec gwarancji. Termin dziś albo zaległy trafia do
 * przypomnień nad Dziennikiem i do powiadomień push.
 */
export function SiteServicePanel({ site }: { site: SiteInfo }) {
  const calls = site.service ?? [];
  const today = serviceDayKey(Date.now());
  const open = openServiceCalls(calls);
  const done = calls.filter((c) => c.done !== undefined).sort((a, b) => (b.done ?? 0) - (a.done ?? 0));
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [closing, setClosing] = useState<string | null>(null);
  const [solution, setSolution] = useState("");
  const [showDone, setShowDone] = useState(false);
  const warrantyLeft = site.warranty ? warrantyDaysLeft(site.warranty, today) : null;

  function add() {
    const next = addServiceCall(calls, text, due || undefined, Date.now());
    if (next.length === calls.length) return;
    setSiteService(site.id, next, calls);
    setText("");
    setDue("");
    haptic("tap");
  }

  function close(c: ServiceCall) {
    setSiteService(site.id, closeServiceCall(calls, c.id, solution, Date.now()), calls);
    setClosing(null);
    setSolution("");
    haptic("success");
  }

  function remove(c: ServiceCall) {
    const before = calls;
    const after = calls.filter((x) => x.id !== c.id);
    setSiteService(site.id, after, before);
    toastWithUndo(`Usunięto zgłoszenie „${c.text}”`, () => setSiteService(site.id, before, after));
  }

  return (
    <section aria-label="Serwis i gwarancja" data-testid="site-service" className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Wrench className="h-3.5 w-3.5" aria-hidden />Serwis i gwarancja
        </h3>
        {open.length > 0 && <span className="font-mono text-xs tabular-nums text-muted-foreground" data-testid="site-service-open">otwarte: {open.length}</span>}
      </div>

      <label className="flex flex-wrap items-center gap-2 text-sm">
        <ShieldCheck className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />
        <span>Gwarancja do</span>
        <input
          type="date"
          value={site.warranty ?? ""}
          onChange={(e) => setSiteWarranty(site.id, e.target.value || null)}
          aria-label="Koniec gwarancji"
          className={cn(fieldClass, "w-40 font-mono tabular-nums")}
        />
        {warrantyLeft !== null && (
          <span className={cn("font-mono text-xs tabular-nums", warrantyLeft < 0 ? "text-muted-foreground" : warrantyLeft <= 30 ? "text-warning-ink" : "text-muted-foreground")} data-testid="site-warranty">
            {warrantyLeft < 0 ? "po gwarancji" : warrantyLeft === 0 ? "ostatni dzień" : `zostało ${daysPl(warrantyLeft)}`}
          </span>
        )}
      </label>

      {open.length > 0 && (
        <ul className="divide-y divide-border/60">
          {open.map((c) => {
            const d = c.due ? dueText(c.due, today) : null;
            return (
              <li key={c.id} className="space-y-1.5 py-2" data-service-call={c.id}>
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 text-sm">
                    {c.text}
                    <span className="mt-0.5 block font-mono text-2xs tabular-nums text-muted-foreground">
                      zgłoszone {shortDate(c.at)}
                      {d && <> · <span className={d.late ? "font-semibold text-warning-ink" : ""}>wizyta {d.text}</span></>}
                    </span>
                  </span>
                  <Button type="button" variant="outline" size="sm" className="pressable shrink-0 coarse:h-11"
                    onClick={() => { setClosing(closing === c.id ? null : c.id); setSolution(""); }} aria-expanded={closing === c.id}>
                    <Check className="mr-1 h-3.5 w-3.5" aria-hidden />Załatwione
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="shrink-0 px-2 text-muted-foreground hover:text-destructive-ink coarse:h-11"
                    onClick={() => remove(c)} aria-label={`Usuń zgłoszenie: ${c.text}`}>
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
                {closing === c.id && (
                  <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); close(c); }}>
                    <input
                      autoFocus
                      value={solution}
                      onChange={(e) => setSolution(e.target.value)}
                      maxLength={SERVICE_TEXT_MAX}
                      placeholder="Co zrobiono? np. wymieniona uszczelka"
                      aria-label="Co zrobiono"
                      className={cn(fieldClass, "flex-1")}
                    />
                    <Button type="submit" className="pressable shrink-0 coarse:h-11">Zamknij</Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={SERVICE_TEXT_MAX}
          placeholder="Zgłoszenie, np. cieknie syfon w łazience"
          aria-label="Nowe zgłoszenie serwisowe"
          className={cn(fieldClass, "min-w-[12rem] flex-1")}
        />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Wizyta
          <input
            type="date"
            value={due}
            min={today}
            onChange={(e) => setDue(e.target.value)}
            aria-label="Termin wizyty"
            className={cn(fieldClass, "w-40 font-mono tabular-nums")}
          />
        </label>
        <Button type="submit" variant="outline" className="pressable coarse:h-11" disabled={!text.trim() || calls.length >= SERVICE_MAX}>Dodaj</Button>
      </form>

      {done.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}
            className="text-xs font-medium text-muted-foreground hover:text-foreground coarse:min-h-11">
            Załatwione ({done.length}) {showDone ? "▴" : "▾"}
          </button>
          {showDone && (
            <ul className="mt-1 space-y-1.5" data-testid="site-service-done">
              {done.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="min-w-0 flex-1">
                    <span className="line-through decoration-muted-foreground/50">{c.text}</span>
                    {c.solution && <span className="block text-foreground/80">→ {c.solution}</span>}
                    <span className="block font-mono text-2xs tabular-nums">załatwione {shortDate(c.done!)}</span>
                  </span>
                  <Button type="button" variant="ghost" size="sm" className="shrink-0 px-2 coarse:h-11"
                    onClick={() => setSiteService(site.id, reopenServiceCall(calls, c.id), calls)} aria-label={`Otwórz ponownie: ${c.text}`}>
                    <RotateCcw className="h-4 w-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
