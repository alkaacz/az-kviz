# AZ kvíz - specifikace

Webová verze populární hry AZ kvíz pro použití ve škole.
Referenční chování a pravidla: https://aplikace.matemi.eu/kviz/create.html

---

## 1. Účel a uživatelé

- **Učitel (admin)** - jeden uživatel, který vytváří a edituje kvízy (banky otázek). Přihlášení přes **Google účet**.
- **Děti (hráči)** - hrají ve třídě, **pass-and-play** na jednom zařízení (učitel promítá, týmy se střídají). Žádné přihlašování, hráči zadají jen jméno týmu.

V jeden okamžik běží **1 hra**, **2-3 týmy**.

---

## 2. Herní pravidla (shrnutí)

- Hrací plán = trojúhelník, **7 řad, 28 hexagonálních polí**.
- Tři strany trojúhelníku jsou přiřazeny třem týmům jako jejich "cílové" hrany.
- Týmy se střídají na tahu (klasické pořadí dle AZ kvízu; v MVP postačí rotace 1→2→3→1).
- Na tahu tým **vybere libovolné volné pole** → zobrazí se otázka s **4 možnostmi (a/b/c/d)** → auto-vyhodnocení:
  - **správně** → pole získává barvu týmu,
  - **špatně** → pole se stane **černým/zablokovaným** (nikdo ho nevlastní; v MVP se už znovu nehraje).
- **Vítězí tým, který souvislou cestou vlastních polí spojí všechny tři strany trojúhelníku** (podle pravidel AZ kvízu).
- Pokud nikdo nespojí a všechna pole jsou rozhodnutá, vítězí tým s **nejvíce poli**.
- Časový limit na otázku: konfigurovatelný per kvíz (default vypnutý / 30 s).

> Detaily okrajových případů (kdo začíná, pořadí při remíze v počtu polí) řešit minimalisticky; přesné kopírování TV pravidel není cílem MVP.

---

## 3. Datový model

### 3.1 Kvíz (bank otázek)
```jsonc
{
  "id": "string",                 // generováno
  "name": "Přírodověda 5. třída",
  "ownerEmail": "ucitel@...",
  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime",
  "settings": {
    "timeLimitSec": 30,           // 0 = vypnuto
    "shuffleAnswers": true
  },
  "questions": [
    {
      "id": "q1",
      "text": "Kolik má pavouk nohou?",
      "imageUrl": "https://...",  // volitelné (např. veřejný odkaz z Google Drive)
      "options": ["6", "8", "10", "12"],
      "correctIndex": 1
    }
  ]
}
```

- Kvíz musí mít **≥ 28 otázek**; doporučeno víc, otázky se pro hru zamíchají a vybere 28.
- Obrázky: URL na obrázek. Upload souboru přímo z UI je nice-to-have (MVP: jen URL).

### 3.2 Stav hry (jen v prohlížeči učitele, neukládá se na server)
```jsonc
{
  "quizId": "string",
  "teams": [
    { "id": "A", "name": "Modří",   "color": "#1e88e5" },
    { "id": "B", "name": "Červení", "color": "#e53935" },
    { "id": "C", "name": "Zelení",  "color": "#43a047" }
  ],
  "board": [
    { "index": 0, "row": 0, "col": 0,
      "owner": "A" | "B" | "C" | "BLACK" | null,
      "questionId": "q1" }
    // ... 28 polí
  ],
  "currentTeam": "A",
  "phase": "picking" | "answering" | "finished",
  "activeField": 5,
  "winner": "A" | null
}
```

---

## 4. Architektura

### 4.1 Frontend
- **Vanilla JS + HTML + CSS**, bez build stepu (povolen Vite jen jako volitelný dev server).
- Hexagonální plán: **SVG** (jednodušší click handling než canvas).
- Hostováno na **GitHub Pages** (repo `az-kviz`), obdobně jako https://alkaacz.github.io/games/tetris/.

Stránky:
- `index.html` - rozcestník (Hrát / Admin).
- `play.html?quizId=...` - herní obrazovka (pass-and-play).
- `admin.html` - login + správa kvízů + editor.

