import { toast } from "sonner";
import { KIND_LABEL } from "@/lib/study/journalView";
import { findSiteByName } from "@/lib/study/sites";
import { fittingsLine } from "@/lib/study/fittings";
import { mergeFittings } from "@/lib/study/spokenFittings";
import { addShortagesFromDictation, SHORTAGES_MAX } from "@/lib/study/shortages";
import { parseSpokenEntry } from "@/lib/study/spokenEntry";
import { matchStage, siteStages, toggleStage } from "@/lib/study/stages";
import { setSiteShortages, setSiteStages } from "@/lib/study/store";
import type { JournalDraft } from "@/lib/study/draft";

/** Co wypowiedź może ruszyć w arkuszu wpisu: tekst, pola formularza, wybór budowy i dane budów. */
export interface SpokenEntryDeps {
  setText: (next: string | ((prev: string) => string)) => void;
  recentSites: string[];
  knownFittings: string[];
  site: string;
  dir: Parameters<typeof findSiteByName>[0];
  pickSite: (name: string) => void;
  patch: (p: Partial<Pick<JournalDraft, "kind" | "fittings" | "stage">>) => void;
  getForm: () => Pick<JournalDraft, "fittings">;
}

/**
 * Wypowiedź z dyktowania (K-…, P6.1): budowa, rodzaj, kształtki, etap i braki trafiają do swoich pól
 * i kart, a reszta idzie do tekstu wpisu (`spokenEntry.ts`). Wyciągnięte z arkusza wpisu bez zmiany zasad.
 */
export function applySpokenEntry(spoken: string, deps: SpokenEntryDeps): void {
  const { setText, recentSites, knownFittings, site, dir, pickSite, patch, getForm } = deps;
  if (!spoken) return;
  const append = (part: string) => {
    if (part) setText((t) => (t && !/\s$/.test(t) ? `${t} ${part}` : `${t}${part}`));
  };
  const parsed = parseSpokenEntry(spoken, { sites: recentSites, fittings: knownFittings });
  if (!parsed.structured) { append(spoken); return; }
  const done: string[] = [];
  if (parsed.site) { if (parsed.site !== site) pickSite(parsed.site); done.push(`budowa ${parsed.site}`); }
  if (parsed.kind) { patch({ kind: parsed.kind }); done.push(KIND_LABEL[parsed.kind]); }
  if (parsed.fittings.length > 0) {
    patch({ fittings: mergeFittings(getForm().fittings ?? [], parsed.fittings) });
    done.push(`kształtki: ${fittingsLine(parsed.fittings)}`);
  }
  const name = parsed.site ?? site;
  const card = name ? findSiteByName(dir, name) : undefined;
  // „etap próba szczelności zrobiony” — odhacza etap w karcie budowy (już odhaczony zostaje z pierwszą datą).
  if (parsed.stage) {
    const stages = siteStages(card);
    const hit = card ? matchStage(stages, parsed.stage) : null;
    if (!card || !hit) {
      toast.error(card ? `Nie ma takiego etapu: „${parsed.stage}”` : "Etapy są w karcie budowy", {
        description: card ? "Powiedz nazwę jak na liście etapów, np. „etap próba szczelności zrobiony”." : "Najpierw wybierz budowę wpisu albo powiedz jej nazwę na początku.",
      });
    } else {
      if (hit.done === undefined) setSiteStages(card.id, toggleStage(stages, hit.id, Date.now()), stages);
      patch({ stage: hit.id });
      done.push(`etap zrobiony: ${hit.name}`);
    }
  }
  // „brakuje …” — braki idą od razu do karty budowy (wskazanej w wypowiedzi albo bieżącej), nie do wpisu.
  // Bez budowy braki się nie zapiszą, ale treść wpisu ma się dopisać — błąd pokazujemy dopiero po niej.
  let shortageError = false;
  if (parsed.shortages.length > 0 && !card) shortageError = true;
  else if (parsed.shortages.length > 0 && card) {
    const now = Date.now();
    const base = card.shortages ?? [];
    // Pełna lista (SHORTAGES_MAX) odrzuca nowe pozycje — helper liczy je, żeby komunikat mówił prawdę.
    const { list: result, rejected } = addShortagesFromDictation(base, parsed.shortages, now);
    setSiteShortages(card.id, result, base);
    if (rejected > 0) toast.error(`Nie dodano ${rejected} ${rejected === 1 ? "braku" : "braków"}: lista braków budowy jest pełna (${SHORTAGES_MAX})`, { id: "entry-dictation-full" });
    done.push(`braki (${card.name}): ${parsed.shortages.map((x) => (x.qty ? `${x.text} ${x.qty}` : x.text)).join(", ")}`);
  }
  append(parsed.text);
  if (shortageError) toast.error("Braki zapisują się w karcie budowy", { description: "Najpierw wybierz budowę wpisu albo powiedz jej nazwę na początku.", id: "entry-dictation" });
  else toast.success(`Z wypowiedzi: ${done.join(" · ")}`, { id: "entry-dictation" });
}
