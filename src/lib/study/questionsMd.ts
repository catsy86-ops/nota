/**
 * Import pytań z pliku `.md` (P4.5). Format, jeden blok na pytanie:
 *
 *   P: Ile milimetrów ma rura DN16?
 *   A: 16
 *   N: 12
 *   N: 20
 *   N: 25
 *   X: Średnica nominalna, nie zewnętrzna. (opcjonalnie)
 *
 * Bloki oddziela nowy `P:` (puste linie są dowolne). Parser nie zna tematów ani limitów
 * zapisu — to robi `store.addCustomQuestion` przez `cleanCustom`. Tu tylko kształt i komunikaty z numerami wierszy.
 */

export interface MdQuestion {
  question: string;
  correct: string;
  wrong: [string, string, string];
  explanation: string;
  /** Numer wiersza, w którym zaczyna się blok (do komunikatów). */
  line: number;
}

export interface MdParseError {
  line: number;
  message: string;
}

export interface MdParseResult {
  questions: MdQuestion[];
  errors: MdParseError[];
}

const MARK = /^([PANX]):\s*(.*)$/;

export function parseQuestionsMd(text: string): MdParseResult {
  const questions: MdQuestion[] = [];
  const errors: MdParseError[] = [];
  let block: { line: number; question: string; correct: string | null; wrong: string[]; explanation: string } | null = null;

  const flush = () => {
    if (!block) return;
    const at = block.line;
    if (!block.question) errors.push({ line: at, message: "Brak treści pytania (P:)." });
    else if (block.correct === null || block.correct === "") errors.push({ line: at, message: `Pytanie „${block.question}”: brak poprawnej odpowiedzi (A:).` });
    else if (block.wrong.length !== 3) errors.push({ line: at, message: `Pytanie „${block.question}”: potrzeba dokładnie 3 odpowiedzi błędnych (N:), jest ${block.wrong.length}.` });
    else if (block.wrong.some((w) => w === "")) errors.push({ line: at, message: `Pytanie „${block.question}”: pusta odpowiedź błędna (N:).` });
    else if (new Set([block.correct, ...block.wrong]).size !== 4) errors.push({ line: at, message: `Pytanie „${block.question}”: odpowiedzi muszą być różne.` });
    else questions.push({ question: block.question, correct: block.correct, wrong: [block.wrong[0], block.wrong[1], block.wrong[2]], explanation: block.explanation, line: at });
    block = null;
  };

  text.replace(/\r\n?/g, "\n").split("\n").forEach((raw, i) => {
    const line = i + 1;
    const t = raw.trim();
    if (t === "") return;
    const m = MARK.exec(t);
    if (!m) {
      if (!block) errors.push({ line, message: "Wiersz przed pierwszym P: — nie wiadomo, do którego pytania należy." });
      else errors.push({ line, message: `Nieznany wiersz (oczekiwano P:, A:, N: albo X:).` });
      return;
    }
    const [, mark, value] = m;
    const v = value.trim();
    if (mark === "P") {
      flush();
      block = { line, question: v, correct: null, wrong: [], explanation: "" };
      return;
    }
    if (!block) { errors.push({ line, message: `${mark}: bez pytania przed nim (najpierw P:).` }); return; }
    if (mark === "A") block.correct = block.correct === null ? v : block.correct;
    else if (mark === "N") block.wrong.push(v);
    else block.explanation = v;
    if (mark === "A" && block.correct !== v) errors.push({ line, message: "Drugie A: w tym samym pytaniu." });
  });
  flush();
  errors.sort((x, y) => x.line - y.line);
  return { questions, errors };
}
