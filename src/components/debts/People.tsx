import { useId, useState } from "react";
import { StatusPanel } from "@/components/StatusPanel";
import { ChevronDown, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { amountText } from "@/lib/debts/hideAmounts";
import { avatarHue, initialOf, debtSide, foldName, repaidShare, type PersonDebts } from "@/lib/debts/model";
import { cardVariant } from "@/components/ui/card";

/** Powyżej tylu osób nad listą jest pole szukania (2.5). */
const SEARCH_FROM = 8;

export function People({ people, onOpen, hidden, onStart }: { people: PersonDebts[]; onOpen: (key: string) => void; hidden: boolean; onStart?: () => void }) {
  const [query, setQuery] = useState("");
  const [showSettled, setShowSettled] = useState(false);
  const settledId = useId();
  if (people.length === 0) {
    return (
      // Ten sam pusty stan co w innych działach (`StatusPanel`, nowy plan 2.5), z własnym szkicem portfela.
      <div data-testid="debts-empty">
        <StatusPanel size="inline" art={<EmptySketch />} className="p-8"
          title="Jeszcze nikogo tu nie ma"
          description="Zapisz pierwszą pożyczkę — od razu zobaczysz, kto ile jest winien."
          actions={onStart && <Button className="h-11 gap-2" onClick={onStart}><Plus className="size-4" aria-hidden />Dodaj pierwszy wpis</Button>} />
      </div>
    );
  }
  // 2.5: szukanie przy dłuższej liście; wynik obejmuje też rozliczonych (bez zwijania).
  const q = foldName(query);
  const found = q ? people.filter((p) => foldName(p.name).includes(q)) : people;
  const active = found.filter((p) => p.balance !== 0);
  const settled = found.filter((p) => p.balance === 0);
  return (
    <div className="space-y-2">
      {people.length > SEARCH_FROM && (
        <label className="relative block">
          <span className="sr-only">Szukaj osoby</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" enterKeyHint="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj osoby" className="h-11 pl-9" />
        </label>
      )}
      {q && found.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground" role="status">Nikogo takiego — sprawdź imię.</p>}
      {active.length > 0 && <PersonList people={active} onOpen={onOpen} hidden={hidden} label="Osoby i salda" />}
      {settled.length > 0 && (q ? (
        <PersonList people={settled} onOpen={onOpen} hidden={hidden} label="Rozliczeni" />
      ) : (
        // 2.4: rozliczeni na dole, domyślnie zwinięci.
        <div className="pt-2">
          <button
            type="button"
            aria-expanded={showSettled}
            aria-controls={settledId}
            onClick={() => setShowSettled((v) => !v)}
            className="pressable inline-flex items-center gap-1.5 rounded-field px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground coarse:min-h-11"
          >
            <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", showSettled && "rotate-180")} aria-hidden />
            Rozliczeni ({settled.length})
          </button>
          <div id={settledId} hidden={!showSettled} className="mt-2">
            <PersonList people={settled} onOpen={onOpen} hidden={hidden} label="Rozliczeni" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PersonList({ people, onOpen, hidden, label }: { people: PersonDebts[]; onOpen: (key: string) => void; hidden: boolean; label: string }) {
  return (
    <ul className="space-y-2" aria-label={label}>
      {people.map((p) => {
        // 1.3: pasek strony winnej — także przy samym „Pożyczyłem od”.
        const { side } = debtSide(p.entries);
        const share = repaidShare(p.entries);
        const settled = p.balance === 0;
        return (
          <li key={p.key}>
            <button
              type="button"
              onClick={() => onOpen(p.key)}
              className={cn(cardVariant("interactive"), "group w-full p-card text-left")}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="debt-avatar grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold" data-avatar={avatarHue(p.name)} aria-hidden>{initialOf(p.name)}</span>
                  <span className="font-display text-base font-semibold truncate">{p.name}</span>
                </span>
                {settled ? (
                  <span className="shrink-0 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success-ink">Rozliczone</span>
                ) : (
                  <span className={cn("shrink-0 font-mono text-base font-semibold tabular-nums", p.balance > 0 ? "text-success-ink" : "text-warning-ink")}>
                    {p.balance > 0 ? amountText(p.balance, hidden) : `− ${amountText(-p.balance, hidden)}`}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="shrink-0">{settled ? "Oddane w całości" : p.balance > 0 ? "Do oddania" : "Jesteś winien"}</span>
                {side > 0 && (
                  <div className="debt-bar h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Oddano ${share}% z ${amountText(side, hidden)}`}>
                    <div className={cn("debt-bar-fill h-full rounded-full transition-[width] duration-slow motion-reduce:transition-none", p.balance < 0 ? "bg-warning" : "bg-success")} style={{ width: `${share}%` }} />
                  </div>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** 4.4: portfel i moneta kreską — rysują się przy pojawieniu (`.debt-sketch` w `index.css`). */
function EmptySketch() {
  return (
    <svg viewBox="0 0 120 80" className="debt-sketch mx-auto h-20 w-28 text-primary" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path pathLength={1} d="M18 26 C18 21 21 18 26 18 L86 18 C91 18 94 21 94 26 L94 62 C94 67 91 70 86 70 L26 70 C21 70 18 67 18 62 Z" />
      <path pathLength={1} d="M18 30 L70 30" />
      <path pathLength={1} d="M78 38 L100 38 C102 38 103 39 103 41 L103 51 C103 53 102 54 100 54 L78 54 C75 54 73 52 73 49 L73 43 C73 40 75 38 78 38 Z" />
      <circle pathLength={1} cx="82" cy="46" r="2.5" />
      <circle pathLength={1} cx="104" cy="16" r="9" />
      <path pathLength={1} d="M101 16 L107 16 M104 12 L104 20" />
    </svg>
  );
}
