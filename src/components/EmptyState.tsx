import { motion } from "framer-motion";
import duckLogo from "@/assets/duck-logo.png";
import type { View } from "@/hooks/useFilteredNotes";

const HEADINGS: Record<View, string> = {
  notes: "Zacznij tworzyć ✨",
  archive: "Archiwum puste",
  trash: "Kosz jest pusty",
  reminders: "Brak przypomnień",
  today: "Brak notatek z dzisiaj",
  week: "Brak notatek z tego tygodnia",
  label: "Brak notatek z tą etykietą",
  folder: "Zacznij tworzyć ✨",
  widget: "Zacznij tworzyć ✨",
};

const DESCRIPTIONS: Record<View, string> = {
  notes: "Stuknij w pasek powyżej, użyj szablonu lub naciśnij Ctrl+N",
  archive: "Zarchiwizowane notatki pojawią się tutaj",
  trash: "Usunięte notatki pojawią się tutaj",
  reminders: "Notatki z przypomnieniami pojawią się tutaj",
  today: "Notatki utworzone lub edytowane dzisiaj pojawią się tutaj",
  week: "Notatki z ostatnich 7 dni pojawią się tutaj",
  label: "Dodaj etykietę do notatki, aby zobaczyć ją tutaj",
  folder: "Dodaj notatkę do tego folderu, aby zobaczyć ją tutaj",
  widget: "",
};

export function EmptyState({ view, search }: { view: View; search: string }) {
  if (search) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
        <p className="text-lg font-display font-semibold text-foreground mb-1">Brak wyników</p>
        <p className="text-muted-foreground">Nic nie znaleziono dla „{search}"</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center py-20 sm:py-24">
      <motion.div
        className="relative w-32 h-32 mx-auto mb-6"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 blur-2xl" />
        <img src={duckLogo} alt="" className="relative w-32 h-32 mx-auto drop-shadow-xl" />
      </motion.div>
      <h2 className="text-3xl font-display font-extrabold gradient-text mb-2">{HEADINGS[view]}</h2>
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
            { k: "↑↑↓↓←→←→BA", l: "niespodzianka" },
          ].map((s) => (
            <span key={s.k} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/60 border border-border/40 rounded-full px-2.5 py-1">
              <kbd className="font-mono font-semibold text-foreground/80">{s.k}</kbd>
              <span>— {s.l}</span>
            </span>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
