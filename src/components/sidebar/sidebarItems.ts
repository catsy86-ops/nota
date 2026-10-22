import type { ElementType } from "react";
import { StickyNote, Archive, Bell, Trash, Calendar, CalendarRange, BriefcaseBusiness, HardHat, HandCoins, Inbox, Dumbbell } from "lucide-react";
import type { View } from "@/hooks/useFilteredNotes";

export interface SidebarItem {
  icon: ElementType;
  label: string;
  view: View;
  count?: number;
  /** Licznik oznacza coś pilnego (np. zaległe przypomnienia). */
  alert?: boolean;
}

/** Działy w pasku bocznym; liczniki tylko przy tym, co wymaga uwagi (Skrzynka, zaległe przypomnienia, Kosz). */
export function sidebarItems(counts: { inbox: number; overdue: number; trash: number }): SidebarItem[] {
  return [
    { icon: StickyNote, label: "Notatki", view: "notes" },
    { icon: Inbox, label: "Skrzynka", view: "inbox", count: counts.inbox },
    { icon: Calendar, label: "Dziś", view: "today" },
    { icon: Bell, label: "Przypomnienia", view: "reminders", count: counts.overdue, alert: true },
    { icon: CalendarRange, label: "Kalendarz", view: "calendar" },
    { icon: BriefcaseBusiness, label: "Grafik", view: "shifts" },
    { icon: HardHat, label: "Praca", view: "study" },
    { icon: HandCoins, label: "Długi", view: "debts" },
    { icon: Dumbbell, label: "Ćwiczenia", view: "cwiczenia" },
    { icon: Archive, label: "Archiwum", view: "archive" },
    { icon: Trash, label: "Kosz", view: "trash", count: counts.trash },
  ];
}
