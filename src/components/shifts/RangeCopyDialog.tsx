import { useState } from "react";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RangeCopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dzień, od którego startuje zakres — domyślnie początek oglądanego tygodnia. */
  defaultFrom: string;
  onCopy: (from: string, to: string, target: string) => void;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Kopiuje zakres dni (od–do) na nowy początek; odstępy między dniami zostają. */
export function RangeCopyDialog({ open, onOpenChange, defaultFrom, onCopy }: RangeCopyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-md">
        {open && <RangeCopyForm defaultFrom={defaultFrom} onDone={() => onOpenChange(false)} onCopy={onCopy} />}
      </ResponsiveDialogContent>
    </Dialog>
  );
}

function RangeCopyForm({ defaultFrom, onDone, onCopy }: { defaultFrom: string; onDone: () => void; onCopy: RangeCopyDialogProps["onCopy"] }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultFrom);
  const [target, setTarget] = useState(defaultFrom);
  const valid = DATE.test(from) && DATE.test(to) && DATE.test(target) && to >= from;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display">Kopiuj zakres dni</DialogTitle>
        <DialogDescription>Zakres od–do przeniesie się na nowy początek. Odstępy między dniami zostają.</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!valid) return; onCopy(from, to, target); onDone(); }}>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="range-from">Od dnia</Label>
            <Input id="range-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="min-w-0" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="range-to">Do dnia</Label>
            <Input id="range-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="min-w-0" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="range-target">Kopia zaczyna się</Label>
          <Input id="range-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} className="min-w-0" />
        </div>
        {to < from && <p className="text-xs text-destructive-ink">Dzień „do” nie może być przed „od”.</p>}
        <ResponsiveDialogFooter>
          <Button type="submit" disabled={!valid}>Skopiuj zakres</Button>
        </ResponsiveDialogFooter>
      </form>
    </>
  );
}
