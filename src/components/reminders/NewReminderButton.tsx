import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReminderQuickAddDialog } from "@/components/calendar/ReminderQuickAddDialog";
import type { Note } from "@/hooks/useNotes";
import type { RepeatInput } from "@/lib/reminderRepeat";

interface NewReminderButtonProps {
  notes: Note[];
  onCreateNote: (title: string, reminder: number, repeat: RepeatInput, allDay: boolean, until?: number) => void;
  onAttachReminder: (noteId: string, reminder: number, repeat: RepeatInput, allDay: boolean, base: number | undefined, until?: number) => void;
}

/**
 * „Nowy termin” w nagłówku Terminów. Dialog ten sam co w Kalendarzu (pole tekstowe,
 * dzień, godzina, powtarzanie), ale otwiera się od razu bez wybranej komórki —
 * startuje od dzisiaj, a dzień zmienia się w polu „Dzień”.
 */
export default function NewReminderButton({ notes, onCreateNote, onAttachReminder }: NewReminderButtonProps) {
  const [open, setOpen] = useState(false);
  // Dzień liczony przy każdym otwarciu, żeby po północy nie zostawał wczorajszy.
  const [day, setDay] = useState(() => new Date());

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => { setDay(new Date()); setOpen(true); }}
        className="coarse:min-h-11"
      >
        <Plus className="w-3.5 h-3.5 mr-1" aria-hidden />
        Nowy termin
      </Button>
      {open && (
        <ReminderQuickAddDialog
          open
          onOpenChange={setOpen}
          day={day}
          edit={null}
          notes={notes}
          onCreateNote={onCreateNote}
          onAttachReminder={onAttachReminder}
        />
      )}
    </>
  );
}
