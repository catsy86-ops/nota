import type { ElementType } from "react";
import { StickyNote, Archive, Bell, Trash, Calendar, CalendarRange, BriefcaseBusiness, HardHat, HandCoins, Inbox, Dumbbell } from "lucide-react";
import type { View } from "@/hooks/useFilteredNotes";
import { viewLabel } from "@/lib/viewMeta";

/** Grupy paska bocznego (PW-4, plan Powłoki 2.1). `archiwum` to dół paska bez nagłówka. */
export type SidebarGroupKey = "codziennie" | "praca" | "osobiste" | "archiwum";

export interface SidebarItem {
  icon: ElementType;
  label: string;
  view: View;
  group: SidebarGroupKey;
  count?: number;
  /** Licznik oznacza coś pilnego (np. zaległe przypomnienia). */
  alert?: boolean;
}

export const SIDEBAR_GROUP_LABELS: Record<SidebarGroupKey, string> = {
  codziennie: "Codziennie",
  praca: "Praca",
  osobiste: "Osobiste",
  archiwum: "",
};

/** Działy w pasku bocznym; liczniki tylko przy tym, co wymaga uwagi (Skrzynka, zaległe przypomnienia, Kosz). */
export function sidebarItems(counts: { inbox: number; overdue: number; trash: number }): SidebarItem[] {
  return [
    { icon: StickyNote, label: viewLabel("notes"), view: "notes", group: "codziennie" },
    { icon: Inbox, label: viewLabel("inbox"), view: "inbox", group: "codziennie", count: counts.inbox },
    { icon: Calendar, label: viewLabel("today"), view: "today", group: "codziennie" },
    { icon: Bell, label: viewLabel("reminders"), view: "reminders", group: "codziennie", count: counts.overdue, alert: true },
    { icon: CalendarRange, label: viewLabel("calendar"), view: "calendar", group: "codziennie" },
    { icon: BriefcaseBusiness, label: viewLabel("shifts"), view: "shifts", group: "praca" },
    { icon: HardHat, label: viewLabel("study"), view: "study", group: "praca" },
    { icon: HandCoins, label: viewLabel("debts"), view: "debts", group: "osobiste" },
    { icon: Dumbbell, label: viewLabel("cwiczenia"), view: "cwiczenia", group: "osobiste" },
    { icon: Archive, label: viewLabel("archive"), view: "archive", group: "archiwum" },
    { icon: Trash, label: viewLabel("trash"), view: "trash", group: "archiwum", count: counts.trash },
  ];
}

/** Pozycje w kolejności grup; pusta grupa znika. */
export function groupSidebarItems(items: SidebarItem[]): { key: SidebarGroupKey; label: string; items: SidebarItem[] }[] {
  const order: SidebarGroupKey[] = ["codziennie", "praca", "osobiste", "archiwum"];
  return order
    .map((key) => ({ key, label: SIDEBAR_GROUP_LABELS[key], items: items.filter((i) => i.group === key) }))
    .filter((g) => g.items.length > 0);
}
