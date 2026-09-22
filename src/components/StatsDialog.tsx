import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ACHIEVEMENTS, computeStats, mergeWithPersisted, usePersistedAchievements, resetAchievements } from "@/lib/achievements";
import type { Note } from "@/hooks/useNotes";
import { Trophy, StickyNote, Pin, Tag, FolderOpen, CheckSquare, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  notes: Note[];
  archivedNotes: Note[];
  allLabels: string[];
  folders: { id: string }[];
}

export function StatsDialog({ open, onOpenChange, notes, archivedNotes, allLabels, folders }: Props) {
  const persisted = usePersistedAchievements();
  const live = computeStats(notes, archivedNotes, allLabels, folders);
  const { effective } = mergeWithPersisted(live);
  const unlockedIds = persisted.unlockedAt;
  const unlocked = ACHIEVEMENTS.filter((a) => a.progress(effective) >= 1).length;

  const tiles = [
    { icon: StickyNote, label: "Notatki", value: effective.totalNotes },
    { icon: Pin, label: "Przypięte", value: effective.pinnedNotes },
    { icon: Tag, label: "Etykiety", value: effective.totalLabels },
    { icon: FolderOpen, label: "Foldery", value: effective.totalFolders },
    { icon: CheckSquare, label: "Ukończone listy", value: effective.checklistsCompleted },
    { icon: Trophy, label: "Odznaki", value: `${unlocked}/${ACHIEVEMENTS.length}` },
  ];

  function handleReset() {
    if (!confirm("Zresetować wszystkie odznaki i postępy? Tej operacji nie można cofnąć.")) return;
    resetAchievements();
    toast.success("Postępy zresetowane");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" /> Statystyki i osiągnięcia
          </DialogTitle>
          <DialogDescription>Twoje postępy w KACZY 🦆 — zapisywane lokalnie</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 pt-2">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-border/60 bg-muted/30 p-3 text-center">
              <t.icon className="w-4 h-4 mx-auto text-primary mb-1" />
              <p className="text-lg font-display font-bold">{t.value}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</p>
            </div>
          ))}
        </div>

        <div className="pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Odznaki</p>
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive">
              <RotateCcw className="w-3 h-3" /> Resetuj
            </Button>
          </div>
          {ACHIEVEMENTS.map((a, i) => {
            const p = a.progress(effective);
            const done = p >= 1;
            const unlockedAt = unlockedIds[a.id];
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${done ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/20"}`}
              >
                <span className={`text-2xl ${done ? "" : "grayscale opacity-50"}`}>{a.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                  <Progress value={p * 100} className="h-1.5 mt-1.5" />
                  {done && unlockedAt && (
                    <p className="text-[10px] text-primary/80 mt-1">
                      Zdobyto {format(unlockedAt, "d MMM yyyy", { locale: pl })}
                    </p>
                  )}
                </div>
                {done && <span className="text-[10px] font-bold text-primary uppercase">✓</span>}
              </motion.div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
