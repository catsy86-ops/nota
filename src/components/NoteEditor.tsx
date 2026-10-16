import { Eye, EyeOff, Expand, ListChecks, Minimize2, Type } from "lucide-react";
import type { Note } from "@/hooks/useNotes";
import type { NoteEditSession } from "@/hooks/useNoteEditSession";
import { cn } from "@/lib/utils";
import { TitleField } from "./TitleField";
import { MarkdownRenderer, FormatToolbar } from "./MarkdownRenderer";
import { AttachmentsPanel } from "./AttachmentsPanel";
import { ChecklistConvertButtons, ChecklistEditor } from "./ChecklistEditor";
import { EditorStats } from "./EditorStats";
import { FindReplaceBar } from "./FindReplaceBar";

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
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}) {
  const {
    editTitle, setEditTitle,
    editContent, setEditContent,
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
    commitDraft,
    handleSave,
  } = session;

  // Pełny ekran z listą: lista zaraz pod treścią i to ona wypełnia okno —
  // inaczej pusta treść zajmowała ekran, a pozycje lądowały na dole.
  const contentFills = full && !showChecklist;
  const textareaCls = full
    ? cn("w-full bg-transparent text-base leading-relaxed text-foreground/90 outline-hidden resize-none", contentFills && "h-full")
    : "w-full bg-transparent text-sm text-foreground/80 outline-hidden resize-none";
  return (
    <div
      className={full ? "flex flex-col gap-3 h-full min-h-0" : "space-y-2"}
      onClick={(e) => e.stopPropagation()}
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
          "sticky top-0 z-10 -mx-4 -mt-1 space-y-2 bg-background px-4 pt-1 pb-2 transition-shadow duration-fast sm:-mx-6 sm:px-6",
          editorScrolled && "shadow-elevation-1",
        ) : "space-y-2"}
      >
      {/* W oknie `pr-*` zostawia miejsce na ✕ w prawym górnym rogu. */}
      <TitleField spellCheck={spellcheck} autoFocus value={editTitle} onChange={setEditTitle} onEnter={() => textareaRef.current?.focus()} className={cn("w-full bg-transparent font-display font-semibold text-foreground outline-hidden", full && "text-2xl pr-8 coarse:pr-12")} placeholder="Tytuł" />
      {findOpen && <FindReplaceBar value={editContent} onChange={setEditContent} textareaRef={textareaRef} onClose={() => setFindOpen(false)} />}
      <div className="flex items-center gap-1">
        <FormatToolbar onInsert={handleFormatInsert} nowrap={!full} />
        <button
          onClick={() => setShowPreview(!showPreview)}
          className={cn("p-1 rounded text-2xs transition-colors ml-auto", showPreview ? "text-primary-ink bg-primary/10" : "text-muted-foreground hover:text-foreground")}
          title={showPreview ? "Ukryj podgląd" : "Podgląd Markdown"}
          aria-label={showPreview ? "Ukryj podgląd" : "Podgląd Markdown"}
        >
          {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => setFullEditor(!full)}
          // Na telefonie edycja jest zawsze pełnoekranowa — powrót do wąskiego kafla nie ma sensu.
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors max-sm:hidden"
          title={full ? "Wróć do kafla" : "Pełny ekran"}
          aria-label={full ? "Wróć do kafla" : "Pełny ekran"}
        >
          {full ? <Minimize2 className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
        </button>
      </div>
      </div>

      {/* `relative`: tu kotwiczy się lista podpowiedzi `[[` (pozycja karetki). */}
      <div className={cn("relative", contentFills && "flex-1 min-h-0")}>
        {showPreview ? (
          <div className={cn("grid grid-cols-2 gap-2", contentFills && "h-full")}>
            <textarea spellCheck={spellcheck} ref={textareaRef} value={editContent} onChange={(e) => setEditContent(e.target.value)} {...wiki.textareaProps} onSelect={handleEditSelect} onKeyDown={handleEditKeyDown} onPaste={onPaste} className={cn(textareaCls, "border border-border/30 rounded-lg p-2", !contentFills && "min-h-[80px]")} placeholder="Treść notatki..." />
            <div className={cn("bg-muted/20 rounded-lg p-2 overflow-y-auto border border-border/30", contentFills ? "h-full" : "min-h-[80px]")}>
              {editContent ? <MarkdownRenderer content={editContent} knownTitles={knownTitles} onWikiClick={onWikiClick} /> : <p className="text-xs text-muted-foreground italic">Podgląd...</p>}
            </div>
          </div>
        ) : (
          <textarea spellCheck={spellcheck} ref={textareaRef} value={editContent} onChange={(e) => setEditContent(e.target.value)} {...wiki.textareaProps} onSelect={handleEditSelect} onKeyDown={handleEditKeyDown} onPaste={onPaste} className={cn(textareaCls, !full && "min-h-[60px]")} placeholder="Treść notatki..." />
        )}
        {wiki.popup()}{slash.popup()}
      </div>

      {/* Checklist toggle + konwersja tekst ↔ lista */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          onClick={() => setShowChecklist(!showChecklist)}
          className={cn("flex items-center gap-1.5 text-xs transition-colors", showChecklist ? "text-primary-ink" : "text-muted-foreground hover:text-foreground")}
        >
          <ListChecks className="w-3.5 h-3.5" />
          {showChecklist ? "Lista zadań" : "Dodaj listę"}
        </button>
        <ChecklistConvertButtons
          content={editContent}
          checklist={editChecklist}
          onConvert={(r, toList) => { setEditContent(r.content); setEditChecklist(r.checklist); setShowChecklist(toList); }}
        />
      </div>

      {showChecklist && (
        <div className={full ? "flex-1 min-h-0 overflow-y-auto" : undefined}>
          <ChecklistEditor items={editChecklist} onChange={setEditChecklist} />
        </div>
      )}

      {!note.locked && <AttachmentsPanel attachments={note.attachments ?? []} onChange={(attachments) => onUpdate?.(note.id, { attachments })} showAddButton />}

      <div className="flex items-center justify-between">
        <span className="text-2xs text-muted-foreground flex items-center gap-1 whitespace-nowrap min-w-0 truncate">
          <Type className="w-3 h-3 shrink-0" />
          <EditorStats textareaRef={textareaRef} value={editContent} />
        </span>
        <button onClick={handleSave} className="text-sm font-medium text-primary-ink hover:bg-primary/10 px-3 py-1 rounded-lg transition-colors">Zapisz</button>
      </div>
    </div>
  );
}
