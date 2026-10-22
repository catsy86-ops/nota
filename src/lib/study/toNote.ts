import type { Note } from "@/hooks/useNotes";
import { CHECKLIST, MODULES, QUESTIONS, TOPICS, type StudyTopic } from "./content";
import { reportBody, type JournalReport } from "./report";

/** Stałe id notatki tematu: ten sam temat to ta sam notatka na każdym urządzeniu, więc nie powstają duplikaty. */
export const topicNoteId = (topicId: string) => `study-topic-${topicId}`;

/** Treść notatki z tematu: streszczenie, punkty jako lista kontrolna i skutki pominięcia. */
export function topicToNote(topic: StudyTopic, now: number = Date.now(), id: string = topicNoteId(topic.id)): Note {
  const items = CHECKLIST.filter((c) => c.topic === topic.id);
  const risks = items.filter((c) => c.risk).map((c) => `- ${c.risk}`);
  const moduleLabel = MODULES.find((m) => m.id === topic.module)?.label ?? "";
  const lines = [topic.summary, ""];
  if (risks.length) lines.push("## Na co uważać", ...risks, "");
  lines.push(`_${moduleLabel} · materiały G-HEAT_`);
  return {
    id,
    title: `Nauka: ${topic.title}`,
    content: lines.join("\n"),
    color: "default",
    pinned: false, archived: false, trashed: false, trashedAt: null,
    labels: ["nauka"],
    reminder: null, priority: "none", images: [],
    checklist: items.map((c, i) => ({ id: `${id}-${i}`, text: `${c.critical ? "⚠ " : ""}${c.text}`, checked: false })),
    folderId: null, order: 0, createdAt: now, updatedAt: now,
  };
}

export const topicQuestionCount = (topicId: string) => QUESTIONS.filter((q) => q.topic === topicId).length;
export const topicById = (id: string) => TOPICS.find((t) => t.id === id);

/** Raport z budowy jako notatka z etykietą „budowa” — te same klucze zdjęć, bez kopiowania bajtów. */
export function reportToNote(report: JournalReport, now: number = Date.now(), id: string = crypto.randomUUID()): Note {
  return {
    id,
    title: report.title,
    content: reportBody(report),
    color: "default",
    pinned: false, archived: false, trashed: false, trashedAt: null,
    labels: ["budowa"],
    reminder: null, priority: "none", images: [...new Set(report.images)],
    checklist: [],
    folderId: null, order: 0, createdAt: now, updatedAt: now,
  };
}