### 4.2 Backend
- **Google Apps Script (GAS)** publikovaný jako **Web App** (`doGet`, `doPost`).
- Úložiště: **Google Sheets** v Drive učitele - jeden spreadsheet (např. `AZ-Kviz-Data`) se sheety:
  - `quizzes` - 1 řádek = 1 kvíz (id, name, ownerEmail, settings JSON, createdAt, updatedAt),
  - `questions` - 1 řádek = 1 otázka (quizId, id, text, imageUrl, options JSON, correctIndex).
- Obrázky: učitel je nahrává sám na Google Drive, do kvízu vkládá veřejný odkaz.

### 4.3 Autentizace
- **Admin**: Google Sign-In (Google Identity Services) na frontendu → ID token se posílá do GAS, GAS ho ověří (volání Google `tokeninfo`) a porovná e-mail s **whitelistem** v `Script Properties`.
- **Hráči**: bez přihlášení, otevřou veřejný odkaz `play.html?quizId=...`.

### 4.4 API (GAS Web App)

| Metoda | Action | Auth | Popis |
|---|---|---|---|
| GET  | `listQuizzes`    | admin  | seznam kvízů (id, name, počet otázek) |
| GET  | `getQuiz`        | admin  | kompletní kvíz pro editor |
| GET  | `getQuizForPlay` | public | otázky pro hru (viz bezpečnost) |
| POST | `saveQuiz`       | admin  | vytvoření/aktualizace celého kvízu (upsert dle id) |
| POST | `deleteQuiz`     | admin  | smazání |

CORS / content-type: GAS Web App pro POST typicky vyžaduje `text/plain` s JSON v body - vyřeší implementace.

---

## 5. Bezpečnost

- **Riziko**: pokud má dítě přístup k zařízení s `play.html`, může v DevTools zjistit správné odpovědi.
- **MVP rozhodnutí**: hru ovládá učitel na svém zařízení/promítačce, děti k zařízení nemají přístup. `correctIndex` se posílá s otázkami, vyhodnocení probíhá v prohlížeči učitele. **Akceptované riziko.**
- Admin endpointy chráněné Google ID tokenem + whitelistem e-mailů.

---

## 6. UI / UX

### 6.1 Admin (`admin.html`)
- Tlačítko "Přihlásit se Googlem".
- Seznam kvízů (název, počet otázek, datum úpravy, akce: Editovat / Smazat / Kopírovat odkaz na hru).
- Tlačítko "Nový kvíz".
- Editor kvízu:
  - název, nastavení (časový limit, zamíchat odpovědi),
  - tabulka otázek - inline editace (text, URL obrázku, 4 odpovědi, radio pro správnou),
  - "Přidat otázku", "Uložit",
  - nice-to-have: import z CSV/JSON.

### 6.2 Hra (`play.html`)
- Úvodní obrazovka:
  - výběr počtu týmů (2 / 3),
  - zadání názvů týmů (volitelně barva),
  - "Začít hru".
- Herní obrazovka:
  - uprostřed: SVG trojúhelník 28 polí, obarvená podle vlastníka, hover ukazuje "klikni pro otázku",
  - vpravo: panel - na tahu je tým **X**, skóre (počet polí), tlačítko "Konec hry".
  - klik na volné pole → **modál s otázkou**, 4 tlačítka odpovědí (+ obrázek), volitelný odpočet,
  - po zodpovězení: obarvení pole + přechod tahu.
- Konec hry: "Vyhrál tým X" + "Hrát znovu".

---

## 7. Struktura repozitáře

```
az-kviz/
├── index.html
├── play.html
├── admin.html
├── css/
│   └── styles.css
├── js/
│   ├── api.js          // wrapper nad GAS Web App
│   ├── auth.js         // Google Sign-In
│   ├── board.js        // generování SVG hexagonálního plánu + detekce výhry
│   ├── game.js         // herní stav, tahy, vyhodnocení
│   ├── admin.js
│   └── play.js
├── gas/
│   └── Code.gs         // zdrojový kód GAS backendu
├── README.md
└── zadani.md
```

---

## 8. Otevřené body / nice-to-have

- Upload obrázků z editoru přes Google Picker / Drive API.
- Import otázek z CSV.
- Více učitelů (multi-tenant) - v MVP stačí whitelist.
- Statistiky odehraných her a úspěšnosti otázek.
- Export/import kvízu jako JSON.

---

## 9. Akceptační kritéria MVP

