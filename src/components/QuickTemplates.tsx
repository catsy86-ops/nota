import { motion } from "framer-motion";
import { Lightbulb, ListChecks, Users, BookOpen, Plane, Coffee } from "lucide-react";
import type { NoteColor, ChecklistItem } from "@/hooks/useNotes";

interface Template {
  id: string;
  emoji: string;
  label: string;
  icon: React.ElementType;
  color: NoteColor;
  build: () => { title: string; content: string; checklist: ChecklistItem[]; labels: string[] };
}

function uid() { return crypto.randomUUID(); }

const today = () => new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });

export const TEMPLATES: Template[] = [
  {
    id: "idea", emoji: "💡", label: "Pomysł", icon: Lightbulb, color: "sand",
    build: () => ({
      title: "Nowy pomysł 💡",
      content: "**Co to jest?**\n\n**Dlaczego warto?**\n\n**Pierwszy krok:**",
      checklist: [], labels: ["pomysły"],
    }),
  },
  {
    id: "todo", emoji: "✅", label: "Lista zadań", icon: ListChecks, color: "mint",
    build: () => ({
      title: `TODO — ${today()}`,
      content: "",
      checklist: [
        { id: uid(), text: "Pierwsze zadanie", checked: false },
        { id: uid(), text: "Drugie zadanie", checked: false },
        { id: uid(), text: "Trzecie zadanie", checked: false },
      ],
      labels: ["zadania"],
    }),
  },
  {
    id: "meeting", emoji: "👥", label: "Spotkanie", icon: Users, color: "sky",
    build: () => ({
      title: `Notatki ze spotkania — ${today()}`,
      content: "**Uczestnicy:**\n\n**Tematy:**\n- \n\n**Decyzje:**\n- \n\n**Następne kroki:**",
      checklist: [], labels: ["spotkania"],
    }),
  },
  {
    id: "journal", emoji: "📓", label: "Dziennik", icon: BookOpen, color: "lavender",
    build: () => ({
      title: today(),
      content: "**3 rzeczy, za które jestem wdzięczny:**\n1. \n2. \n3. \n\n**Co dziś osiągnąłem:**\n\n**Co jutro:**",
      checklist: [], labels: ["dziennik"],
    }),
  },
  {
    id: "travel", emoji: "✈️", label: "Podróż", icon: Plane, color: "coral",
    build: () => ({
      title: "Plan podróży ✈️",
      content: "**Cel:**\n**Daty:**\n**Budżet:**",
      checklist: [
        { id: uid(), text: "Bilety", checked: false },
        { id: uid(), text: "Nocleg", checked: false },
        { id: uid(), text: "Spakować się", checked: false },
      ],
      labels: ["podróże"],
    }),
  },
  {
    id: "recipe", emoji: "🍳", label: "Przepis", icon: Coffee, color: "peach",
    build: () => ({
      title: "Mój przepis 🍳",
      content: "**Składniki:**\n- \n\n**Przygotowanie:**\n1. ",
      checklist: [], labels: ["przepisy"],
    }),
  },
];

interface Props {
  onPick: (
    title: string,
    content: string,
    color: NoteColor,
    labels: string[],
    reminder: number | null,
    images: string[],
    checklist: ChecklistItem[],
  ) => void;
  onCreateLabel: (label: string) => void;
}

export function QuickTemplates({ onPick, onCreateLabel }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0 mr-1">
        Szablony
      </span>
      {TEMPLATES.map((t, i) => {
        const Icon = t.icon;
        return (
          <motion.button
            key={t.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.04 }}
            whileHover={{ scale: 1.06, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const data = t.build();
              data.labels.forEach(onCreateLabel);
              onPick(data.title, data.content, t.color, data.labels, null, [], data.checklist);
            }}
            className="group shrink-0 flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full text-xs font-medium border border-border/60 bg-card/70 backdrop-blur hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all"
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{t.emoji} {t.label}</span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
