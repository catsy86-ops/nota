import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pluralPl } from "@/lib/plural";
import { MODULES, TOPICS } from "@/lib/study/content";
import { CUSTOM_TEXT_MAX } from "@/lib/study/custom";
import { deleteCustom } from "@/lib/study/customActions";
import { addCustomItem, useStudy } from "@/lib/study/store";

const selectClass =
  "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11";

/** Wybór tematu pogrupowany w moduły — jak w arkuszu wpisu. */
export function TopicSelect({ id, value, onChange, ariaLabel }: { id?: string; value: string; onChange: (topic: string) => void; ariaLabel: string }) {
  return (
    <select id={id} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      {MODULES.map((m) => (
        <optgroup key={m.id} label={m.label}>
          {TOPICS.filter((t) => t.module === m.id).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

/**
 * Własne punkty listy do nauki (N5). Zwijane, jak ściąga pod listą: materiał jest
 * na wierzchu, a dodawanie nie zabiera miejsca. Punkt trafia do tematu i liczy się
 * w postępie tematu, w dzienniku i w tablicy tak samo jak punkty z materiału.
 */
export function CustomChecklistSection() {
  const study = useStudy();
  const items = study.custom.filter((e) => e.kind === "item");
  const [topic, setTopic] = useState(TOPICS[0].id);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    const t = text.trim();
    if (!t) { setError("Wpisz treść punktu."); return; }
    if (t.length > CUSTOM_TEXT_MAX) { setError(`Punkt ma najwyżej ${CUSTOM_TEXT_MAX} znaków.`); return; }
    if (!addCustomItem(topic, t)) { setError("Nie udało się dodać. Sprawdź, czy nie ma ich już 200."); return; }
    setText("");
    setError(null);
  }

  return (
    <details className="rounded-xl border border-border bg-card p-3.5 group" data-testid="custom-checklist">
      <summary className="cursor-pointer text-sm font-medium">
        Własne punkty{items.length > 0 && <span className="ml-1.5 font-mono tabular-nums text-muted-foreground">({items.length})</span>}
      </summary>
      <div className="mt-3 space-y-3">
        <form
          className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-start"
          onSubmit={(e) => { e.preventDefault(); add(); }}
        >
          <TopicSelect value={topic} onChange={setTopic} ariaLabel="Temat punktu" />
          <div className="min-w-0">
            <Input
              value={text}
              onChange={(e) => { setText(e.target.value); if (error) setError(null); }}
              placeholder="Np. sprawdzić zawór przed płukaniem"
              maxLength={CUSTOM_TEXT_MAX}
              aria-label="Treść punktu"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "custom-item-error" : undefined}
            />
            {error && <p id="custom-item-error" role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
          </div>
          <Button type="submit" variant="outline" className="coarse:h-11">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />Dodaj punkt
          </Button>
        </form>

        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nic jeszcze nie dodano. Punkt pojawi się w wybranym temacie, obok punktów z materiału.</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((e) => {
              if (e.kind !== "item") return null;
              const title = TOPICS.find((t) => t.id === e.topic)?.title ?? e.topic;
              return (
                <li key={e.id} className="flex items-start gap-2 text-sm">
                  <span className="min-w-0 flex-1">
                    {e.text}
                    <span className="block text-xs text-muted-foreground">{title}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Usuń punkt: ${e.text}`}
                    onClick={() => deleteCustom(e, e.text)}
                    className="coarse:h-11"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {items.length > 0 && (
          <p className="text-xs text-muted-foreground">{pluralPl(items.length, ["własny punkt", "własne punkty", "własnych punktów"])} · dopisane do tematów w liście.</p>
        )}
      </div>
    </details>
  );
}
