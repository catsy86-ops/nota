import type { ComponentProps } from "react";
import type { JournalEntry } from "@/lib/study/store";
import { SiteStagesPanel } from "../SiteStagesPanel";
import { SiteFaultsPanel } from "../SiteFaultsPanel";
import { SiteTimePanel } from "../SiteTimePanel";
import { SiteShortagesPanel } from "../SiteShortagesPanel";
import { SiteMaterialPanel } from "../SiteMaterialPanel";
import { SiteOrderPanel } from "../SiteOrderPanel";

type Site = ComponentProps<typeof SiteStagesPanel>["site"];
type Journal = JournalEntry[];

/**
 * Segmenty karty budowy (R2.2). Bez `lazy`: karta montuje wszystkie segmenty od razu (`forceMount` + `Activity`, żeby
 * rozwinięte sekcje i wpisany tekst przeżyły zmianę segmentu), więc leniwe moduły pobierałyby się i tak przy otwarciu —
 * tylko kaskadą zamiast jednym plikiem.
 */
export function SiteTodaySegment({ site, journal, hours }: {
  site: Site;
  journal: Journal;
  hours: { today: string; monthDays: ComponentProps<typeof SiteTimePanel>["monthDays"] } | null;
}) {
  return (
    <>
      <SiteStagesPanel site={site} journal={journal} />
      <SiteFaultsPanel site={site} journal={journal} />
      {hours && <SiteTimePanel site={site} today={hours.today} monthLabel={new Date(`${hours.today}T12:00`).toLocaleDateString("pl-PL", { month: "long", year: "numeric" })} monthDays={hours.monthDays} />}
    </>
  );
}

export function SiteMaterialSegment({ site, journal }: { site: Site; journal: Journal }) {
  return (
    <>
      <SiteShortagesPanel site={site} />
      <SiteMaterialPanel site={site} journal={journal} />
      <SiteOrderPanel site={site} />
    </>
  );
}
