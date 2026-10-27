import { Archive, Bell, CalendarDays, CalendarRange, FolderOpen, Tag, Trash, type LucideIcon } from "lucide-react";
import { NotatnikWordmark } from "@/components/NotatnikWordmark";
import type { View, Elsewhere } from "@/hooks/useFilteredNotes";
import { StatusPanel } from "@/components/StatusPanel";
import { EmptyIllustration } from "@/components/EmptyIllustration";
import { hasEmptyIllustration } from "@/lib/emptyGlyphs";
import { modShortcut, TAP } from "@/lib/platform";

export const HEADINGS: Record<View, string> = {
  notes: "Zacznij tworzyć",
  archive: "Archiwum jest puste",
  trash: "Kosz jest pusty",
  reminders: "Brak przypomnień",
  calendar: "Pusty miesiąc",
  shifts: "Pusty grafik",
  study: "",
  debts: "",
  cwiczenia: "",
  today: "Brak notatek z dzisiaj",
  week: "Brak notatek z tego tygodnia",
  label: "Brak notatek z tą etykietą",
  folder: "Zacznij tworzyć",
  widget: "Zacznij tworzyć",
  inbox: "Skrzynka jest pusta",
};

export const DESCRIPTIONS: Record<View, string> = {
  // Poniżej 768 px pasek „Zapisz notatkę…” jest schowany — nową notatkę robi „+” w dolnej nawigacji.
  notes: typeof matchMedia !== "undefined" && matchMedia("(max-width: 767px)").matches
    ? "Stuknij „+” na dole ekranu — są tam też szablony"
    : `${TAP} „Zapisz notatkę…” powyżej (są tam też szablony) lub naciśnij ` + modShortcut("N"),
  archive: "Odłóż notatkę tutaj: wybierz „Archiwizuj” w jej menu, a na telefonie przesuń kafel w lewo.",
  trash: "Usunięte notatki czekają tu 30 dni, potem znikają na dobre. Przywrócisz je z menu notatki.",
  reminders: "Dodaj przypomnienie w edytorze notatki albo wpisz w tekście, np. „jutro 9:00”.",
  calendar: `${TAP} dzień, aby dodać przypomnienie`,
  shifts: `Wybierz zmianę i ${TAP.toLowerCase()} dni`,
  study: "",
  debts: "",
  cwiczenia: "",
  today: "Notatka pojawi się tu, gdy ją dziś utworzysz albo zmienisz. Zacznij od nowej notatki.",
  week: "Notatki z ostatnich 7 dni pojawią się tu, gdy je utworzysz albo zmienisz. Zacznij od nowej notatki.",
  label: "Dodaj etykietę, wpisując #nazwę w treści notatki albo wybierając ją w menu notatki.",
  folder: "Przenieś notatkę do tego folderu z jej menu albo wpisz @nazwę folderu przy zapisie.",
  widget: "",
  inbox: "Nowe pomysły wpisz w polu powyżej. Trafią tu, dopóki nie przypiszesz im folderu albo etykiety.",
};

/**
 * Rysunek kreską „długopisem” (cienka linia w kolorze akcentu, lekko przekrzywiona)
 * w pustych widokach. Notatki mają zamiast niego odręczna litera „G”.
 */
const SKETCHES: Partial<Record<View, LucideIcon>> = {
  archive: Archive,
  trash: Trash,
  reminders: Bell,
  today: CalendarDays,
  week: CalendarRange,
  label: Tag,
  folder: FolderOpen,
};

const ELSEWHERE_LABELS: { key: keyof Elsewhere; view: View; name: string }[] = [
  { key: "notes", view: "notes", name: "Notatkach" },
  { key: "archive", view: "archive", name: "Archiwum" },
  { key: "trash", view: "trash", name: "Koszu" },
];

const HERE: Partial<Record<View, string>> = { notes: "Notatkach", archive: "Archiwum", trash: "Koszu" };

export function EmptyState({ view, search, elsewhere, onGo, onNew, onClearSearch }: { view: View; search: string; elsewhere?: Elsewhere; onGo?: (view: View) => void; onNew?: () => void; onClearSearch?: () => void }) {
  if (search) {
    const hits = ELSEWHERE_LABELS.filter((e) => (elsewhere?.[e.key] ?? 0) > 0);
    return (
      <StatusPanel
        tone="no-results"
        title={`Brak wyników${HERE[view] ? ` w ${HERE[view]}` : " w tym widoku"}`}
        description={`Nic nie znaleziono dla „${search}”. Sprawdź pisownię albo szukaj krótszym słowem. Filtr też można wpisać, np. etykieta:praca albo ma:przypomnienie.`}
        actions={hits.length > 0 && onGo ? (
          <>
            <span className="text-sm text-muted-foreground">Znaleziono gdzie indziej:</span>
            {hits.map((e) => (
              <button
                key={e.key}
                type="button"
                onClick={() => onGo(e.view)}
                className="tap-target text-sm font-medium rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-foreground hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {elsewhere![e.key]} w {e.name}
              </button>
            ))}
          </>
        ) : onClearSearch ? (
          // QoL: wyjście z pustego wyniku jednym kliknięciem, bez szukania „×” w pasku.
          <button
            type="button"
            onClick={onClearSearch}
            data-testid="empty-clear-search"
            className="tap-target text-sm font-medium rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-foreground hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            Wyczyść wyszukiwanie
          </button>
        ) : undefined}
      />
    );
  }

  const Sketch = SKETCHES[view];
  return (
    <StatusPanel
      tone="empty"
      icon={Sketch ?? null}
      art={hasEmptyIllustration(view) ? (
        <EmptyIllustration view={view} />
      ) : Sketch ? undefined : (
        <div className="relative w-64 max-w-full mx-auto mb-6">
          <NotatnikWordmark className="relative" />
        </div>
      )}
      title={HEADINGS[view]}
      description={DESCRIPTIONS[view]}
    >
      {onNew && (
        // Pusty widok: jeden główny przycisk (N-3, plan Notatek 4.6), też w Notatkach — wiersz zapisu bywa schowany na telefonie.
        // Przycisk otwiera nową notatkę (1d planu).
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-1.5 rounded-card bg-primary/10 px-4 py-2 text-sm font-medium text-primary-ink hover:bg-primary/20 coarse:min-h-11 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            {view === "notes" ? "Napisz pierwszą notatkę" : "Nowa notatka"}
          </button>
        </div>
      )}
      {view === "notes" && (
        <div className="fade-quiet fade-quiet-delayed coarse:hidden mt-6 flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto">
          {[
            { k: modShortcut("K"), l: "paleta poleceń" },
            { k: modShortcut("N"), l: "nowa notatka" },
          ].map((s) => (
            <span key={s.k} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 border border-border/40 rounded-full px-2.5 py-1">
              <kbd className="font-mono font-semibold text-foreground/80">{s.k}</kbd>
              <span>— {s.l}</span>
            </span>
          ))}
        </div>
      )}
    </StatusPanel>
  );
}
