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
  /** Notatka dnia nie jest szablonem: otwiera (albo tworzy) jedną notatkę na dzień. */
  onDailyNote: () => void;
}

const chipClass = "group shrink-0 flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-lg text-xs font-medium border border-border/60 bg-card/70 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors";

export function QuickTemplates({ onPick, onCreateLabel, onDailyNote }: Props) {
  return (
    <div
      // Fade na prawej krawędzi mówi, że pasek przewija się w bok (na telefonie
      // chipy nie mieszczą się w szerokości).
      className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1 [mask-image:linear-gradient(to_right,#000_88%,transparent)] sm:[mask-image:none]"
    >
      <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0 mr-1">
        Szablony
      </span>
      <button
        type="button"
        onClick={onDailyNote}
        title="Jedna notatka na dzień — kolejne kliknięcie dopisuje do dzisiejszej"
        className={chipClass}
      >
        <BookOpen className="w-3.5 h-3.5" />
        <span>Notatka dnia</span>
      </button>
      {TEMPLATES.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              const data = t.build();
              data.labels.forEach(onCreateLabel);
              onPick(data.title, data.content, t.color, data.labels, null, [], data.checklist);
            }}
            className={chipClass}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
