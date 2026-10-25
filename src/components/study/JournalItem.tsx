import { lazy, memo, Suspense, useEffect, useState } from "react";
import { Check, CircleCheck, Flag, Gauge, MapPin, Mic, Package, Pencil, Play, Wrench } from "lucide-react";
import { fittingsLine } from "@/lib/study/fittings";
import { freshEntry } from "@/lib/study/entrySheet";
import { cn } from "@/lib/utils";
import { testLine } from "@/lib/study/pressureTest";
import { mapsUrl } from "@/lib/study/geo";
import { Button } from "@/components/ui/button";
import { NoteImage } from "@/components/NoteImage";
import { haptic } from "@/lib/haptics";
import { topicTitle } from "@/lib/study/content";
import { JOURNAL_SOLUTION_MAX, setProblemResolved, setProblemSolution, type JournalEntry } from "@/lib/study/store";
import { entryHeadline, KIND_LABEL, sameJournalEntry } from "@/lib/study/journalView";
import { openJournalEdit } from "@/lib/study/entrySheet";
import { KindIcon } from "./JournalEntrySheet";

const AudioPreview = lazy(() => import("@/components/VoiceAttachmentParts").then((m) => ({ default: m.AudioPreview })));

interface JournalItemProps {
  entry: JournalEntry;
  /** Punkty listy kontrolnej tematu wpisu — liczone raz w dzienniku, nie w każdym wierszu. */
  total: number;
  /** Nazwa etapu, do którego przypięto wpis (`entry.stage`); `null` = bez etapu albo etap usunięty (1.9). */
  stage: string | null;
  onPractice: (topicId: string) => void;
  onTopic: (topicId: string) => void;
  onZoom: (refs: string[], index: number) => void;
}

/**
 * Wiersz osi dziennika. W `memo` z porównaniem treści wpisu: każda zmiana dokumentu daje nowe obiekty
 * wpisów, a przerysować trzeba tylko te, które naprawdę się zmieniły. Callbacki muszą być stabilne.
 */
export const JournalItem = memo(JournalItemRow, (a, b) =>
  a.total === b.total && a.stage === b.stage && a.onPractice === b.onPractice && a.onTopic === b.onTopic && a.onZoom === b.onZoom && sameJournalEntry(a.entry, b.entry));

