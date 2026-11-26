import { ArchiveRestore, CalendarClock, HardHat, KeyRound, Network, Palette, RefreshCw, WifiOff, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { APP_NAME } from "@/lib/appName";
import { AboutPanel } from "@/components/AboutPanel";
import { APP_VERSION } from "@/content/changelog";
import { AUTHOR_LINE, FEATURE_GROUPS, HIGHLIGHTS, type Highlight } from "@/content/about";

const ICONS: Record<Highlight["icon"], LucideIcon> = {
  offline: WifiOff,
  sync: RefreshCw,
  lock: KeyRound,
  tools: HardHat,
  shifts: CalendarClock,
  backup: ArchiveRestore,
  links: Network,
  style: Palette,
};

/**
 * „O aplikacji” (obok Ustawień): autor, co wyróżnia aplikację, wszystkie funkcje działami oraz wersja i aktualizacja. Treść w `content/about.ts`;
 * okno ładuje się dopiero po otwarciu (`AboutHost`).
 */
export function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-dialog max-w-2xl overflow-y-auto" data-testid="about-dialog">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span>O aplikacji {APP_NAME}</span>
            <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">wersja {APP_VERSION}</span>
          </DialogTitle>
          <DialogDescription>Notatki, terminy, grafik, praca na budowie i sprawy osobiste — w jednej aplikacji, na Twoim urządzeniu.</DialogDescription>
          {/* Podpis autora jak w zeszycie: kreska pióra w kolorze akcentu pod spodem. */}
          <p className="w-fit border-b-2 border-primary/60 pb-0.5 pt-2 text-sm font-medium italic" data-testid="about-author">{AUTHOR_LINE}</p>
        </DialogHeader>

        <section aria-labelledby="about-highlights" className="mt-2">
          <h3 id="about-highlights" className="ui-hint font-medium">Co wyróżnia {APP_NAME}</h3>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
            {HIGHLIGHTS.map((h) => {
              const Icon = ICONS[h.icon];
              return (
                <li key={h.title} className="flex gap-3 rounded-field border border-border/60 p-3">
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary-ink" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{h.title}</p>
                    <p className="ui-hint mt-0.5">{h.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="about-features" className="mt-4">
          <h3 id="about-features" className="ui-hint font-medium">Wszystkie funkcje</h3>
          <div className="mt-2 divide-y divide-border/60 rounded-field border border-border/60">
            {FEATURE_GROUPS.map((g) => (
              <details key={g.title} className="group px-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2.5 text-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11">
                  {g.title}
                  <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground" aria-hidden>
                    {g.items.length} <span className="inline-block transition-transform group-open:rotate-90 motion-reduce:transition-none">›</span>
                  </span>
                </summary>
                <ul className="list-disc space-y-1 pb-3 pl-5 text-sm marker:text-primary">
                  {g.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </details>
            ))}
          </div>
        </section>

        {/* 5.7: wersja, build, praca offline i aktualizacja — wcześniej osobne okno w pasku bocznym. */}
        <section aria-labelledby="about-version" className="mt-4">
          <h3 id="about-version" className="ui-hint font-medium">Wersja i aktualizacja</h3>
          <div className="mt-2 rounded-field border border-border/60 p-3"><AboutPanel /></div>
        </section>

        <p className="ui-meta mt-4 text-center">{AUTHOR_LINE} · {APP_NAME} {APP_VERSION}</p>
      </DialogContent>
    </Dialog>
  );
}
