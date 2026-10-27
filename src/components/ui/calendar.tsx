import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { pl } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// Polski domyślnie: nazwy miesięcy i dni oraz tydzień od poniedziałku (było „October”, „Su Mo Tu”).
function Calendar({ className, classNames, showOutsideDays = true, locale = pl, ...props }: CalendarProps) {
  const d = getDefaultClassNames();
  return (
    <DayPicker
      locale={locale}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: cn("w-fit", d.root),
        months: cn("relative flex flex-col gap-4 sm:flex-row", d.months),
        month: cn("flex flex-col gap-4", d.month),
        month_caption: cn("flex h-9 items-center justify-center px-10 coarse:h-11", d.month_caption),
        caption_label: cn("text-sm font-medium first-letter:uppercase", d.caption_label),
        nav: cn("absolute inset-x-0 top-0 flex items-center justify-between", d.nav),
        // Strzałki widoczne i duże na dotyku: w słońcu 50% krycia ginęło.
        button_previous: cn(buttonVariants({ variant: "outline" }), "h-9 w-9 bg-transparent p-0 opacity-70 hover:opacity-100 coarse:h-11 coarse:w-11", d.button_previous),
        button_next: cn(buttonVariants({ variant: "outline" }), "h-9 w-9 bg-transparent p-0 opacity-70 hover:opacity-100 coarse:h-11 coarse:w-11", d.button_next),
        month_grid: cn("w-full border-collapse", d.month_grid),
        weekdays: cn("flex", d.weekdays),
        weekday: cn("w-9 rounded-control text-[0.8rem] font-normal text-muted-foreground", d.weekday),
        week: cn("mt-2 flex w-full", d.week),
        day: cn(
          "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-sticky",
          "has-aria-[selected]:bg-muted first:has-aria-[selected]:rounded-l-md last:has-aria-[selected]:rounded-r-md",
          d.day,
        ),
        day_button: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground [&>button:focus]:bg-primary [&>button:focus]:text-primary-foreground",
        today: "[&>button]:bg-muted [&>button]:text-foreground",
        outside: "text-muted-foreground opacity-50 aria-selected:bg-muted/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-50",
        range_middle: "aria-selected:bg-muted aria-selected:text-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: c }) =>
          orientation === "left" ? <ChevronLeft className={cn("h-4 w-4", c)} /> : <ChevronRight className={cn("h-4 w-4", c)} />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
