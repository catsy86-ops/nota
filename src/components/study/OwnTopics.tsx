import { useState } from "react";
import { BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CUSTOM_TOPIC_MAX, type CustomTopic } from "@/lib/study/custom";
import { addCustomTopic, removeCustomTopic } from "@/lib/study/learnActions";

/**
 * „Moje tematy” w Nauce (P4.6, v1): nazwa tematu, a pytania i punkty dopina się w „Moje pytania”
 * i w liście kontrolnej. Ćwiczenie tematu uruchamia rundę z jego pytań. Bez tablicy i statystyk.
 */
export function OwnTopics({ topics, onPractice }: { topics: readonly CustomTopic[]; onPractice: (topic: string) => void }) {
  const [title, setTitle] = useState("");

  function add() {
    const t = title.trim();
    if (!t) return;
    const added = addCustomTopic(t);
    if (!added) { toast.error(`Nazwa do ${CUSTOM_TOPIC_MAX} znaków albo za dużo wpisów`); return; }
    setTitle("");
    toast.success(`Dodano temat „${added.title}”`);
  }

  function remove(t: CustomTopic) {
    removeCustomTopic(t.id);
    toast(`Usunięto temat „${t.title}” razem z jego pytaniami i punktami`);
  }

  return (
    <section aria-label="Moje tematy" className="space-y-2 rounded-card border border-border bg-card p-3" data-testid="own-topics">
      <h3 className="text-xs font-semibold text-muted-foreground">Moje tematy</h3>
      {topics.length > 0 && (
        <ul className="space-y-1">
          {topics.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
              <Button variant="outline" size="sm" onClick={() => onPractice(t.id)} aria-label={`Ćwicz temat: ${t.title}`} className="coarse:min-h-11">
                <BookOpen className="mr-1 h-4 w-4" aria-hidden />Ćwicz
              </Button>
              <Button variant="ghost" size="sm" onClick={() => remove(t)} aria-label={`Usuń temat: ${t.title}`} className="coarse:min-h-11">
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={CUSTOM_TOPIC_MAX} placeholder="Nowy temat, np. Pompy ciepła" aria-label="Nazwa nowego tematu" autoComplete="off" className="min-w-0 flex-1" />
        <Button type="submit" variant="outline" disabled={!title.trim()} className="shrink-0 coarse:min-h-11">Dodaj temat</Button>
      </form>
    </section>
  );
}
