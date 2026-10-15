import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ACHIEVEMENTS,
  computeStats,
  mergeWithPersisted,
  usePersistedAchievements,
  resetAchievements,
  computeDailyActivityCounts,
  activityLastNDays,
  parseDayKey,
} from "@/lib/achievements";
import type { Note } from "@/hooks/useNotes";
import { Trophy, StickyNote, Pin, Tag, FolderOpen, CheckSquare, RotateCcw, Flame, Network } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { notePath } from "@/lib/viewRoute";
import { takeLinkGraphRequest } from "@/lib/graphRequest";

// Graf wchodzi dopiero po otwarciu zakładki — Statystyki same go nie potrzebują.
const NoteGraph = lazy(() => import("@/components/NoteGraph"));
import { motion } from "framer-motion";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  notes: Note[];
  archivedNotes: Note[];
  allLabels: string[];
  folders: { id: string }[];
}

export function StatsDialog({ open, onOpenChange, notes, archivedNotes, allLabels, folders }: Props) {
  // Paleta („Graf powiązań”) otwiera te same Statystyki od razu na grafie.
  const [tab, setTab] = useState<"stats" | "graph">(() => (takeLinkGraphRequest() ? "graph" : "stats"));
  const navigate = useNavigate();
  const graphNotes = useMemo(() => [...notes, ...archivedNotes], [notes, archivedNotes]);
  const persisted = usePersistedAchievements();
  const live = computeStats(notes, archivedNotes, allLabels, folders);
  const { effective } = mergeWithPersisted(live);
  const unlockedIds = persisted.unlockedAt;
  const unlocked = ACHIEVEMENTS.filter((a) => a.progress(effective) >= 1).length;

  const dailyCounts = computeDailyActivityCounts(notes, archivedNotes);
  const activity = activityLastNDays(dailyCounts, 14);

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
      <DialogContent className={cn("max-h-[85vh] overflow-y-auto", tab === "graph" ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary-ink" /> Statystyki i osiągnięcia
          </DialogTitle>
          <DialogDescription>Twoje postępy — zapisywane lokalnie</DialogDescription>
        </DialogHeader>

        <div role="tablist" aria-label="Widok statystyk" className="flex gap-1 rounded-lg bg-muted/50 p-1">
          {([["stats", "Osiągnięcia", Trophy], ["graph", "Graf powiązań", Network]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                tab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>

        {tab === "graph" && (
          <Suspense fallback={<div className="h-64 rounded-xl bg-muted/30" />}>
            <NoteGraph
              notes={graphNotes}
              onOpenNote={(id) => { onOpenChange(false); navigate(notePath(id)); }}
            />
          </Suspense>
        )}

        {tab === "stats" && <>

        <div className="grid grid-cols-3 gap-2 pt-2">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-border/60 bg-muted/30 p-3 text-center">
              <t.icon className="w-4 h-4 mx-auto text-primary-ink mb-1" />
              <p className="text-lg font-display font-bold">{t.value}</p>
              <p className="text-2xs uppercase tracking-wider text-muted-foreground">{t.label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-3 rounded-xl border border-border/60 bg-muted/30 p-3">
          <Flame className={`w-6 h-6 shrink-0 ${live.currentStreak > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {live.currentStreak > 0
                ? `${live.currentStreak} ${live.currentStreak === 1 ? "dzień" : "dni"} z rzędu`
                : "Brak aktywnej passy"}
            </p>
            <p className="text-xs text-muted-foreground">Najdłuższa passa: {effective.longestStreak} dni</p>
          </div>
        </div>

        <div className="pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Aktywność (14 dni)</p>
          <div className="h-24 rounded-xl border border-border/60 bg-muted/20 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => format(parseDayKey(d), "d.MM")}
                  tick={{ fontSize: 10 }}
                  interval={2}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  labelFormatter={(d: string) => format(parseDayKey(d), "d MMM yyyy", { locale: pl })}
                  formatter={(v: number) => [v, "aktywność"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
                    <p className="text-2xs text-primary-ink/80 mt-1">
                      Zdobyto {format(unlockedAt, "d MMM yyyy", { locale: pl })}
                    </p>
                  )}
                </div>
                {done && <span className="text-2xs font-bold text-primary-ink uppercase">✓</span>}
              </motion.div>
            );
          })}
        </div>
        </>}
      </DialogContent>
    </Dialog>
  );
}
