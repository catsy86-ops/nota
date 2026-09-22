import type { Note } from "@/hooks/useNotes";

export function getTodayRange(): { start: number; end: number } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime() };
}

export function getWeekRange(): { start: number; end: number } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { start: start.getTime(), end: end.getTime() };
}

function inRange(note: Pick<Note, "createdAt" | "updatedAt">, start: number, end: number): boolean {
  return (note.createdAt >= start && note.createdAt <= end) || (note.updatedAt >= start && note.updatedAt <= end);
}

export function isToday(note: Pick<Note, "createdAt" | "updatedAt">): boolean {
  const { start, end } = getTodayRange();
  return inRange(note, start, end);
}

export function isThisWeek(note: Pick<Note, "createdAt" | "updatedAt">): boolean {
  const { start, end } = getWeekRange();
  return inRange(note, start, end);
}
