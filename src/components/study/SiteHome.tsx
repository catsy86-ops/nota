import { useMemo, useRef, useState, type ReactNode } from "react";
import { Camera, ChevronRight, Mic, PackageX } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardVariant } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { addPhotoEntry } from "@/lib/study/photoEntry";
import { requestVoiceOnOpen, openJournalSheet } from "@/lib/study/entrySheet";
import { findSiteByName, type SiteInfo } from "@/lib/study/sites";
import { activeSitesByRecency } from "@/lib/study/siteRecency";
import { pointsProgress } from "@/lib/study/points";
import { useSitePoints } from "@/lib/study/pointsStore";
import { siteTally } from "@/lib/study/siteTally";
import { setSite, useSiteDirectory, useStudy } from "@/lib/study/store";
import { readUsage, trackUse } from "@/lib/study/usage";
import { dismissOneHandOffer, setOneHand, shouldOfferOneHand, useOneHand, useOneHandOffered } from "@/lib/study/oneHandPrefs";
import { IS_TOUCH } from "@/lib/platform";
import { photoEntryToast, photoSaveFailed } from "./useJournalPhotoEdits";
import { SitePlan } from "./SitePlan";
import { SiteShortagesPanel } from "./SiteShortagesPanel";

// W3.2: kafel to klikalna karta; nieaktywny jak w `docs/komponenty.md` (`--faint`, bez `opacity`).
const TILE = cn(cardVariant("interactive"), "flex min-h-24 flex-col items-center justify-center gap-1.5 px-2 py-3 text-sm font-medium text-foreground hover:bg-muted disabled:pointer-events-none disabled:text-faint coarse:min-h-28");

/**
 * Zakładka „Budowa” (plan Pracy na budowie, B2.1): bieżąca budowa na jednym ekranie — trzy duże przyciski
 * (zdjęcie, wpis głosem, brak materiału), plan na dziś, braki i skrót do karty. Nic tu nie zastępuje Dziennika:
 * pełne wpisy, raporty i karta budowy zostają tam, a stąd prowadzi do nich jedno stuknięcie.
 */
