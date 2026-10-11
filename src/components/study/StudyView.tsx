import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TOPICS } from "@/lib/study/content";
import { columnOf, useStudy } from "@/lib/study/store";
import { QuizPanel } from "./QuizPanel";
import { StudyBoard } from "./StudyBoard";
import { StudyChecklist } from "./StudyChecklist";

/** Pasek opanowania: jedna komórka na temat — pełna = „Umiem”, połowa = „W trakcie”. */
function MasteryStrip() {
  const study = useStudy();
  const done = TOPICS.filter((t) => columnOf(study, t.id) === "done").length;
  const doing = TOPICS.filter((t) => columnOf(study, t.id) === "doing").length;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-3">
        <p className="font-display text-4xl leading-none tabular-nums text-primary" data-testid="mastery-count">{done}</p>
        <p className="text-sm text-muted-foreground">z {TOPICS.length} tematów opanowanych{doing > 0 ? ` · ${doing} w trakcie` : ""}</p>
      </div>
      <div className="flex gap-1" role="img" aria-label={`Opanowane tematy: ${done} z ${TOPICS.length}`}>
        {TOPICS.map((t) => {
          const col = columnOf(study, t.id);
          return (
            <span
              key={t.id}
              title={t.title}
              className={cn(
                "h-2.5 flex-1 rounded-sm border transition-colors duration-300",
                col === "done" && "border-primary bg-primary",
                col === "doing" && "border-primary/60 bg-primary/30",
                col === "todo" && "border-border bg-transparent",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Dział „Nauka”: quiz, tablica tematów i lista do nauki z materiałów G-HEAT. */
export default function StudyView() {
  return (
    <div className="space-y-6" data-testid="study-view">
      <header className="space-y-4">
        <div>
          <h2 className="font-display text-2xl">Nauka: instalacje wod-kan</h2>
          <p className="text-sm text-muted-foreground">Poradnik „Woda użytkowa” i listy kontrolne G-HEAT, KAN-therm UltraLine.</p>
        </div>
        <MasteryStrip />
      </header>

      <Tabs defaultValue="quiz">
        <TabsList className="h-auto w-full sm:w-auto">
          <TabsTrigger value="quiz" className="flex-1 sm:flex-none">Quiz</TabsTrigger>
          <TabsTrigger value="board" className="flex-1 sm:flex-none">Tablica</TabsTrigger>
          <TabsTrigger value="list" className="flex-1 sm:flex-none">Lista do nauki</TabsTrigger>
        </TabsList>
        <TabsContent value="quiz" className="mt-4"><QuizPanel /></TabsContent>
        <TabsContent value="board" className="mt-4"><StudyBoard /></TabsContent>
        <TabsContent value="list" className="mt-4"><StudyChecklist /></TabsContent>
      </Tabs>
    </div>
  );
}
