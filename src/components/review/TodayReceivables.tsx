import { useNavigate } from "react-router-dom";
import { ChevronRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cardVariant } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { pluralPl } from "@/lib/plural";
import { money } from "@/lib/study/billing";
import { useStudyReady } from "@/lib/study/data";
import { REMIND_AFTER_DAYS, type Receivable } from "@/lib/study/receivables";
import { useReceivables } from "@/lib/study/receivablesStore";
import { siteCardUrl } from "@/lib/study/siteLink";
import { useSiteDirectory } from "@/lib/study/studyProjection";

/** Ile wierszy na Dziś; reszta jest w Pracy (przycisk pod listą). */
const SHOWN = 5;

const KIND_LABEL: Record<Receivable["kind"], string> = { site: "Rozliczenie budowy", job: "Zlecenie", invoice: "Faktura" };

const daysPl = (n: number) => `${n} ${pluralPl(n, ["dzień", "dni", "dni"])}`;

/** Druga linia wiersza: skąd kwota i jak długo czeka. Po terminie faktury liczy się termin, nie czekanie. */
function detail(r: Receivable): string {
  const parts = [r.invoiceNumber ? `${KIND_LABEL[r.kind]} · ${r.invoiceNumber}` : KIND_LABEL[r.kind]];
  if (r.overdueDays > 0) parts.push(`po terminie ${daysPl(r.overdueDays)}`);
  else if (r.days > 0) parts.push(`czeka ${daysPl(r.days)}`);
  else parts.push("od dziś");
  return parts.join(" · ");
}

/**
 * R3.1 (decyzja PR-2: sekcja na Dziś) — kto ile jest winien: rozliczenia budów, zlecenia „zrobione”, faktury bez wpłaty.
 * Najdłużej czekające na górze; wiersz otwiera kartę budowy, gdzie jest wpłata i przypomnienie klientowi.
 */
export function TodayReceivables() {
  const ready = useStudyReady();
  const { rows, due } = useReceivables();
  const dir = useSiteDirectory();
  const navigate = useNavigate();
  if (!ready || rows.length === 0) return null;
  const nameOf = (id: string) => dir.find((s) => s.id === id)?.name ?? id;
  const more = rows.length - SHOWN;
  return (
    <section aria-labelledby="today-receivables-title" className={cn(cardVariant(), "p-4")} data-testid="today-receivables">
      <h2 id="today-receivables-title" className="mb-1 flex items-baseline gap-1.5 font-display text-base">
        <Wallet className="size-4 self-center text-primary-ink" aria-hidden />Należności
        <span className="ml-auto font-mono text-sm tabular-nums" data-testid="today-receivables-total">{money(due)}</span>
      </h2>
      <p className="ui-hint mb-2">{rows.length} {pluralPl(rows.length, ["pozycja czeka", "pozycje czekają", "pozycji czeka"])} na zapłatę</p>
      <ul className="divide-y divide-border/50">
        {rows.slice(0, SHOWN).map((r) => {
          const late = r.overdueDays > 0 || r.days >= REMIND_AFTER_DAYS;
          const name = nameOf(r.siteId);
          return (
            <li key={r.id} data-receivable={r.kind}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(siteCardUrl(r.siteId))}
                aria-label={`${name}: ${money(r.due)}, ${detail(r)} — karta budowy`}
                // Ujemny margines: tekst wiersza w jednej linii z nagłówkiem karty, a tło po najechaniu sięga trochę dalej.
                className="-mx-1.5 h-auto w-[calc(100%+0.75rem)] justify-start gap-3 whitespace-normal px-1.5 py-2 text-left font-normal coarse:min-h-11"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{name}</span>
                  <span className={cn("ui-hint block truncate", late && "text-warning-ink")}>{detail(r)}</span>
                  {r.paidPct > 0 && (
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className="block h-full rounded-full bg-success" style={{ width: `${r.paidPct}%` }} />
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm tabular-nums">{money(r.due)}</span>
                  {r.paidPct > 0 && <span className="ui-meta block tabular-nums">zapłacono {r.paidPct}%</span>}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Button>
            </li>
          );
        })}
      </ul>
      {more > 0 && (
        <Button type="button" variant="link" onClick={() => navigate("/praca")} className="mt-1 h-auto px-1.5 py-1 coarse:min-h-11">
          i {more} {pluralPl(more, ["kolejna", "kolejne", "kolejnych"])} w Pracy
        </Button>
      )}
    </section>
  );
}