function JournalItemRow({ entry: e, total, stage, onPractice, onTopic, onZoom }: JournalItemProps) {
  const resolved = e.kind === "problem" && e.resolved !== undefined;
  /** Pole „Jak rozwiązane?” otwarte — samo po oznaczeniu problemu jako rozwiązanego, jeśli brak opisu. */
  const [solving, setSolving] = useState(false);
  // Świeżo dodany wpis: podświetlenie przy montażu wiersza (§9 W5); jednorazowe, bez zapamiętywania.
  const [fresh] = useState(() => freshEntry.id === e.id);

  function toggleResolved() {
    haptic(resolved ? "tap" : "success");
    setProblemResolved(e.id, !resolved);
    setSolving(!resolved && !e.solution);
  }

  return (
    // Wpis jak linijka w zeszycie: godzina na marginesie, linia oddziela wpisy zamiast ramki.
    <li className={cn("grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 border-b border-dashed border-border/70 py-3 first:pt-1 last:border-b-0", fresh && "journal-fresh")} data-fresh={fresh || undefined} data-journal-entry={e.kind} data-resolved={resolved || undefined}>
      <time
        dateTime={new Date(e.at).toISOString()}
        className="border-r border-primary/30 pr-2 pt-0.5 text-right font-mono text-xs tabular-nums text-muted-foreground"
      >
        {new Date(e.at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
      </time>
      <div className="flex min-w-0 items-start gap-2.5">
        {resolved ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : <KindIcon kind={e.kind} />}
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap wrap-break-word text-sm leading-snug">{entryHeadline(e)}</p>
          {e.fittings && e.fittings.length > 0 && (
            <p className="mt-1 inline-flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="journal-fittings">
              <Package className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />{fittingsLine(e.fittings)}
            </p>
          )}
          {e.test && (
            <p className={cn("mt-1 inline-flex items-start gap-1.5 text-xs font-medium", e.test.ok ? "text-success-ink" : "text-destructive-ink")} data-testid="journal-test">
              <Gauge className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />{testLine(e.test)}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{resolved ? "Problem rozwiązany" : KIND_LABEL[e.kind]}</span>
            {/* Pieczątka na osi czasu: problem wciąż otwarty (3.5 § W3 planu Praca 2026-10-24). */}
            {e.kind === "problem" && !resolved && (
              <span className="stamp-tag text-warning-ink" data-testid="journal-open-stamp">OTWARTY</span>
            )}
            {stage && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary-ink" data-testid="journal-entry-stage">
                <Flag className="h-3 w-3" aria-hidden />Etap: {stage}
              </span>
            )}
            {e.geo && (
              // „Tu jestem” — gdzie zapisano wpis; link do map, tylko w aplikacji (raport tego nie zawiera).
              <a href={mapsUrl(e.geo)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline coarse:min-h-11 coarse:items-center" data-testid="journal-entry-geo">
                <MapPin className="h-3 w-3" aria-hidden />Mapa
              </a>
            )}
            {e.topic && (
              // Pigułka tematu filtruje dziennik po temacie — ćwiczenie jest pod jawnym „Ćwicz teraz”.
              <button
                type="button"
                onClick={() => onTopic(e.topic!)}
                className="pressable rounded-full bg-muted px-2 py-0.5 hover:bg-primary/10 hover:text-primary-ink coarse:min-h-11 coarse:px-3 coarse:text-sm"
                title="Pokaż wpisy z tego tematu"
                aria-label={`Pokaż wpisy z tematu: ${topicTitle(e.topic)}`}
              >
                {topicTitle(e.topic)}
              </button>
            )}
            {e.checked.length > 0 && <span className="tabular-nums">punkty {e.checked.length}/{total}</span>}
          </div>
          {e.kind === "problem" && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleResolved}
                className={cn(
                  "pressable inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs coarse:min-h-11 coarse:px-3.5 coarse:text-sm",
                  resolved ? "border-border text-muted-foreground hover:text-foreground" : "border-warning/60 bg-warning/10 font-medium text-foreground hover:bg-warning/20",
                )}
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                {resolved ? "Otwórz ponownie" : "Oznacz jako rozwiązany"}
              </button>
              {/* Otwarty problem z tematem: od razu runda pytań z tego tematu — teoria tam, gdzie praktyka zawiodła. */}
              {!resolved && e.topic && (
                <button
                  type="button"
                  onClick={() => onPractice(e.topic!)}
                  aria-label={`Ćwicz teraz: ${topicTitle(e.topic)}`}
                  className="pressable inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-2.5 py-1 text-xs font-medium text-primary-ink hover:bg-primary/10 coarse:min-h-11 coarse:px-3.5 coarse:text-sm"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden />Ćwicz teraz
                </button>
              )}
            </div>
          )}
          {resolved && <SolutionLine entry={e} editing={solving} onEditing={setSolving} />}
          {e.recordings && e.recordings.length > 0 && (
            <ul className="mt-2 space-y-2" aria-label="Nagrania wpisu">
              {e.recordings.map((a) => (
                <li key={a.hash} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mic className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <Suspense fallback={null}><AudioPreview attachment={a} /></Suspense>
                </li>
              ))}
            </ul>
          )}
          {e.images.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Zdjęcia wpisu">
              {e.images.map((ref, i) => (
                <li key={ref}>
                  <button type="button" onClick={() => onZoom(e.images, i)} aria-label={`Powiększ zdjęcie ${i + 1} z ${e.images.length}`} className="relative block overflow-hidden rounded-lg">
                    <NoteImage imageRef={ref} alt="" className="h-16 w-16 object-cover" placeholderClassName="h-16 w-16" />
                    {/* Numer zdjęcia na miniaturze (§D3): od razu widać, które z kolei jest w galerii. */}
                    {e.images.length > 1 && <span aria-hidden className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 font-mono text-[10px] leading-4 text-white tabular-nums">{i + 1}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => openJournalEdit(e)}
          aria-label="Edytuj wpis"
          title="Edytuj albo usuń wpis"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground coarse:h-11 coarse:w-11"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

/**
 * Jak problem rozwiązano — jedno-dwa zdania pod rozwiązanym problemem („wymieniona złączka, dokręcony
 * śrubunek”). Trafia do raportu i do „Moich rozwiązań” przy temacie na tablicy Nauki.
 */
function SolutionLine({ entry: e, editing, onEditing }: { entry: JournalEntry; editing: boolean; onEditing: (v: boolean) => void }) {
  const [text, setText] = useState(e.solution ?? "");
  useEffect(() => { if (editing) setText(e.solution ?? ""); }, [editing, e.solution]);

  if (editing) {
    return (
      <form
        className="mt-2 flex flex-wrap gap-2"
        aria-label="Jak rozwiązane"
        onSubmit={(ev) => { ev.preventDefault(); setProblemSolution(e.id, text); haptic("success"); onEditing(false); }}
      >
        <input
          autoFocus
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          maxLength={JOURNAL_SOLUTION_MAX}
          placeholder="Jak rozwiązane? np. wymieniona złączka"
          aria-label="Jak rozwiązane?"
          className="h-9 min-w-0 flex-1 basis-56 rounded-lg border border-input bg-background px-2.5 text-base outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm"
        />
        <Button type="submit" size="sm" className="coarse:h-11">Zapisz</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onEditing(false)} className="coarse:h-11">Pomiń</Button>
      </form>
    );
  }
  if (e.solution) {
    return (
      <p className="mt-1.5 flex items-start gap-1.5 text-xs text-foreground/80" data-testid="journal-solution">
        <Wrench className="mt-px h-3.5 w-3.5 shrink-0 text-success-ink" aria-hidden />
        <span className="min-w-0"><span className="font-medium">Rozwiązanie:</span> {e.solution}</span>
        <button type="button" onClick={() => onEditing(true)} className="shrink-0 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline coarse:min-h-11">Zmień</button>
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onEditing(true)}
      className="pressable mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground coarse:min-h-11"
    >
      <Wrench className="h-3.5 w-3.5" aria-hidden />Jak rozwiązane?
    </button>
  );
}
