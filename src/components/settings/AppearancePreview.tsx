import { NotkiLogo } from "@/components/NotkiLogo";
import { Bell, CalendarCheck, NotebookPen, Plus, Search } from "lucide-react";

/**
 * Podgląd na żywo u góry Wyglądu (plan motywów 2026-10-30, 1.2): wycinek aplikacji z prawdziwymi klasami
 * (`note-card`, `bg-primary`, tokeny z `<html>`), więc zmiana stylu, akcentu, kształtu, ramek, poświaty
 * czy kroju widać od razu, mimo że okno Ustawień zasłania aplikację. Tylko do oglądania — `inert`.
 */
export function AppearancePreview() {
  return (
    <div
      inert
      aria-hidden
      data-testid="appearance-preview"
      className="relative overflow-hidden rounded-card border border-border bg-background shadow-elevation-1"
    >
      <div className="flex items-center gap-2 border-b border-border/60 bg-card/80 px-2.5 py-1.5">
        <NotkiLogo size="sm" />
        <span className="ml-auto grid size-6 place-items-center rounded-full border border-border/60 text-muted-foreground"><Search className="size-3.5" /></span>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-start gap-2 p-2.5">
        <div className="note-card note-glow-active relative rounded-card border bg-card p-2 text-left">
          <p className="truncate text-xs font-semibold text-card-foreground">Lipowa 5 — łazienka</p>
          <p className="mt-0.5 line-clamp-1 text-2xs text-muted-foreground">Podejścia gotowe, jutro próba.</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 text-2xs text-accent-foreground"><CalendarCheck className="size-3" />jutro 8:00</span>
        </div>
        <span className="inline-flex h-7 items-center rounded-control bg-primary px-2.5 text-2xs font-semibold text-primary-foreground">Zapisz</span>
      </div>
      <div className="flex items-center justify-around border-t border-border/60 bg-card/80 px-2 py-1 text-muted-foreground">
        <NotebookPen className="size-3.5 text-primary-ink" />
        <Bell className="size-3.5" />
        <span className="-mt-3 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-elevation-2"><Plus className="size-4" /></span>
        <CalendarCheck className="size-3.5" />
        <Search className="size-3.5" />
      </div>
    </div>
  );
}
