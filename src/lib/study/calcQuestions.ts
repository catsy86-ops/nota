import { PIPES, pipeLiters, plNum, slopeDrop, waterTest } from "./calc";
import type { Question } from "./content";

/**
 * Pytania liczbowe z kalkulatorów (Etap 4 § 4.4): wynik liczony tymi samymi funkcjami co w arkuszu
 * kalkulatorów, więc quiz i kalkulator nie mogą się rozjechać. Pierwsza opcja jest poprawna
 * (kolejność miesza `quiz.ts`). Pytania są stałe — bez losowania, id stabilne między urządzeniami.
 */

const proba = waterTest(6).testBar;
const drop = slopeDrop(10, 2); // cm różnicy na 10 m przy spadku 2%
const litres = pipeLiters(PIPES[1].innerMm, 10); // 20×2 (wewn. 16 mm), 10 m

export const CALC_QUESTIONS: Question[] = [
  {
    id: "calc-proba-9",
    topic: "proba-wody",
    question: "Robocza próba wodna wynosi 6 bar. Jakie ciśnienie próbne wychodzi z mnożnika 1,5?",
    options: [`${plNum(proba, 0)} bar`, "6 bar", "7,5 bar", "12 bar"],
    explanation: "Ciśnienie próbne = 1,5 × robocze, czyli 1,5 × 6 = 9 bar.",
  },
  {
    id: "calc-spadek-20",
    topic: "spadki",
    question: "Odcinek kanalizacji ma 10 m i spadek 2%. Ile centymetrów różnicy wysokości trzeba zachować?",
    options: [`${plNum(drop, 0)} cm`, "10 cm", "5 cm", "30 cm"],
    explanation: "Spadek 2% na 10 m to 10 × 0,02 = 0,2 m, czyli 20 cm.",
  },
  {
    id: "calc-poj-2",
    topic: "piony",
    question: "Ile litrów wody mieści 10 m rury 20×2 (wewnętrznie 16 mm)?",
    options: [`${plNum(litres, 1)} l`, `${plNum(litres / 2, 1)} l`, `${plNum(litres * 2, 1)} l`, `${plNum(litres * 1.5, 1)} l`],
    explanation: `Pojemność = π · (d/2)² · L = π · 0,08² · 10 ≈ ${plNum(litres, 1)} l.`,
  },
];
