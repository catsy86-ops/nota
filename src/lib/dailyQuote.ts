const QUOTES: { text: string; author: string }[] = [
  { text: "Najlepszy sposób, by przewidzieć przyszłość, to ją stworzyć.", author: "Peter Drucker" },
  { text: "Małe kroki każdego dnia prowadzą do wielkich rezultatów.", author: "Anonim" },
  { text: "Nie musisz być świetny, by zacząć — musisz zacząć, by być świetny.", author: "Zig Ziglar" },
  { text: "Prostota jest szczytem wyrafinowania.", author: "Leonardo da Vinci" },
  { text: "Skupienie to mówienie 'nie' tysiącu rzeczy.", author: "Steve Jobs" },
  { text: "Jeśli chcesz iść szybko — idź sam. Jeśli chcesz iść daleko — idź razem.", author: "Przysłowie" },
  { text: "Każda notatka to ziarno przyszłej myśli.", author: "🦆 KACZY" },
  { text: "Dyscyplina to wybór między tym, czego chcesz teraz, a tym, czego chcesz najbardziej.", author: "Abraham Lincoln" },
  { text: "Robione lepsze niż doskonałe.", author: "Sheryl Sandberg" },
  { text: "Kreatywność to inteligencja bawiąca się.", author: "Albert Einstein" },
  { text: "Czas, który dobrze spędzasz, nie jest czasem zmarnowanym.", author: "John Lennon" },
  { text: "Cisza to także odpowiedź.", author: "Rumi" },
  { text: "Notuj wszystko — pamięć kłamie, atrament nie.", author: "🦆 KACZY" },
  { text: "Działanie pokona każdy lęk.", author: "Anonim" },
  { text: "Twoje nawyki tworzą twoje jutro.", author: "James Clear" },
];

export function getDailyQuote(): { text: string; author: string } {
  const now = new Date();
  const dayKey = Number(`${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}`);
  return QUOTES[dayKey % QUOTES.length];
}
