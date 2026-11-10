import { useMemo, useRef, useState, type ReactNode } from "react";
import { Camera, ChevronRight, Mic, PackageX } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardClass } from "@/components/ui/card";
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
import { trackUse } from "@/lib/study/usage";
import { photoEntryToast, photoSaveFailed } from "./useJournalPhotoEdits";
import { SitePlan } from "./SitePlan";
import { SiteShortagesPanel } from "./SiteShortagesPanel";

const TILE = "pressable flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-card border border-border bg-card px-2 py-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60 coarse:min-h-28";

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

  if (!current) {
    return (
      <section className={cn(cardClass, "space-y-3 p-4 text-center")} data-testid="site-home-empty">
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

  const showShortages = addShortage || (current.shortages?.length ?? 0) > 0;

  return (
    <div className="space-y-4 md:max-w-2xl" data-testid="site-home">
      {sites.length > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="group" aria-label="Budowa">
          {sites.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === current.id}
              onClick={() => select(s)}
              className={cn(
                "pressable shrink-0 rounded-full border px-3 py-1 text-sm coarse:min-h-11",
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
        className={cn(cardClass, "pressable flex w-full items-center gap-3 p-4 text-left")}
        data-testid="site-home-card"
      >
        <span className="min-w-0 flex-1">
          <span className="title-section block truncate">{current.name}</span>
          <span className="ui-meta block truncate">
            {[current.address, `Etapy ${tally.stages.done}/${tally.stages.total}`, progress.total > 0 ? `Punkty ${progress.done}/${progress.total}` : null, tally.missing > 0 ? `Braki ${tally.missing}` : null].filter(Boolean).join(" · ")}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Szybkie akcje">
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
          <Camera className="h-6 w-6 text-primary-ink" aria-hidden />{busy ? "Zapisuję…" : "Zdjęcie"}
        </button>
        <button type="button" onClick={voice} className={TILE} data-testid="site-home-voice">
          <Mic className="h-6 w-6 text-primary-ink" aria-hidden />Wpis głosem
        </button>
        <button type="button" onClick={shortage} className={TILE} data-testid="site-home-shortage">
          <PackageX className="h-6 w-6 text-primary-ink" aria-hidden />Brak
        </button>
      </div>

      <SitePlan site={current} />
      {showShortages && <div ref={panelRef}><SiteShortagesPanel site={current} /></div>}
      {tools}
    </div>
  );
}
