import { motion } from "framer-motion";
import { NotatnikWordmark } from "@/components/NotatnikWordmark";
import type { View, Elsewhere } from "@/hooks/useFilteredNotes";

const HEADINGS: Record<View, string> = {
  notes: "Zacznij tworzyć",
  archive: "Archiwum puste",
  trash: "Kosz jest pusty",
  reminders: "Brak przypomnień",
  calendar: "Pusty miesiąc",
  today: "Brak notatek z dzisiaj",
  week: "Brak notatek z tego tygodnia",
  label: "Brak notatek z tą etykietą",
  folder: "Zacznij tworzyć",
  widget: "Zacznij tworzyć",
};

const DESCRIPTIONS: Record<View, string> = {
  notes: "Stuknij w pasek powyżej (są tam też szablony) lub naciśnij Ctrl+N",
  archive: "Zarchiwizowane notatki pojawią się tutaj",
  trash: "Usunięte notatki pojawią się tutaj",
  reminders: "Notatki z przypomnieniami pojawią się tutaj",
  calendar: "Stuknij w dzień, aby dodać przypomnienie",
  today: "Notatki utworzone lub edytowane dzisiaj pojawią się tutaj",
  week: "Notatki z ostatnich 7 dni pojawią się tutaj",
  label: "Dodaj etykietę do notatki, aby zobaczyć ją tutaj",
  folder: "Dodaj notatkę do tego folderu, aby zobaczyć ją tutaj",
  widget: "",
};

const ELSEWHERE_LABELS: { key: keyof Elsewhere; view: View; name: string }[] = [
  { key: "notes", view: "notes", name: "Notatkach" },
  { key: "archive", view: "archive", name: "Archiwum" },
  { key: "trash", view: "trash", name: "Koszu" },
];

const HERE: Partial<Record<View, string>> = { notes: "Notatkach", archive: "Archiwum", trash: "Koszu" };

export function EmptyState({ view, search, elsewhere, onGo }: { view: View; search: string; elsewhere?: Elsewhere; onGo?: (view: View) => void }) {
  if (search) {
    const hits = ELSEWHERE_LABELS.filter((e) => (elsewhere?.[e.key] ?? 0) > 0);
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
        <p className="text-lg font-display font-semibold text-foreground mb-1">
          Brak wyników{HERE[view] ? ` w ${HERE[view]}` : " w tym widoku"}
        </p>
        <p className="text-muted-foreground">Nic nie znaleziono dla „{search}"</p>
        {hits.length > 0 && onGo && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Znaleziono gdzie indziej:</span>
            {hits.map((e) => (
              <button
                key={e.key}
                type="button"
                onClick={() => onGo(e.view)}
                className="text-sm font-medium rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {elsewhere![e.key]} w {e.name}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center py-20 sm:py-24">
      <div className="relative w-64 max-w-full mx-auto mb-6">
        <div className="absolute inset-x-6 inset-y-2 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 blur-2xl" />
        <NotatnikWordmark className="relative" />
      </div>
      <h2 className="text-2xl font-display font-bold text-foreground mb-2">{HEADINGS[view]}</h2>
      <p className="text-muted-foreground max-w-sm mx-auto mb-6">{DESCRIPTIONS[view]}</p>
      {view === "notes" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto"
        >
          {[
            { k: "⌘K", l: "paleta poleceń" },
            { k: "Ctrl+N", l: "nowa notatka" },
          ].map((s) => (
            <span key={s.k} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 border border-border/40 rounded-full px-2.5 py-1">
              <kbd className="font-mono font-semibold text-foreground/80">{s.k}</kbd>
              <span>— {s.l}</span>
            </span>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