export function SiteHome({ onOpenCard, onOpenJournal, tools }: { onOpenCard: (siteId: string) => void; onOpenJournal: () => void; /** Narzędzia Pracy (wysokości, kalkulatory, przewodnik) pod planem i brakami. */ tools?: ReactNode }) {
  const study = useStudy();
  const dir = useSiteDirectory();
  const sites = useMemo(() => activeSitesByRecency(dir, study.journal), [dir, study.journal]);
  const [picked, setPicked] = useState<string | null>(null);
  // Bieżąca budowa arkusza wpisu (`study.site`) wygrywa z „ostatnio używaną”, żeby ekran zgadzał się z „+ Wpis”.
  const current = sites.find((s) => s.id === picked) ?? (study.site ? findSiteByName(sites, study.site) : undefined) ?? sites[0];
  const { points } = useSitePoints(current?.id ?? "");
  const progress = useMemo(() => pointsProgress(points), [points]);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [addShortage, setAddShortage] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const oneHand = useOneHand();
  const offered = useOneHandOffered();

  if (!current) {
    return (
      <section className={cn(cardVariant(), "space-y-3 p-4 text-center")} data-testid="site-home-empty">
        <p className="title-section">Nie ma jeszcze żadnej budowy</p>
        <p className="ui-hint">Załóż budowę w Dzienniku, a tu pojawią się zdjęcie, wpis głosem, plan na dziś i braki.</p>
        <Button type="button" variant="outline" onClick={onOpenJournal} className="coarse:min-h-11">Otwórz Dziennik</Button>
        {tools}
      </section>
    );
  }

  const tally = siteTally(current, study.journal);
  const select = (s: SiteInfo) => { setPicked(s.id); setSite(s.name); haptic("tap"); };

  async function onFile(file: File) {
    if (!current) return;
    setBusy(true);
    try {
      trackUse("zdjecie-budowa");
      photoEntryToast(await addPhotoEntry(file, current.name), `Dodano zdjęcie do budowy „${current.name}”`);
    } catch {
      photoSaveFailed();
    } finally {
      setBusy(false);
    }
  }

  function voice() {
    if (!current) return;
    trackUse("wpis-glosem-budowa");
    setSite(current.name);
    requestVoiceOnOpen();
    openJournalSheet();
  }

  function shortage() {
    trackUse("brak-budowa");
    setAddShortage(true);
    // Panel pojawia się w następnej klatce; fokus na polu „Czego brakuje” otwiera klawiaturę od razu.
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLInputElement>('input[aria-label="Czego brakuje"], input')?.focus());
  }

  // R4.1: w trybie jednej ręki informacje idą na górę, a to, czego dotyka kciuk (budowa, karta, akcje), na dół.
  const at = (n: number) => (oneHand ? { style: { order: n } } : {});
  const offer = shouldOfferOneHand({ usage: readUsage(), enabled: oneHand, offered, touch: IS_TOUCH });
  const showShortages = addShortage || (current.shortages?.length ?? 0) > 0;

  return (
    <div className={cn("md:max-w-2xl", oneHand ? "flex flex-col gap-4" : "space-y-4")} data-testid="site-home" data-one-hand={oneHand || undefined}>
      {offer && (
        <div className={cn(cardVariant("inset"), "flex flex-col gap-2 p-3")} role="region" aria-label="Układ do jednej ręki" data-testid="one-hand-offer" style={{ order: -1 }}>
          <p className="text-sm font-medium">Włączyć układ do jednej ręki?</p>
          <p className="ui-hint">Budowa, karta i szybkie akcje przesuną się na dół ekranu, pod kciuk. Zmienisz to w Ustawieniach.</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => setOneHand(true)} className="coarse:min-h-11">Włącz</Button>
            <Button type="button" size="sm" variant="outline" onClick={dismissOneHandOffer} className="coarse:min-h-11">Nie, dziękuję</Button>
          </div>
        </div>
      )}
      {sites.length > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="group" aria-label="Budowa" {...at(5)}>
          {sites.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === current.id}
              onClick={() => select(s)}
              className={cn(
                "pressable shrink-0 rounded-full border px-3 py-1 text-sm coarse:min-h-11", oneHand && "coarse:min-h-14",
                s.id === current.id ? "border-primary/50 bg-primary/10 font-medium text-foreground" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpenCard(current.id)}
        aria-label={`Karta budowy: ${current.name}`}
        className={cn(cardVariant("interactive"), "flex w-full items-center gap-3 p-4 text-left", oneHand && "min-h-14")}
        data-testid="site-home-card"
        {...at(6)}
      >
        <span className="min-w-0 flex-1">
          <span className="title-section block truncate">{current.name}</span>
          <span className="ui-meta block truncate">
            {[current.address, `Etapy ${tally.stages.done}/${tally.stages.total}`, progress.total > 0 ? `Punkty ${progress.done}/${progress.total}` : null, tally.missing > 0 ? `Braki ${tally.missing}` : null].filter(Boolean).join(" · ")}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Szybkie akcje" {...at(7)}>
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          tabIndex={-1}
          aria-hidden
          data-testid="site-home-photo-input"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onFile(f); }}
        />
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className={TILE} data-testid="site-home-photo">
          <Camera className="size-6 text-primary-ink" aria-hidden />{busy ? "Zapisuję…" : "Zdjęcie"}
        </button>
        <button type="button" onClick={voice} className={TILE} data-testid="site-home-voice">
          <Mic className="size-6 text-primary-ink" aria-hidden />Wpis głosem
        </button>
        <button type="button" onClick={shortage} className={TILE} data-testid="site-home-shortage">
          <PackageX className="size-6 text-primary-ink" aria-hidden />Brak
        </button>
      </div>

      <div {...at(1)}><SitePlan site={current} /></div>
      {showShortages && <div ref={panelRef} {...at(2)}><SiteShortagesPanel site={current} /></div>}
      {tools && <div {...at(3)}>{tools}</div>}
    </div>
  );
}