1. Učitel se přihlásí Googlem, vytvoří kvíz se ≥ 28 otázkami (4 možnosti, 1 správná), uloží.
2. Učitel zkopíruje odkaz na hru a otevře `play.html?quizId=...`.
3. Zadá 2-3 týmy, spustí hru.
4. Klikáním na pole se zobrazují otázky, po odpovědi se pole obarví správně (vlastník / černé).
5. Hra detekuje vítězství (spojení tří hran) a oznámí vítěze.
6. Data kvízů přežijí refresh a jsou uložená v Google Sheets.

---

## 10. Implementační plán

3 milníky, každý se zadává **samostatným promptem v novém chatu** (čistý kontext = méně chyb). Po každém milníku otestovat v prohlížeči, pak pokračovat.

Doporučený model: **Claude Sonnet 4.5** (případně Opus 4.x) v agent módu.

| Milník | Co vznikne | Závislosti |
|---|---|---|
| **M1** | Hex plán (SVG) + detekce výhry, samostatně testovatelné v `board-test.html` | žádné |
| **M2** | `play.html` - pass-and-play hra s mock kvízem (JSON v souboru) | M1 |
| **M3** | GAS backend, `admin.html`, Google login, napojení `play.html` na API | M2 + ručně připravené Google věci |

### Co si připravit ručně před M3

| Krok | Kde | Výstup pro model |
|---|---|---|
| Spreadsheet `AZ-Kviz-Data` (NEsdílet veřejně) | sheets.google.com | Spreadsheet ID |
| GAS projekt + deploy jako Web App ("Anyone") | script.google.com | Web App URL |
| OAuth Client ID (Web app, authorized origins = GitHub Pages URL) | console.cloud.google.com | Client ID |
| Whitelist e-mailů učitelů | GAS Script Properties (`ALLOWED_EMAILS`) | - |

---

### Prompt pro M1 - Hex plán + detekce výhry

> **Doporučený model:** Claude Sonnet 4.5 (geometrie + algoritmus detekce výhry; Sonnet zvládá spolehlivě). Alternativa: GPT-5.

```
Pracuj v repu d:\git\az-kviz. V repu je zadani.md - přečti si ho pro kontext.

Tvůj úkol je MILNÍK 1: hrací plán + detekce výhry. Žádný backend, žádné otázky, jen geometrie a logika.

Vytvoř:

1) js/board.js (ES module, vanilla JS, žádné dependencies)
   - export function createBoard(): vrátí pole 28 objektů { index, row, col, owner: null }
     - 7 řad, řada r má r+1 polí (1+2+3+4+5+6+7 = 28)
   - export function getNeighbors(index): vrátí indexy sousedních hexů (max 6)
   - export function getEdgeFields(): vrátí { A: number[], B: number[], C: number[] }
     - A = levá hrana trojúhelníku (první pole každé řady)
     - B = pravá hrana (poslední pole každé řady)
     - C = spodní hrana (celá poslední řada)
   - export function checkWin(board, teamId): boolean
     - true, pokud existuje souvislá cesta polí týmu spojující všechny 3 hrany
     - implementuj přes BFS/flood-fill: najdi všechny komponenty týmových polí, pro každou zjisti, kterých hran se dotýká, vyhraj když některá komponenta = {A,B,C}
   - export function renderBoardSVG(board, container, onFieldClick)
     - vykreslí SVG do daného containeru (HTMLElement)
     - každý hex je <polygon> s data-index atributem
     - barvy: null = světle šedá, "A" = modrá, "B" = červená, "C" = zelená, "BLACK" = tmavě šedá
     - pointy-top hexagony, vhodný viewBox, responzivní (width 100%)
     - onFieldClick(index) se zavolá při kliknutí na pole

2) board-test.html
   - načte js/board.js jako module
   - vykreslí plán do <div id="board">
   - po kliknutí na pole cykluje vlastníka: null → A → B → C → BLACK → null
   - vedle plánu zobrazuje pro každý tým "Vyhrál: ano/ne" (volá checkWin)
   - žádný build, otevíratelné přímo v prohlížeči (file:// nebo Live Server)

DŮLEŽITÉ:
- Žádný framework, žádný build step, žádné npm.
- Kód buď přehledný, krátké funkce, JSDoc typy stačí.
- Indexování polí: index 0 = vrchol, dál po řadách zleva doprava.
- Sousedství v trojúhelníkovém hex gridu: pole (r, c) sousedí s (r-1, c-1), (r-1, c), (r, c-1), (r, c+1), (r+1, c), (r+1, c+1) - ošetři okraje.

Až bude hotovo, otevři board-test.html v Simple Browseru a ověř že:
- plán má 28 polí ve tvaru trojúhelníku
- kliknutí mění barvy
- když obarvím souvislou cestu z levé hrany přes spodek k pravé hraně jednou barvou, checkWin vrátí true
```

