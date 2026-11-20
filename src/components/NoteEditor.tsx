import { Bell, Eye, EyeOff, Expand, ListChecks, Minimize2, Scissors, Type, X } from "lucide-react";
import type { Note } from "@/hooks/useNotes";
import type { NoteEditSession } from "@/hooks/useNoteEditSession";
import { cn } from "@/lib/utils";
import { useFeatureFlags } from "@/lib/featureFlags";
import { TitleField } from "./TitleField";
import { MarkdownRenderer, FormatToolbar } from "./MarkdownRenderer";
import { AttachmentsPanel } from "./AttachmentsPanel";
import { ChecklistConvertButtons, ChecklistEditor } from "./ChecklistEditor";
import { EditorStats } from "./EditorStats";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { findDateInText } from "@/lib/dateInText";
import { formatReminderShort } from "@/lib/reminderTime";
import { toastWithUndo } from "@/lib/undoToast";

/** Pasek „Znajdź i zamień” (Ctrl+F/H) ładowany przy pierwszym użyciu. */
const FindReplaceBar = lazy(() => import("./FindReplaceBar").then((m) => ({ default: m.FindReplaceBar })));

/** Edytor CodeMirror 6 (krok 1a, za flagą `cmEditor`) — ładowany dopiero po włączeniu flagi. */
const CmEditor = lazy(() => import("./editor/CmEditor").then((m) => ({ default: m.CmEditor })));

/**
 * Edytor notatki: tytuł, pasek narzędzi, treść (z podglądem), lista zadań, załączniki
 * i „Zapisz”. Ten sam komponent w kaflu (`full={false}`) i w oknie pełnoekranowym
 * (`full`). Stan siedzi w `useNoteEditSession`, który dostaje przez `session`.
 */
