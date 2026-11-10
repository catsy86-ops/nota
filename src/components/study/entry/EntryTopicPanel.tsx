import { Play, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MODULES, TOPICS } from "@/lib/study/content";
import { HeightsButton } from "../HeightsSheet";

type Topic = (typeof TOPICS)[number];
interface CheckItem { id: string; text: string; critical?: boolean; risk?: string }

/** Temat z materiału, którego dotyczy wpis, i punkty listy potwierdzone na budowie. */
export function EntryTopicPanel({ topic, current, items, checked, onTopic, onToggle, onPractice }: {
  topic: string;
  current: Topic | null;
  items: readonly CheckItem[];
  checked: ReadonlySet<string>;
  onTopic: (id: string) => void;
  onToggle: (id: string) => void;
  onPractice: (id: string) => void;
}) {
  return (
    <div id="journal-topic" className="rounded-card border border-border" data-testid="journal-topic-panel">
      {topic === "punkty" && <div className="px-2 py-1"><HeightsButton variant="link" /></div>}
      <label className="block space-y-1 text-xs text-muted-foreground">
        Czego dotyczy
        <select
          value={topic}
          onChange={(e) => onTopic(e.target.value)}
          className="w-full rounded-field border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-ring"
        >
          <option value="">Ogólnie (bez tematu)</option>
          {MODULES.map((m) => (
            <optgroup key={m.id} label={m.label}>
              {TOPICS.filter((t) => t.module === m.id).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      {current && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm leading-snug text-muted-foreground">{current.summary}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => onPractice(current.id)}>
              <Play className="mr-1.5 h-3.5 w-3.5" />Ćwicz pytania
            </Button>
          </div>
          <p className="text-xs font-medium text-foreground">Sprawdź przed przejściem dalej</p>
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-2.5">
                <Checkbox id={`journal-${item.id}`} checked={checked.has(item.id)} onCheckedChange={() => onToggle(item.id)} className="mt-0.5" />
                <label htmlFor={`journal-${item.id}`} className="cursor-pointer text-sm leading-snug">
                  {item.critical && <span className="mr-1 inline-flex align-[-2px]" role="img" aria-label="Punkt krytyczny"><TriangleAlert className="h-3.5 w-3.5 text-warning-ink" aria-hidden /></span>}
                  {item.text}
                  {item.risk && <span className="mt-0.5 block text-xs text-muted-foreground">Ryzyko: {item.risk.replace(/^[^=]*= ?/, "")}</span>}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