---

### Prompt pro M2 - Hra (pass-and-play)

> **Doporučený model:** Claude Sonnet 4.5 (vícesouborové UI, drží konzistenci stavu hry). Alternativa: GPT-5 / Claude Opus 4.x.

```
Pracuj v repu d:\git\az-kviz. Přečti zadani.md. M1 už je hotový (js/board.js + board-test.html).

Tvůj úkol je MILNÍK 2: kompletní herní smyčka v play.html s mock daty (zatím bez backendu).

Vytvoř:

1) js/game.js (ES module)
   - třída nebo factory Game(quiz, teams) s API:
     - startGame() - vybere 28 otázek z quiz.questions (zamíchaných), přiřadí každému poli jednu
     - getState() - vrátí stav (teams, board, currentTeam, phase, activeField, winner)
     - pickField(index) - tým na tahu vybere pole; phase: picking → answering
     - answer(optionIndex) - vyhodnotí; pole → owner týmu nebo BLACK; další tah
     - po každém answer zkontroluje checkWin pro všechny týmy, pak remízu (žádné volné pole)
   - rotace tahů: 1 → 2 → 3 → 1
   - žádný stav v localStorage, jen v paměti (refresh = nová hra)

2) play.html + js/play.js + css/styles.css
   - úvodní obrazovka:
     - výběr 2 / 3 týmy, inputy pro názvy, color pickery (default barvy)
     - tlačítko "Začít hru"
   - herní obrazovka:
     - vlevo: SVG plán (z board.js), klikatelná volná pole
     - vpravo panel: na tahu je tým X (jeho barva), skóre všech týmů (počet polí), tlačítko "Konec hry"
     - modal s otázkou:
       - text otázky, obrázek pokud je imageUrl
       - 4 tlačítka odpovědí (a/b/c/d), po kliknutí vyhodnocení a zavření modalu
       - pokud quiz.settings.timeLimitSec > 0, zobraz odpočet; po vypršení = špatná odpověď
     - konec hry: overlay "Vyhrál tým X" + tlačítko "Hrát znovu" (návrat na úvodní obrazovku)
   - quizId se zatím ignoruje, kvíz se načítá z mock/sample-quiz.json (vytvoř ho, 30 otázek, 2 z nich s imageUrl)

3) mock/sample-quiz.json
   - struktura podle zadani.md sekce 3.1
   - 30 otázek (rozumný obsah, klidně mix matiky/přírodovědy/zeměpisu)

DŮLEŽITÉ:
- Žádný framework, žádný build, ES moduly přes <script type="module">.
- API v js/api.js zatím neřeš, jen v play.js načti přes fetch('./mock/sample-quiz.json').
- UI funkční, ne nutně krásné. Použij CSS Grid/Flexbox, jednoduché barvy, čitelné fonty.
- Mobilní podporu neřeš, cíl je projekce na tabuli.

Otestuj: spuštění hry se 2 týmy, odpověď správně i špatně, detekce vítěze.
```

---

### Prompt pro M3 - GAS backend + admin + napojení

> **Doporučený model:** Claude Opus 4.x (nejnáročnější milník - auth flow, GAS specifika, CORS, více souborů najednou). Pokud Opus není dostupný, použij Claude Sonnet 4.5; GPT-5 jako třetí volba.

