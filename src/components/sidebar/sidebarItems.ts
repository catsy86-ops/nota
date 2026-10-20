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
  emoji: string;
}

/** Działy w pasku bocznym; liczniki tylko przy tym, co wymaga uwagi (Skrzynka, zaległe przypomnienia, Kosz). */
export function sidebarItems(counts: { inbox: number; overdue: number; trash: number }): SidebarItem[] {
  return [
    { icon: StickyNote, label: "Notatki", view: "notes", emoji: "📝" },
    { icon: Inbox, label: "Skrzynka", view: "inbox", count: counts.inbox, emoji: "📥" },
    { icon: Calendar, label: "Dziś", view: "today", emoji: "📅" },
    { icon: Bell, label: "Przypomnienia", view: "reminders", count: counts.overdue, alert: true, emoji: "🔔" },
    { icon: CalendarRange, label: "Kalendarz", view: "calendar", emoji: "🗓️" },
    { icon: BriefcaseBusiness, label: "Grafik", view: "shifts", emoji: "🗂️" },
    { icon: HardHat, label: "Praca", view: "study", emoji: "👷" },
    { icon: HandCoins, label: "Długi", view: "debts", emoji: "🤝" },
    { icon: Dumbbell, label: "Ćwiczenia", view: "cwiczenia", emoji: "💪" },
    { icon: Archive, label: "Archiwum", view: "archive", emoji: "📦" },
    { icon: Trash, label: "Kosz", view: "trash", count: counts.trash, emoji: "🗑️" },
  ];
}
