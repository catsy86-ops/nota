// Realistyczne próbki eksportów — kształt zgodny z Google Takeout (Keep) i Obsidianem.

/** Notatka tekstowa z etykietą, kolorem, przypięciem i linkiem. Czas: 2021-03-17 12:03:11 UTC. */
export const KEEP_TEXT_JSON = JSON.stringify({
  color: "YELLOW",
  isTrashed: false,
  isPinned: true,
  isArchived: false,
  textContent: "Kupić prezent dla mamy\nsprawdzić godziny otwarcia",
  title: "Urodziny",
  userEditedTimestampUsec: 1616000000000000,
  createdTimestampUsec: 1615982591000000,
  labels: [{ name: "Rodzina" }, { name: "Ważne" }],
  annotations: [{ description: "Opis", source: "WEBLINK", title: "Sklep", url: "https://example.com/sklep" }],
});

/** Lista zakupów z odhaczonymi pozycjami, zarchiwizowana. */
export const KEEP_LIST_JSON = JSON.stringify({
  color: "GREEN",
  isTrashed: false,
  isPinned: false,
  isArchived: true,
  title: "Zakupy",
  userEditedTimestampUsec: 1700000000000000,
  createdTimestampUsec: 1699990000000000,
  listContent: [
    { text: "mleko", isChecked: true },
    { text: "chleb", isChecked: false },
    { text: "", isChecked: false },
  ],
});

export const KEEP_TRASHED_JSON = JSON.stringify({
  color: "DEFAULT", isTrashed: true, isPinned: false, isArchived: false,
  textContent: "do kosza", title: "Kosz",
  userEditedTimestampUsec: 1600000000000000, createdTimestampUsec: 1600000000000000,
});

export const KEEP_IMAGE_JSON = JSON.stringify({
  color: "BLUE", isTrashed: false, isPinned: false, isArchived: false,
  textContent: "", title: "Paragon",
  userEditedTimestampUsec: 1650000000000000, createdTimestampUsec: 1650000000000000,
  attachments: [{ filePath: "paragon.jpg", mimetype: "image/jpeg" }, { filePath: "nagranie.3gp", mimetype: "audio/3gpp" }],
});

export const KEEP_TEXT_HTML = `<!DOCTYPE html><html><head><meta http-equiv="content-type" content="text/html; charset=UTF-8"><title>Urodziny</title>
<style type="text/css">.note{color:#000}</style></head>
<body class="note-body"><div class="note YELLOW"><div class="heading"><div class="meta-icons"></div>17 mar 2021, 12:03:11<div class="archived"><span class="note-action-icon">Zarchiwizowane</span></div></div>
<div class="title">Urodziny</div>
<div class="content">Kupić prezent<br>sprawdzić godziny &amp; ceny<script>alert(1)</script></div>
<div class="chips"><span class="chip label"><span class="label-name">Rodzina</span></span></div>
</div></body></html>`;

export const KEEP_LIST_HTML = `<html><body><div class="note RED"><div class="heading">Mar 5, 2020, 10:00:00 AM</div>
<div class="title">Zakupy</div>
<ul class="list"><li class="listitem"><span class="bullet">&#9744;</span><span class="text">chleb</span></li><li class="listitem checked"><span class="bullet">&#9745;</span><span class="text">mleko</span></li></ul>
</div></body></html>`;

export const OBSIDIAN_NOTE = `---
title: Plan projektu
tags:
  - praca
  - "#pilne"
created: 2024-02-10
updated: 2024-02-12 18:30
---
# Plan projektu

Zobacz [[Notatka o budżecie]] oraz [[Spotkanie|ze spotkania]].

- [ ] Wysłać ofertę
- [x] Zadzwonić do klienta
`;

export const MD_INLINE_TAGS_NOTE = `---
tags: [dom, "#remont"]
date: 2023-11-05T08:15:00
---
Treść bez nagłówka.
`;

export const MD_PLAIN_NOTE = `# Pomysł na weekend

Wycieczka rowerowa nad jezioro.
`;