```
Pracuj v repu d:\git\az-kviz. Přečti zadani.md. M1 a M2 jsou hotové.

Tvůj úkol je MILNÍK 3: backend (Google Apps Script + Sheets), admin UI a napojení play.html na API.

PŘEDPOKLÁDÁM, ŽE UŽIVATEL UŽ MÁ:
- Google Sheet "AZ-Kviz-Data" (ID si vyžádej, nebo nech placeholder a popiš v README)
- Google Cloud OAuth Client ID (taky placeholder + README)
- Apps Script projekt (do něj se nasadí az-kviz-gas/src/Code.gs)

Vytvoř:

1) az-kviz-gas/src/Code.gs
   - doGet(e) a doPost(e) - router podle e.parameter.action
   - actions:
     - listQuizzes (admin) - vrátí [{id, name, questionCount, updatedAt}]
     - getQuiz (admin) - kompletní kvíz včetně correctIndex
     - getQuizForPlay (public) - kompletní kvíz (correctIndex zůstává, viz zadani.md sekce 5)
     - saveQuiz (admin) - upsert podle id; pokud chybí, generuje nové
     - deleteQuiz (admin) - smaže kvíz i jeho otázky
   - Auth: admin akce vyžadují parametr idToken; ověř přes UrlFetchApp na https://oauth2.googleapis.com/tokeninfo?id_token=...
     - zkontroluj aud == OAUTH_CLIENT_ID (Script Property)
     - zkontroluj email v ALLOWED_EMAILS (Script Property, čárkou oddělené)
   - Storage: SpreadsheetApp.openById(SPREADSHEET_ID z Script Properties)
     - sheet "quizzes": columns id | name | ownerEmail | settings(JSON) | createdAt | updatedAt
     - sheet "questions": columns quizId | id | text | imageUrl | options(JSON) | correctIndex
     - při prvním běhu vytvoř sheety pokud nejsou
   - Odpovědi vždy JSON, struktura {ok: true, data: ...} nebo {ok: false, error: "..."}

2) js/api.js (ES module)
   - const API_URL = '...' (placeholder, popiš v README)
   - exporty: listQuizzes(), getQuiz(id), getQuizForPlay(id), saveQuiz(quiz), deleteQuiz(id)
   - GET = fetch normálně, POST = fetch s method POST a content-type text/plain (GAS specifika), body JSON.stringify({action, idToken, payload})
   - idToken bere z auth.js (jen pro admin akce)

3) js/auth.js (ES module)
   - integrace Google Identity Services (GIS)
   - export initAuth(clientId, onSignIn, onSignOut)
   - export getIdToken() - vrátí aktuální token nebo null
   - render Google tlačítka do daného elementu
   - token uložit do sessionStorage

4) admin.html + js/admin.js
   - pokud nepřihlášen: jen Google Sign-In tlačítko
   - po přihlášení:
     - seznam kvízů (tabulka: název, počet otázek, datum, akce: Editovat / Smazat / Kopírovat herní odkaz)
     - tlačítko "Nový kvíz"
   - editor kvízu (může být na stejné stránce, toggle view):
     - input název, checkbox "zamíchat odpovědi", number "časový limit (s)"
     - tabulka otázek: text (textarea), URL obrázku, 4 inputy odpovědí, radio pro správnou
     - "Přidat otázku", "Smazat otázku", "Uložit", "Zrušit"
   - validace: ≥ 28 otázek, každá s neprázdným textem a 4 odpověďmi, vybraná správná

5) Uprav play.js
   - místo mock/sample-quiz.json načítej přes api.getQuizForPlay(quizId) z URL query
   - chyba načtení = zobraz hlášku

6) index.html
   - jednoduchý rozcestník: tlačítko "Admin" → admin.html, info text

7) README.md
   - sekce "Setup":
     - vytvoření Google Sheet (ID kam vložit)
     - vytvoření GAS projektu, nahrání Code.gs, Script Properties (SPREADSHEET_ID, OAUTH_CLIENT_ID, ALLOWED_EMAILS), deploy jako Web App ("Anyone")
     - vytvoření OAuth Client ID v Google Cloud Console (Web app, authorized origins)
     - vyplnění API_URL v js/api.js a CLIENT_ID v js/auth.js (nebo v js/config.js)
   - sekce "Local dev": Live Server nebo `python -m http.server`
   - sekce "Deploy": GitHub Pages z main branch

DŮLEŽITÉ:
- Žádný framework, žádný build.
- GAS POST s content-type "application/json" způsobuje CORS preflight - používej "text/plain" a JSON parsuj uvnitř doPost.
- Po dokončení sepiš stručný checklist, co má uživatel udělat, než to poprvé spustí.
```