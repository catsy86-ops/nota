import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import { ChevronRight, Palette, Smile, FolderPlus, Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Folder, FolderColor } from "@/hooks/useNotes";
import { folderColorDot } from "@/components/FolderPicker";

const FOLDER_COLORS: { value: FolderColor; label: string }[] = [
  { value: "default", label: "Domyślny" },
  { value: "coral", label: "Koral" },
  { value: "peach", label: "Brzoskwinia" },
  { value: "sand", label: "Piasek" },
  { value: "mint", label: "Mięta" },
  { value: "sage", label: "Szałwia" },
  { value: "sky", label: "Niebo" },
  { value: "lavender", label: "Lawenda" },
  { value: "rose", label: "Róża" },
];

const FOLDER_EMOJIS = ["📁", "📂", "📝", "📌", "⭐", "💡", "🎯", "🔥", "💼", "🏠", "🎓", "🎨", "🎵", "📷", "✈️", "🍕", "🌱", "💰", "❤️", "🚀", "📚", "🛒", "💻", "🧪", "🏋️", "🎮", "🐾", "🌍"];

export function SidebarFolderItem({ folder, folders, isActive, activeFolderId, view, onSelect, onRename, onDelete, onSetColor, onSetEmoji, onAddSubfolder }: {
  folder: Folder; folders: Folder[]; isActive: boolean; activeFolderId: string | null; view: string;
  onSelect: (id: string) => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void;
  onSetColor: (id: string, color: FolderColor) => void; onSetEmoji: (id: string, emoji: string | null) => void; onAddSubfolder: (parentId: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [expanded, setExpanded] = useState(true);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [subName, setSubName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const subInputRef = useRef<HTMLInputElement>(null);
  const children = folders.filter((f) => f.parentId === folder.id);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);
  useEffect(() => { if (addingSub && subInputRef.current) subInputRef.current.focus(); }, [addingSub]);

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `folder-drop-${folder.id}` });

  function save() {
    if (name.trim() && name.trim() !== folder.name) onRename(folder.id, name.trim());
    setEditing(false);
  }

  function submitSub() {
    if (subName.trim()) { onAddSubfolder(folder.id, subName.trim()); setSubName(""); setAddingSub(false); }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setName(folder.name); setEditing(false); } }}
          className="flex-1 text-sm bg-muted/60 border border-border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary/30 text-foreground min-w-0" />
        <motion.button whileTap={{ scale: 0.9 }} onClick={save} aria-label="Zapisz nazwę folderu" className="p-1 rounded-lg text-primary hover:bg-primary/10"><Check className="w-3.5 h-3.5" /></motion.button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setName(folder.name); setEditing(false); }} aria-label="Anuluj edycję folderu" className="p-1 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-3.5 h-3.5" /></motion.button>
      </div>
    );
  }

  return (
    <div ref={setDropRef} data-folder-drop={folder.id}>
      <motion.div
        whileHover={{ x: 3 }}
        className={cn(
          "group flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all duration-200 cursor-pointer",
          isActive ? "bg-primary/10 text-primary shadow-sm border border-primary/10" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
          isOver && "bg-primary/20 ring-2 ring-primary/40 scale-[1.02]"
        )}
        onClick={() => onSelect(folder.id)}
        role="button"
        aria-current={isActive ? "page" : undefined}
      >
        {children.length > 0 ? (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            aria-label={expanded ? "Zwiń podfoldery" : "Rozwiń podfoldery"}
            aria-expanded={expanded}
            className="p-0.5"
          >
            <ChevronRight className={cn("w-3 h-3 transition-transform", expanded && "rotate-90")} />
          </motion.button>
        ) : (
          <span className="w-4" />
        )}
        {folder.emoji ? (
          <span className="text-sm shrink-0">{folder.emoji}</span>
        ) : (
          <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", folderColorDot[folder.color] || folderColorDot.default)} />
        )}
        <span className="flex-1 text-left truncate">{folder.name}</span>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
          <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); setShowEmojiPicker(false); }} aria-label="Zmień kolor folderu" className="p-1 rounded-lg hover:bg-foreground/10"><Palette className="w-3 h-3" /></motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); setShowColorPicker(false); }} aria-label="Zmień emoji folderu" className="p-1 rounded-lg hover:bg-foreground/10"><Smile className="w-3 h-3" /></motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); setAddingSub(true); }} aria-label="Dodaj podfolder" className="p-1 rounded-lg hover:bg-foreground/10"><FolderPlus className="w-3 h-3" /></motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); setEditing(true); }} aria-label={`Zmień nazwę folderu ${folder.name}`} className="p-1 rounded-lg hover:bg-foreground/10"><Pencil className="w-3 h-3" /></motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); onDelete(folder.id); }} aria-label={`Usuń folder ${folder.name}`} className="p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive"><Trash2 className="w-3 h-3" /></motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showColorPicker && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="px-6 py-1.5">
            <div className="flex flex-wrap gap-1.5">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={(e) => { e.stopPropagation(); onSetColor(folder.id, c.value); setShowColorPicker(false); }}
                  className={cn("w-5 h-5 rounded-full border-2 transition-all", folderColorDot[c.value], folder.color === c.value ? "border-primary scale-110" : "border-transparent hover:scale-110")}
                  title={c.label}
                  aria-label={`Ustaw kolor: ${c.label}`}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="px-6 py-1.5">
            <div className="flex flex-wrap gap-1">
              {folder.emoji && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSetEmoji(folder.id, null); setShowEmojiPicker(false); }}
                  className="w-6 h-6 rounded text-xs flex items-center justify-center border border-dashed border-muted-foreground/30 hover:bg-muted/80 text-muted-foreground"
                  title="Usuń emoji"
                  aria-label="Usuń emoji folderu"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              {FOLDER_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={(e) => { e.stopPropagation(); onSetEmoji(folder.id, emoji); setShowEmojiPicker(false); }}
                  className={cn("w-6 h-6 rounded text-sm flex items-center justify-center hover:bg-muted/80 transition-all", folder.emoji === emoji ? "bg-primary/10 ring-1 ring-primary scale-110" : "hover:scale-110")}
                  aria-label={`Ustaw emoji: ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {addingSub && (
        <div className="flex items-center gap-1 px-6 py-1">
          <input ref={subInputRef} value={subName} onChange={(e) => setSubName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitSub(); if (e.key === "Escape") { setSubName(""); setAddingSub(false); } }}
            className="flex-1 text-xs bg-muted/60 border border-border rounded-lg px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary/30 text-foreground min-w-0" placeholder="Subfolder..." />
          <motion.button whileTap={{ scale: 0.9 }} onClick={submitSub} aria-label="Dodaj podfolder" className="p-0.5 rounded text-primary hover:bg-primary/10"><Check className="w-3 h-3" /></motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setSubName(""); setAddingSub(false); }} aria-label="Anuluj dodawanie podfolderu" className="p-0.5 rounded text-muted-foreground hover:bg-muted"><X className="w-3 h-3" /></motion.button>
        </div>
      )}

      {expanded && children.length > 0 && (
        <div className="pl-4">
          {children.map((child) => (
            <SidebarFolderItem
              key={child.id}
              folder={child}
              folders={folders}
              isActive={view === "folder" && activeFolderId === child.id}
              activeFolderId={activeFolderId}
              view={view}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onSetColor={onSetColor}
              onSetEmoji={onSetEmoji}
              onAddSubfolder={onAddSubfolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
