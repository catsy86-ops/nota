import { lazy, Suspense, useState } from "react";
import { Lightbulb, ListChecks, Users, BookOpen, CalendarRange, Plane, Coffee, Plus, Pencil } from "lucide-react";
import type { NoteColor, ChecklistItem } from "@/hooks/useNotes";
import type { PeriodKind } from "@/lib/periodNote";
// Okno własnego szablonu ładowane przy pierwszym otwarciu.
const CustomTemplateDialog = lazy(() => import("@/components/CustomTemplateDialog").then((m) => ({ default: m.CustomTemplateDialog })));
import { useCustomTemplates, type CustomTemplate } from "@/lib/customTemplates";
import { renderTemplate } from "@/lib/templateVars";

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
  /** Tydzień i miesiąc działają jak notatka dnia: jedna notatka na okres. */
  onPeriodNote: (kind: PeriodKind) => void;
}

const chipClass = "group shrink-0 flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-lg text-xs font-medium border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5 hover:text-primary-ink transition-colors";

export function QuickTemplates({ onPick, onCreateLabel, onDailyNote, onPeriodNote }: Props) {
  const custom = useCustomTemplates();
  // `undefined` = dialog zamknięty, `null` = nowy szablon, obiekt = edycja.
  const [editing, setEditing] = useState<CustomTemplate | null | undefined>(undefined);
  return (
    <>
    <div
      // Fade na prawej krawędzi mówi, że pasek przewija się w bok (na telefonie
      // chipy nie mieszczą się w szerokości).
      className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1 mask-[linear-gradient(to_right,#000_88%,transparent)] sm:mask-none"
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
      <button
        type="button"
        onClick={() => onPeriodNote("week")}
        title="Jedna notatka na tydzień — kolejne kliknięcie otwiera tę samą"
        className={chipClass}
      >
        <CalendarRange className="w-3.5 h-3.5" />
        <span>Notatka tygodnia</span>
      </button>
      <button
        type="button"
        onClick={() => onPeriodNote("month")}
        title="Jedna notatka na miesiąc — kolejne kliknięcie otwiera tę samą"
        className={chipClass}
      >
        <CalendarRange className="w-3.5 h-3.5" />
        <span>Notatka miesiąca</span>
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
      {custom.map((t) => (
        <span key={t.id} className="group/tpl shrink-0 flex items-center">
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              t.labels.forEach(onCreateLabel);
              onPick(renderTemplate(t.title, now), renderTemplate(t.content, now), "default", t.labels, null, [], []);
            }}
            title="Własny szablon — zmienne ({{data}} itd.) podstawią się przy tworzeniu"
            className={`${chipClass} rounded-r-none`}
          >
            <span aria-hidden>{t.emoji || "📄"}</span>
            <span>{t.name}</span>
          </button>
          <button
            type="button"
            onClick={() => setEditing(t)}
            aria-label={`Edytuj szablon: ${t.name}`}
            className="self-stretch px-1.5 rounded-r-lg border border-l-0 border-border/60 bg-card text-muted-foreground hover:text-primary-ink hover:bg-primary/5 transition-colors"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button type="button" onClick={() => setEditing(null)} className={chipClass} title="Zapisz własny szablon ze zmiennymi, np. {{data}}">
        <Plus className="w-3.5 h-3.5" />
        <span>Własny</span>
      </button>
    </div>
    {editing !== undefined && (
      <Suspense fallback={null}><CustomTemplateDialog key={editing?.id ?? "new"} template={editing} onOpenChange={(o) => { if (!o) setEditing(undefined); }} /></Suspense>
    )}
    </>
  );
}
