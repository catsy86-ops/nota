import { useMemo } from "react";
import { NoteGroupSection } from "@/components/NoteGroupSection";
import type { Note } from "@/hooks/useNotes";
import { weekSeriesForecasts } from "@/lib/reminderForecast";
import { SeriesForecastRows } from "./SeriesForecastRows";

/** Sekcja „Prognoza serii” w widoku Terminy. Ładowana leniwie — rozwijanie serii nie idzie do paczki startowej. */
export default function SeriesForecastSection({ notes }: { notes: Note[] }) {
  const forecasts = useMemo(() => weekSeriesForecasts(notes), [notes]);
  if (forecasts.length === 0) return null;
  return (
    <NoteGroupSection groupKey="reminders-series" label="Prognoza serii (najbliższe 7 dni)" count={forecasts.length}>
      <SeriesForecastRows forecasts={forecasts} />
    </NoteGroupSection>
  );
}