export function NoteEditor({
  full,
  note,
  session,
  spellcheck,
  editorScrolled,
  knownTitles,
  onWikiClick,
  onUpdate,
  onPaste,
  onFileDragOver,
  onFileDrop,
}: {
  full: boolean;
  note: Note;
  session: NoteEditSession;
  spellcheck: boolean;
  /** Przewinięto treść okna — nagłówek dostaje cień. */
  editorScrolled: boolean;
  knownTitles: Set<string> | undefined;
  onWikiClick: ((title: string) => void) | undefined;
  onUpdate: ((id: string, updates: Partial<Omit<Note, "id" | "createdAt">>) => void) | undefined;
  onPaste: (e: React.ClipboardEvent<Element>) => void;
  /** Pliki przeciągnięte na edytor (plan 2.6) — przechwytywane, zanim dojdą do pola tekstu. */
  onFileDragOver?: (e: React.DragEvent<Element>) => void;
  onFileDrop?: (e: React.DragEvent<Element>) => void;
}) {
  const {
    editTitle, setEditTitle,
    editContent, setEditContent, writeContent, collabText,
    editChecklist, setEditChecklist,
    showChecklist, setShowChecklist,
    showPreview, setShowPreview,
    setFullEditor,
    findOpen, setFindOpen,
    textareaRef,
    wiki,
    slash,
    handleEditSelect,
    handleEditKeyDown,
    handleFormatInsert,
    handleExtractSelection,
    commitDraft,
    handleSave,
  } = session;

  // Pełny ekran z listą: lista zaraz pod treścią i to ona wypełnia okno —
  // inaczej pusta treść zajmowała ekran, a pozycje lądowały na dole.
  const [phoneTab, setPhoneTab] = useState<"edit" | "preview">("edit");
  // Terminy 3.4: pierwszy termin z treści (np. „w piątek o 10”); ukrycie dotyczy tej jednej frazy.
  const dateHint = useMemo(() => (note.reminder === null ? findDateInText(editContent) : null), [editContent, note.reminder]);
  const [dismissedHint, setDismissedHint] = useState<string | null>(null);
  const contentFills = full && !showChecklist;
  const textareaCls = full
    ? cn("w-full bg-transparent text-base leading-relaxed text-foreground/90 outline-hidden resize-none", contentFills && "h-full")
    : "w-full bg-transparent text-sm text-foreground/80 outline-hidden resize-none";
  // Pole treści: zwykłe `textarea` albo CodeMirror za flagą `cmEditor` (plan rozbudowy, Faza 1a).
  // Oba dostają to samo `textareaRef` (`TextControl`) i te same zdarzenia, więc reszta edytora nie zależy od silnika.
  const cmOn = useFeatureFlags().cmEditor;
  // Enter w tytule zanim CM zamontuje się (chunk ładuje się leniwie): fokus wejdzie przy montażu.
  const [bodyFocusPending, setBodyFocusPending] = useState(false);
  // Chunk CM ładujemy od razu przy otwarciu edytora, a nie dopiero przy pierwszym renderze pola —
  // inaczej szybki Enter w tytule trafia przed montażem i fokus nie wchodzi do treści.
  useEffect(() => { if (cmOn) void import("./editor/CmEditor"); }, [cmOn]);
  function renderEditor(cls: string) {
    if (cmOn) {
      return (
        <Suspense fallback={<div className={cn(cls, "min-h-15")} aria-busy="true" />}>
          <CmEditor
            key={collabText ? `${note.id}:collab` : `${note.id}:plain`}
            value={editContent}
            onChange={setEditContent}
            onSelect={handleEditSelect}
            onKeyDown={handleEditKeyDown}
            onPaste={onPaste}
            textControlRef={textareaRef}
            autoFocus={bodyFocusPending}
            yText={collabText ?? undefined}
            spellcheck={spellcheck}
            placeholder="Treść notatki..."
            ariaLabel="Treść notatki"
            className={cls}
          />
        </Suspense>
      );
    }
    return (
      <textarea
        spellCheck={spellcheck}
        ref={(el) => { textareaRef.current = el; }}
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        {...wiki.textareaProps}
        onSelect={handleEditSelect}
        onKeyDown={handleEditKeyDown}
        onPaste={onPaste}
        className={cls}
        placeholder="Treść notatki..."
      />
    );
  }

  return (
    <div
      className={full ? "flex flex-col gap-3 h-full min-h-0" : "space-y-2"}
      onClick={(e) => e.stopPropagation()}
      onDragOverCapture={note.locked ? undefined : onFileDragOver}
      onDropCapture={note.locked ? undefined : onFileDrop}
      // Wyjście fokusem poza edytor zapisuje, ale go nie zamyka —
      // zamknięcie przy kliknięciu w paletę kolorów byłoby zaskoczeniem.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commitDraft();
      }}
    >
      {/* Pełny ekran: tytuł i pasek narzędzi jako nagłówek — cień dopiero po przewinięciu treści. */}
      <div
        data-editor-header={full ? "" : undefined}
        data-scrolled={full && editorScrolled ? "" : undefined}
        className={full ? cn(
          "sticky top-0 z-raised -mx-4 -mt-1 space-y-2 bg-background px-4 pt-1 pb-2 transition-shadow duration-fast sm:-mx-6 sm:px-6",
          editorScrolled && "shadow-elevation-1",
        ) : "space-y-2"}
      >
      {/* W oknie `pr-*` zostawia miejsce na ✕ w prawym górnym rogu. */}
      <TitleField spellCheck={spellcheck} autoFocus value={editTitle} onChange={setEditTitle} onEnter={() => { if (textareaRef.current) textareaRef.current.focus(); else setBodyFocusPending(true); }} className={cn("w-full bg-transparent font-display font-semibold text-foreground outline-hidden", full && "text-2xl pr-8 coarse:pr-12")} placeholder="Tytuł" />
      {findOpen && <Suspense fallback={null}><FindReplaceBar value={editContent} onChange={writeContent} textareaRef={textareaRef} onClose={() => setFindOpen(false)} /></Suspense>}
      <div className="flex items-center gap-1">
        <FormatToolbar onInsert={handleFormatInsert} nowrap={!full} />
        <IconButton
          size="sm"
          onClick={handleExtractSelection}
          title="Wyodrębnij zaznaczenie do nowej notatki"
          aria-label="Wyodrębnij zaznaczenie do nowej notatki"
        >
          <Scissors className="size-3.5" />
        </IconButton>
        <IconButton
          size="sm"
          tone={showPreview ? "active" : "muted"}
          onClick={() => setShowPreview(!showPreview)}
          className="ml-auto"
          title={showPreview ? "Ukryj podgląd" : "Podgląd Markdown"}
          aria-label={showPreview ? "Ukryj podgląd" : "Podgląd Markdown"}
        >
          {showPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </IconButton>
        <IconButton
          size="sm"
          onClick={() => setFullEditor(!full)}
          // Na telefonie edycja jest zawsze pełnoekranowa — powrót do wąskiego kafla nie ma sensu.
          className="max-sm:hidden"
          title={full ? "Wróć do kafla" : "Pełny ekran"}
          aria-label={full ? "Wróć do kafla" : "Pełny ekran"}
        >
          {full ? <Minimize2 className="size-3.5" /> : <Expand className="size-3.5" />}
        </IconButton>
      </div>
      </div>

      {/* `relative`: tu kotwiczy się lista podpowiedzi `[[` (pozycja karetki). */}
      <div className={cn("relative", contentFills && "flex-1 min-h-0")}>
        {showPreview ? (
          <>
            {/* A3 (plan mobile 1.1): na telefonie Edycja i Podgląd to zakładki, obok siebie dopiero od sm. */}
            <div role="tablist" aria-label="Edycja i podgląd" className="mb-2 flex gap-1 sm:hidden">
              {(["edit", "preview"] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant="outline"
                  size="sm"
                  role="tab"
                  aria-selected={phoneTab === t}
                  onClick={() => setPhoneTab(t)}
                  className={cn("h-8 flex-1 text-xs font-normal coarse:h-11", phoneTab === t ? "border-primary/60 bg-primary/10 text-primary-ink" : "text-muted-foreground")}
                >
                  {t === "edit" ? "Edycja" : "Podgląd"}
                </Button>
              ))}
            </div>
            <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2", contentFills && "h-full")}>
              <div className={cn("min-w-0", phoneTab === "preview" && "max-sm:hidden", contentFills && "h-full")}>
                {renderEditor(cn(textareaCls, "border border-border/30 rounded-field p-2", !contentFills && "min-h-20"))}
              </div>
              <div className={cn("bg-muted/20 rounded-field p-2 overflow-y-auto border border-border/30", contentFills ? "h-full" : "min-h-20", phoneTab === "edit" && "max-sm:hidden")}>
                {editContent ? <MarkdownRenderer content={editContent} knownTitles={knownTitles} onWikiClick={onWikiClick} /> : <p className="ui-hint italic">Podgląd…</p>}
              </div>
            </div>
          </>
        ) : (
          renderEditor(cn(textareaCls, !full && "min-h-15"))
        )}
        {wiki.popup()}{slash.popup()}
      </div>

      {/* Checklist toggle + konwersja tekst ↔ lista */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowChecklist(!showChecklist)}
          className={cn("-ml-2 h-7 gap-1.5 px-2 text-xs font-normal coarse:h-11 [&_svg]:size-3.5", showChecklist ? "text-primary-ink hover:text-primary-ink" : "text-muted-foreground")}
        >
          <ListChecks />
          {showChecklist ? "Lista zadań" : "Dodaj listę"}
        </Button>
        <ChecklistConvertButtons
          content={editContent}
          checklist={editChecklist}
          onConvert={(r, toList) => { if (writeContent(r.content)) { setEditChecklist(r.checklist); setShowChecklist(toList); } }}
        />
      </div>

      {showChecklist && (
        <div className={full ? "flex-1 min-h-0 overflow-y-auto" : undefined}>
          <ChecklistEditor items={editChecklist} onChange={setEditChecklist} />
        </div>
      )}

      {/* Terminy 3.4: data w treści jako podpowiedź — nic nie ustawia się samo. */}
      {!note.locked && !note.trashed && note.reminder === null && onUpdate && dateHint && dismissedHint !== dateHint.phrase && (
        <div data-testid="date-hint" className="flex flex-wrap items-center gap-2 rounded-control border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
          <Bell className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            W treści jest termin: „{dateHint.phrase}” — <span className="font-mono tabular-nums text-foreground">{formatReminderShort(dateHint.date.getTime())}</span>
          </span>
          <Button type="button" size="sm" variant="outline" className="h-7 coarse:h-11"
            onClick={() => {
              const at = dateHint.date.getTime();
              onUpdate(note.id, { reminder: at });
              toastWithUndo(`Ustawiono przypomnienie: ${formatReminderShort(at)}`, () => onUpdate(note.id, { reminder: null }));
            }}>
            Ustaw przypomnienie
          </Button>
          <IconButton size="sm" onClick={() => setDismissedHint(dateHint.phrase)} aria-label="Ukryj podpowiedź terminu">
            <X className="size-3.5" aria-hidden />
          </IconButton>
        </div>
      )}

      {!note.locked && <AttachmentsPanel attachments={note.attachments ?? []} onChange={(attachments) => onUpdate?.(note.id, { attachments })} showAddButton />}

      <div className="flex items-center justify-between">
        <span className="text-2xs text-muted-foreground flex items-center gap-1 whitespace-nowrap min-w-0 truncate">
          <Type className="size-3.5 shrink-0" />
          <EditorStats textareaRef={textareaRef} value={editContent} />
        </span>
        <Button variant="ghost" size="sm" onClick={handleSave} className="h-8 text-primary-ink hover:bg-primary/10 hover:text-primary-ink coarse:h-11">Zapisz</Button>
      </div>
    </div>
  );
}
