import { useRef, useState } from "react";
import { Copy, Mic, PackageX, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { useDictation } from "@/hooks/useDictation";
import { cn } from "@/lib/utils";
import { toastWithUndo } from "@/lib/undoToast";
import { setSiteShortages } from "@/lib/study/store";
import type { SiteInfo } from "@/lib/study/sites";
import {
  addShortage, clearDelivered, dueDayValue, dueFromDayValue, nextStatus, removeShortage, setShortageDue, setShortageStatus,
  shortagesText, spokenShortageLabel, SHORTAGE_QTY_MAX, SHORTAGE_TEXT_MAX, SHORTAGES_MAX, STATUS_LABEL, type ShortageStatus,
} from "@/lib/study/shortages";

const STATUS_CLASS: Record<ShortageStatus, string> = {
  // Czerwień, nie ostrzeżenie: w motywie bursztyn (kolor główny) i ostrzeżenie są prawie tym samym kolorem,
  // a „Brakuje” musi odróżniać się od „Zamówione” na pierwszy rzut oka.
  missing: "border-destructive/50 bg-destructive/10 text-destructive-ink",
  ordered: "border-primary/40 bg-primary/10 text-primary-ink",
  delivered: "border-success-ink/40 bg-success/10 text-success-ink",
};

/**
 * Braki materiału w karcie budowy: dowolna pozycja z ilością („Rura PEX 16 — 50 m”). Stuknięcie
 * w status przełącza brakuje → zamówione → dostarczone. „Kopiuj” daje tekst dla dostawcy albo szefa;
 * niedostarczone idą też do raportu budowy.
 */
export function SiteShortagesPanel({ site }: { site: SiteInfo }) {
  const list = site.shortages ?? [];
  const [text, setText] = useState("");
  const [qty, setQty] = useState("");
  const open = list.filter((s) => s.status !== "delivered").length;
  const delivered = list.length - open;

  // Wynik mowy od razu idzie do listy: ref, żeby dwa wyniki z rzędu nie gubiły się między renderami.
  const listRef = useRef(list);
  listRef.current = list;
  const dictation = useDictation((spoken) => {
    const label = spokenShortageLabel(spoken);
    if (!label) return;
    const cur = listRef.current;
    const next = addShortage(cur, label, "", Date.now());
    if (next.length === cur.length) { toast("Nie udało się dodać braku", { id: "shortage-dictation", description: `Usłyszałem: „${spoken}”.` }); return; }
    listRef.current = next;
    setSiteShortages(site.id, next, cur);
    haptic("success");
    toast.success(`Dodano brak: ${label}`, { id: "shortage-dictation" });
  });

  function add() {
    const next = addShortage(list, text, qty, Date.now());
    if (next.length === list.length && next.every((s, i) => s.qty === list[i]?.qty)) return;
    setSiteShortages(site.id, next, list);
    setText("");
    setQty("");
    haptic("tap");
  }

  function cycle(id: string) {
    const item = list.find((s) => s.id === id);
    if (!item) return;
    const status = nextStatus(item.status);
    haptic(status === "delivered" ? "success" : "selection");
    setSiteShortages(site.id, setShortageStatus(list, id, status, Date.now()), list);
  }

  function setDue(id: string, value: string) {
    setSiteShortages(site.id, setShortageDue(list, id, dueFromDayValue(value)), list);
  }

  function remove(id: string) {
    const before = list;
    const after = removeShortage(list, id);
    const label = list.find((s) => s.id === id)?.text ?? "pozycję";
    setSiteShortages(site.id, after, before);
    toastWithUndo(`Usunięto „${label}”`, () => setSiteShortages(site.id, before, after));
  }

  function clear() {
    const before = list;
    const after = clearDelivered(list);
    setSiteShortages(site.id, after, before);
    toastWithUndo(`Wyczyszczono dostarczone: ${delivered}`, () => setSiteShortages(site.id, before, after));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shortagesText(site.name, list));
      haptic("tap");
      toast.success("Skopiowano listę braków");
    } catch {
      toast.error("Nie udało się skopiować", { description: "Przeglądarka nie dała dostępu do schowka." });
    }
  }

  return (
    <section aria-label="Braki materiału" data-testid="site-shortages" className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <PackageX className="h-3.5 w-3.5" aria-hidden />Braki materiału
        </h3>
        {open > 0 && <span className="font-mono text-xs tabular-nums text-muted-foreground" data-testid="site-shortages-open">{open} w drodze lub brak</span>}
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Dopisz, czego brakuje — trafi do raportu dla szefa.</p>
      ) : (
        <ul className="space-y-1">
          {list.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5" data-shortage-status={s.status}>
              <span className={cn("min-w-0 flex-1 text-sm", s.status === "delivered" && "text-muted-foreground line-through decoration-muted-foreground/50")}>
                {s.text}{s.qty && <span className="text-muted-foreground"> · {s.qty}</span>}
              </span>
              {s.status === "ordered" && (
                <input
                  type="date"
                  value={dueDayValue(s.due)}
                  onChange={(e) => setDue(s.id, e.target.value)}
                  aria-label={`Data dostawy: ${s.text}`}
                  title="Data dostawy"
                  className="h-8 w-[8.5rem] shrink-0 rounded-lg border border-input bg-background px-1.5 text-base outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm"
                />
              )}
              <button
                type="button"
                onClick={() => cycle(s.id)}
                aria-label={`${s.text}: ${STATUS_LABEL[s.status]}. Zmień status`}
                className={cn("pressable shrink-0 rounded-full border px-2 py-0.5 text-2xs font-medium coarse:min-h-11 coarse:px-3", STATUS_CLASS[s.status])}
              >
                {STATUS_LABEL[s.status]}
              </button>
              <button
                type="button"
                onClick={() => remove(s.id)}
                aria-label={`Usuń brak: ${s.text}`}
                className="pressable grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground coarse:size-11"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {list.length < SHORTAGES_MAX && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={SHORTAGE_TEXT_MAX}
            placeholder="Czego brakuje, np. Rura PEX 16"
            aria-label="Czego brakuje"
            autoComplete="off"
            className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-base outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm"
          />
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            maxLength={SHORTAGE_QTY_MAX}
            placeholder="Ile"
            aria-label="Ile"
            autoComplete="off"
            className="h-9 w-20 shrink-0 rounded-lg border border-input bg-background px-2.5 text-base outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm"
          />
          {dictation.supported && (
            <button
              type="button"
              onClick={() => { haptic("tap"); dictation.toggle(); }}
              aria-pressed={dictation.listening}
              aria-label={dictation.listening ? "Zakończ dyktowanie braku" : "Dyktuj brak"}
              title="Powiedz np. „dokupić trójnik fi 32”"
              className={cn("pressable grid size-9 shrink-0 place-items-center rounded-lg border coarse:size-11", dictation.listening ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted")}
            >
              <Mic className={cn("h-4 w-4", dictation.listening && "animate-pulse")} aria-hidden />
            </button>
          )}
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Dodaj brak"
            className="pressable grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 coarse:size-11"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </form>
      )}

      {list.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copy} disabled={open === 0} className="coarse:h-11">
            <Copy className="mr-1.5 h-4 w-4" aria-hidden />Kopiuj braki
          </Button>
          {delivered > 0 && (
            <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground coarse:h-11">
              Wyczyść dostarczone ({delivered})
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
