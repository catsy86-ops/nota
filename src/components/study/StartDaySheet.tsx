import { useEffect, useMemo, useState } from "react";
import { Check, MapPin, Sunrise } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { haptic } from "@/lib/haptics";
import { dayKey } from "@/lib/reminderOccurrences";
import { NEAR_SITE_M, type GeoPoint } from "@/lib/study/geo";
import { activePlanItems } from "@/lib/study/planItems";
import type { SiteInfo } from "@/lib/study/sites";
import { startDayCandidates } from "@/lib/study/startDay";
import { composeReminderTimestamp, toTimeInputValue } from "@/lib/reminderTime";
import { enterEntryCheck, useEntryCheck } from "@/lib/study/entryCheckStore";
import { cn } from "@/lib/utils";

/** Po ile ms dajemy GPS na odpowiedź; bez niej lista zostaje od ostatnio używanej budowy. */
const LOCATE_TIMEOUT_MS = 8000;

/**
 * „Zacznij dzień” (R2.5): jeden arkusz — budowa (najbliższa z lokalizacji na górze), godzina wejścia
 * (domyślnie teraz, do poprawki) i plan na dziś z karty. „Wchodzę” zapisuje wejście tak jak dymek
 * z `SiteArrivalPrompt`. Położenie jest czytane raz, po otwarciu arkusza (stuknięcie użytkownika).
 */
export function StartDaySheet({ open, onOpenChange, sites, onOpenCard }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sites: readonly SiteInfo[];
  onOpenCard: (siteId: string) => void;
}) {
  if (!open) return <Dialog open={false} onOpenChange={onOpenChange} />;
  return <StartDayBody onOpenChange={onOpenChange} sites={sites} onOpenCard={onOpenCard} />;
}

function StartDayBody({ onOpenChange, sites, onOpenCard }: Omit<Parameters<typeof StartDaySheet>[0], "open">) {
  const entryCheck = useEntryCheck();
  const [now] = useState(() => Date.now());
  const today = dayKey(new Date(now));
  const [at, setAt] = useState<GeoPoint | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [time, setTime] = useState(() => toTimeInputValue(now));

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setAt({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
      () => { /* odmowa albo brak sygnału — lista bez podpowiedzi z lokalizacji */ },
      { enableHighAccuracy: false, timeout: LOCATE_TIMEOUT_MS, maximumAge: 10 * 60 * 1000 },
    );
  }, []);

  const candidates = useMemo(
    () => startDayCandidates(sites, at, today, entryCheck.records, NEAR_SITE_M),
    [sites, at, today, entryCheck.records],
  );
  // Domyślnie pierwsza budowa z listy (najbliższa albo ostatnio używana), dopóki nie wybrano innej.
  const siteId = picked ?? candidates[0]?.site.id ?? null;
  const current = candidates.find((c) => c.site.id === siteId) ?? null;
  const plan = current ? activePlanItems(current.site.plan ?? [], now).filter((i) => i.doneAt === undefined) : [];
  const enterAt = composeReminderTimestamp(new Date(now), time);

  function enter() {
    if (!current || current.entered || enterAt === null) return;
    enterEntryCheck(current.site.id, today, enterAt);
    haptic("success");
    toast.success(`Zapisano wejście: ${current.site.name}`);
    onOpenChange(false);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-sm" data-testid="start-day">
        <div className="space-y-1 border-b border-border px-5 pb-4 pt-5 pr-12">
          <DialogTitle className="flex items-center gap-1.5 font-display text-lg">
            <Sunrise className="size-5 shrink-0 text-primary-ink" aria-hidden />Zacznij dzień
          </DialogTitle>
          <DialogDescription className="text-xs">Budowa, godzina wejścia i plan na dziś w jednym miejscu.</DialogDescription>
        </div>
        <div className="space-y-4 px-5 py-4">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="start-day-empty">Nie masz jeszcze żadnej budowy. Dodaj ją w Dzienniku, a tu pojawi się do wyboru.</p>
          ) : (
            <>
              <div role="group" aria-label="Budowa" className="space-y-1.5" data-testid="start-day-sites">
                {candidates.slice(0, 6).map((c) => (
                  <Button
                    key={c.site.id}
                    type="button"
                    variant="outline"
                    aria-pressed={c.site.id === siteId}
                    onClick={() => setPicked(c.site.id)}
                    data-testid={`start-day-site-${c.site.id}`}
                    className={cn("pressable h-auto w-full justify-between gap-2 py-2 text-left coarse:min-h-11", c.site.id === siteId && "border-primary bg-primary/10")}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{c.site.name}</span>
                      {c.entered && <span className="block text-xs text-muted-foreground">Wejście dziś już zapisane</span>}
                    </span>
                    {c.distance !== null && c.distance <= NEAR_SITE_M && (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-primary-ink"><MapPin className="size-3.5" aria-hidden />{c.distance} m</span>
                    )}
                    {c.site.id === siteId && c.distance === null && <Check className="size-4 shrink-0 text-primary-ink" aria-hidden />}
                  </Button>
                ))}
              </div>
              <label className="flex items-center justify-between gap-3 text-sm">
                Godzina wejścia
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  aria-invalid={enterAt === null}
                  data-testid="start-day-time"
                  className="w-28 coarse:h-11"
                />
              </label>
              <section aria-label="Plan na dziś" data-testid="start-day-plan">
                <h3 className="section-caps mb-1">Plan na dziś</h3>
                {plan.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Brak zadań na dziś.</p>
                ) : (
                  <ul className="list-disc space-y-0.5 pl-5 text-sm">{plan.map((i) => <li key={i.id}>{i.text}</li>)}</ul>
                )}
                {current && (
                  <Button type="button" variant="link" size="sm" className="h-auto px-0 pt-1" onClick={() => { onOpenChange(false); onOpenCard(current.site.id); }}>
                    Edytuj plan w karcie budowy
                  </Button>
                )}
              </section>
            </>
          )}
        </div>
        <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 px-5 pb-5">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="pressable coarse:h-11">Później</Button>
          <Button type="button" disabled={!current || current.entered || enterAt === null} onClick={enter} data-testid="start-day-enter" className="pressable coarse:h-11">{current?.entered ? "Wejście zapisane" : "Wchodzę"}</Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
