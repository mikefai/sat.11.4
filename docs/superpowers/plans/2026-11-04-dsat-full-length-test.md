# DSAT Full-Length Practice Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Bluebook-style, timed, full-length Digital SAT practice test page with 98 original items: Reading and Writing 54 (two modules of 27) and Math 44 (two modules of 22). Each item has an Underlying Core Question and a step-by-step explanation, revealed only on the results screen.

**Architecture:** A pure, Node-testable engine (`test-engine.js`) holds the blueprint, timing, session state machine, SPR answer checking and scoring. A DOM layer (`test-ui.js`, `test.html`) runs intro, module, break and results screens. The four module forms are static JSON under `test/`. Stimulus, table and explanation rendering moves into a shared `render.js` that `app.js` also uses, so the practice pages and the test page cannot drift apart.

**Tech Stack:** Vanilla ES5-style JS with no build step (match `app.js`), static JSON, Node >= 18 `node:test`. No new dependencies. Calculator is an external Desmos link.

**Spec:** The user's brief in this conversation, verbatim: "the reading section of the test must have 54 and the math section of the test must have 44 questions in total, divided into two modules made of 27 in each reading test and 22 in each math test. Follow the guidelines and the difficulty of the exam. Use subagents driven implementation approach using the cheapest yet most appropriate model". It inherits the earlier brief's per-item requirements: question, options A-D and answer; Underlying Core Question; step-by-step explanation including why each distractor is wrong; interactive, clean, lesson-friendly page. "Guidelines and difficulty of the exam" is pinned below from the College Board's published DSAT specifications.

## Global Constraints

- **Counts:** RW 54 = `rw-m1` 27 + `rw-m2` 27. Math 44 = `math-m1` 22 + `math-m2` 22. Every item is scored; there are no pretest items.
- **Timing:** RW modules 32 min (1920 s) each. Math modules 35 min (2100 s) each. 10-min (600 s) break between RW Module 2 and Math Module 1. A student can move freely within a module and can never return to a submitted module. The timer auto-submits at 0.
- **Module 2 is fixed, not adaptive.** It is modeled on the harder second-stage module, the one that keeps the full score range open, because the brief fixes totals at 54/44. Its difficulty mix is pinned in the Blueprint.
- **RW order inside a module:** skill groups in this order: WIC, TSP, CTC, CID, COE-T, COE-Q, INF, BND, FSS, TRN, RS. Difficulty is non-decreasing inside each skill group.
- **Math order inside a module:** difficulty is non-decreasing across the whole module. Domains are interleaved per the Blueprint slots.
- **One passage per RW question.** Passage 25-150 words (CTC: each text 25-150). Original prose only, with no quotations of real copyrighted or literary works. People and studies are fictional, or use facts the author is certain of. No item may reuse a topic from `questions.json`, `lessons.json` or another form item.
- **RW topics:** each item has `topic` in {`literature`, `history`, `humanities`, `science`}. Each RW module has at least 5 of each.
- **RW stems must match the Bluebook stem for their skill** (regexes in Task 2).
- **Math:** calculator allowed throughout; the reference sheet copy is pinned in Task 4. About 30% of math items per module are word problems in context. Six per module are student-produced response (SPR). No item may depend on a figure: anything that would be a graph, table or diagram is given as a `table` or fully described in text.
- **Item text** is injected with `innerHTML`. Allowed tags are `<sup>` and `<u>` only (`<u>` marks a TSP/CTC underlined portion). No other `<`, and no raw `&`.
- **MC items:** four choices A-D, exactly one correct. Numeric choices ascending. For RW, the correct choice must not be the unique longest. Correct-letter spread per module: RW each letter 4-9 times; Math MC each letter 2-6 times.
- **Explanations, every item:**
  - `coreQuestion` (>= 20 chars) and `steps` (>= 3 concrete strings).
  - MC: a TRUE `rationale` on every choice, and `trapType` (`NONE` iff correct, else UPPER_SNAKE_CASE, never `HALF_RIGHT_ALL_WRONG` or `CONFIRMATION_BIAS`).
  - SPR: `acceptedAnswers` and >= 2 `commonErrors` `{value, why}`.
- **Difficulty rubric:**
  - Easy is one step or one clue.
  - Medium is two steps, or a distractor that is half-right.
  - Hard is dense or academic text, a second meaning, subtle qualifiers, or multi-step math with parameters (e.g. "for what value of k ... no solution", discriminant, exponential models, completing the square, similar-triangle trig, data-change statistics).
- **SEC coverage per module:** the 4 BND items cover >= 3 distinct patterns (clause joining, supplements with dashes or commas, colon use, end punctuation). The 3 FSS items cover 3 distinct rules (subject-verb, pronoun-antecedent, verb tense/form, possessive/plural, modifier).
- **No scaled score.** Results show raw scores only (per section, module and domain), because there is no public conversion for an original form.
- **Code conventions:** follow `app.js` (IIFE, `var`, function declarations). `test-engine.js` uses a UMD wrapper so Node tests can `require` it. Item text uses LF endings.
- **Git:** work on branch `full-test`, created from `lesson-page` (`6b85c70`). Never push. Commit per task with no attribution lines.
- **Models (user asked for the cheapest appropriate):**
  - Sonnet for every implementer and for math and code reviewers.
  - Opus for the RW content reviewers (blind-solve judgment) and the final review.
  - No Fable: it failed on credits last run.

## Blueprint (pinned; used verbatim by `test-engine.js` `BLUEPRINT` and by the form tests)

RW skill codes map to names and domains:
- **Craft and Structure:** WIC = Words in Context, TSP = Text Structure and Purpose, CTC = Cross-Text Connections.
- **Information and Ideas:** CID = Central Ideas and Details, COE-T = Command of Evidence (Textual), COE-Q = Command of Evidence (Quantitative), INF = Inferences.
- **Standard English Conventions:** BND = Boundaries, FSS = Form, Structure, and Sense.
- **Expression of Ideas:** TRN = Transitions, RS = Rhetorical Synthesis.

Per RW module, skill counts are WIC 4, TSP 3, CTC 1, CID 2, COE-T 2, COE-Q 2, INF 1, BND 4, FSS 3, TRN 2, RS 3 (domains 8/7/7/5).

RW slot difficulties in order (E = Easy, M = Medium, H = Hard):

| Skill | rw-m1 (E9 M10 H8) | rw-m2 (E4 M10 H13) |
|---|---|---|
| WIC | E E M H | E M H H |
| TSP | E M H | M H H |
| CTC | M | H |
| CID | E M | M H |
| COE-T | M H | M H |
| COE-Q | E H | E M |
| INF | H | H |
| BND | E E M M | E M H H |
| FSS | E M H | E M H |
| TRN | E M | M H |
| RS | M H H | M M H |

Positions 1-15 are Part A (WIC through INF) and 16-27 are Part B (BND through RS).

Math domain codes:
- ALG = Algebra: `ALG-1V`, `ALG-LF`, `ALG-2V`, `ALG-SYS`, `ALG-INEQ`.
- ADV = Advanced Math: `ADV-FN`, `ADV-EQ`, `ADV-EXP`.
- PSD = Problem-Solving and Data Analysis: `PSD-RATE`, `PSD-PCT`, `PSD-1V`, `PSD-2V`, `PSD-PROB`, `PSD-INF`, `PSD-CLAIM`.
- GEO = Geometry and Trigonometry: `GEO-AV`, `GEO-LAT`, `GEO-RT`, `GEO-CIR`.

Skill names are the official ones:
- `ALG-1V` Linear equations in one variable
- `ALG-LF` Linear functions
- `ALG-2V` Linear equations in two variables
- `ALG-SYS` Systems of two linear equations in two variables
- `ALG-INEQ` Linear inequalities in one or two variables
- `ADV-FN` Nonlinear functions
- `ADV-EQ` Nonlinear equations in one variable and systems of equations in two variables
- `ADV-EXP` Equivalent expressions
- `PSD-RATE` Ratios, rates, proportional relationships, and units
- `PSD-PCT` Percentages
- `PSD-1V` One-variable data: distributions and measures of center and spread
- `PSD-2V` Two-variable data: models and scatterplots
- `PSD-PROB` Probability and conditional probability
- `PSD-INF` Inference from sample statistics and margin of error
- `PSD-CLAIM` Evaluating statistical claims: observational studies and experiments
- `GEO-AV` Area and volume
- `GEO-LAT` Lines, angles, and triangles
- `GEO-RT` Right triangles and trigonometry
- `GEO-CIR` Circles

Math slots as position:difficulty:domain:type (S = SPR):
- **math-m1 (E7 M8 H7):** 1 E ALG, 2 E PSD, 3 E ADV, 4 E GEO, 5 E ALG S, 6 E ADV, 7 E ALG, 8 M PSD, 9 M ADV S, 10 M ALG, 11 M GEO, 12 M ADV, 13 M ALG S, 14 M ADV, 15 M ALG, 16 H PSD, 17 H ADV S, 18 H GEO, 19 H ALG, 20 H ADV S, 21 H ALG, 22 H ADV S.
- **math-m2 (E3 M8 H11):** 1 E ALG, 2 E PSD, 3 E ADV S, 4 M ALG, 5 M GEO, 6 M ADV, 7 M ALG S, 8 M PSD, 9 M ADV, 10 M ALG, 11 M ADV S, 12 H GEO, 13 H ALG, 14 H ADV, 15 H PSD S, 16 H ALG, 17 H ADV, 18 H GEO S, 19 H ALG, 20 H ADV, 21 H ALG S, 22 H ADV.
- **Per module:** ALG 8, ADV 8, PSD 3, GEO 3; 6 SPR.
- **Skill coverage across both modules:**
  - each ALG skill >= 2;
  - each ADV skill >= 4;
  - PSD slots use `PSD-PCT` (m1#2), `PSD-1V` (m1#8), `PSD-2V` (m1#16), `PSD-RATE` (m2#2), `PSD-PROB` (m2#8), `PSD-INF` (m2#15);
  - GEO slots use `GEO-AV` (m1#4), `GEO-LAT` (m1#11), `GEO-CIR` (m1#18), `GEO-RT` (m2#5), `GEO-AV` (m2#12), `GEO-CIR` (m2#18).

## Item schema (`test/<module>.json` = array in slot order)

```
common: { id, section:"rw"|"math", skill, difficulty:"Easy"|"Medium"|"Hard", type:"mc"|"spr",
          stimulus, questionStem, table?:{caption, headers:string[], rows:string[][]},
          coreQuestion, steps:string[] }
rw only: topic
mc:  choices:[{letter,text,isCorrect,trapType,rationale} x4], correctAnswer
spr: acceptedAnswers:string[], commonErrors:[{value,why}]
```
IDs are `RW1-01`..`RW1-27`, `RW2-01`.., `M1-01`..`M1-22`, `M2-01`..; the number equals the 1-based position. Math items carry `skill` = math skill code, and the domain comes from its prefix.

## Review Focus

- **Timer hits 0 mid-module:** given answers are kept, the module auto-submits, and the next phase starts. Pinned in Task 1 (`tick to zero submits`) and the Task 4 browser check.
- **Reload mid-module:** resumes the same module, question, answers, marks and remaining time. Reload on results keeps the results. Pinned in Task 4.
- **Messy SPR input** (spaces, unicode minus, `4/6` for `2/3`, overlong decimals, mixed numbers, `+12`) is judged by the Bluebook rules. Pinned in Task 1.
- **Answers in a submitted module** cannot change, through back navigation or a stale tab. Pinned in Task 1 (`setResponse ignores non-current module`) and Task 4.
- **No answer or explanation leaks before the results phase.** Typing letters in an SPR box must not select MC choices. Pinned in Tasks 4 and 5.

---

## File Structure

- **Create:**
  - `test-engine.js`: blueprint constants, session state machine, `sprMatches`, scoring. UMD.
  - `render.js`: `window.ItemRender` with `stimulus`, `table`, `explanation`. Shared by `app.js` and `test-ui.js`.
  - `test.html` and `test-ui.js`: the test runner.
  - `test/rw-m1.json`, `test/rw-m2.json`, `test/math-m1.json`, `test/math-m2.json`.
  - `test/fixtures/{rw-m1,rw-m2,math-m1,math-m2}.json`: 2 items each, for UI work before content exists.
  - `tests/test-engine.test.js` and `tests/test-forms.test.js`.
- **Modify:**
  - `app.js`: use `ItemRender`, delete its private copies.
  - `index.html` and `lessons.html`: one `<script src="render.js">` each.
  - `styles.css`: test-mode styles.

---

### Task 1: Engine core (model: sonnet)

**Files:** Create `test-engine.js` and `tests/test-engine.test.js`.

**Interfaces (Produces), `window.TestEngine` / `module.exports`:**
- `MODULES`: `[{id, section, label, seconds, file}]`, in order `rw-m1`, `rw-m2`, `math-m1`, `math-m2`. Labels are "Reading and Writing: Module 1" etc. Seconds are 1920 / 1920 / 2100 / 2100. File is `<id>.json`.
- `BREAK_SECONDS = 600`.
- `BLUEPRINT`: `{rw-m1:[{skill,difficulty,type}...27], rw-m2:[...], math-m1:[{domain,difficulty,type}...22], math-m2:[...]}`, exactly per the Blueprint section.
- `SKILL_NAMES`, `DOMAIN_NAMES`, `domainOf(skillCode) -> "CS"|"II"|"SEC"|"EOI"|"ALG"|"ADV"|"PSD"|"GEO"`.
- `sprMatches(input: string, accepted: string[]) -> boolean`.
- `isCorrect(item, response: string|null) -> boolean`.
- `newSession() -> Session`, with `Session = {phase:"intro"|"module"|"break"|"results", moduleIndex, position, responses:{[itemId]:string}, marked:{[itemId]:true}, remaining:{[moduleId]:seconds}, breakRemaining}`.
- `start(s)`, `setResponse(s, moduleId, itemId, value)`, `toggleMark(s, moduleId, itemId)`, `goTo(s, position)`, `submitModule(s)`, `tick(s, seconds)`, `endBreak(s)`: each returns a NEW Session and never mutates its input.
- `summarize(s, forms:{[moduleId]:Item[]}) -> {sections:{rw:{correct,total}, math:{...}}, modules:{[id]:{correct,total}}, domains:{[code]:{correct,total}}}`.

- [ ] **Step 1: Write failing tests** in `tests/test-engine.test.js`:
  - **Counts:** `BLUEPRINT` lengths are 27/27/22/22; per-module RW skill counts and difficulty totals match the table; math domain counts are 8/8/3/3 with 6 SPR, and the difficulty totals E7 M8 H7 and E3 M8 H11 hold.
  - **SPR:** `sprMatches` cases:
    - `["2/3"]`: true for `2/3`, `.6666`, `.6667`, `0.666`, `0.667`, `4/6`, ` 2/3 `; false for `0.66`, `.67`, `0.6667`, `0.6`.
    - `["-1/3"]`: true for `-1/3`, `−1/3`, `-.3333`, `-0.333`; false for `-0.33`.
    - `["3.5"]`: true for `7/2` and `3.50`; false for `3 1/2`.
    - `["12"]`: true for `12` and `12.0`; false for `+12`, `1/0`, `""`, `abc`.
    - `["5","-5"]`: true for `-5`.
    - `["0.25"]`: true for `1/4`.
  - **isCorrect:** MC compares to `correctAnswer`, and `null` is false.
  - **Flow:**
    - `start` gives `phase:"module"`, `moduleIndex:0`.
    - `submitModule` from index 1 gives `phase:"break"`.
    - `endBreak` gives index 2, phase `module`.
    - `submitModule` from index 3 gives `phase:"results"`.
    - `tick to zero submits`: tick the full 1920 from index 0 to reach index 1 with responses kept.
    - `tick` in break counts down `breakRemaining` and auto-`endBreak`s at 0.
  - **setResponse ignores non-current module:** a response for a `rw-m1` item after moving to `rw-m2` returns an equal session.
  - **Immutability:** the input session deep-equals its snapshot after every function.
  - **summarize:** on a 2-item fake form it returns the right counts per section, module and domain.
- [ ] **Step 2: Run** `node --test tests/test-engine.test.js` and expect FAIL (module missing).
- [ ] **Step 3: Implement `test-engine.js`.** SPR algorithm, which the tests pin but do not fully determine:
  - normalise by trimming and mapping `−` to `-`;
  - valid iff it matches `/^-?(\d+(\.\d*)?|\.\d+|\d+\/\d+)$/`, has a nonzero denominator, and length is <= 5, or <= 6 when it starts with `-`;
  - correct iff its exact value equals any accepted value (|diff| < 1e-9);
  - or, when it is a decimal at maximum length, it equals an accepted value truncated or rounded to the same number of decimal places.
- [ ] **Step 4: Run** `node --test tests/` and expect all PASS (the earlier lesson tests included).
- [ ] **Step 5: Commit** `feat: add full-test engine (blueprint, session, SPR, scoring)`.

### Task 2: Form validator harness (red) + fixtures (model: sonnet)

**Files:** Create `tests/test-forms.test.js`, four `test/<id>.json` files each holding `[]`, and four fixture files with 2 valid items each (`test/fixtures/`; math fixtures include 1 SPR).

**Interfaces:** Consumes `BLUEPRINT`, `MODULES`, `domainOf`, `sprMatches` from Task 1.

- [ ] **Step 1: Write the tests.** Per module, load the form.
  - **Slot test:** for every PRESENT item at index i, check id `RW1-%02d` / `M1-%02d` with number i+1, and that `skill`/domain, `difficulty` and `type` equal `BLUEPRINT[module][i]`.
  - **Item invariants:** run on every present item and on every fixture item, covering the Global Constraints fields:
    - schema;
    - MC: one correct, letters ABCD, rationale and trapType rules;
    - SPR: each accepted answer satisfies `sprMatches(a, acceptedAnswers)`, >= 2 commonErrors, and each `value` fails `sprMatches`;
    - markup: strip `<sup>`, `</sup>`, `<u>`, `</u>`, then no `<` or `&` remains;
    - `table`: headers length equals every row length;
    - no figure reference: no `/\bfigure\b|diagram|graph (shown|above|below)/i`.
  - **RW-only invariants:**
    - word count 25-150 (CTC split on `Text 1:` / `Text 2:`, each 25-150);
    - `topic` in the set;
    - correct choice not the unique longest when the mean choice length is > 25;
    - COE-Q has a `table`;
    - RS has 4-6 lines starting with `•`.
  - **Stem patterns** (anchored, case-insensitive):

    | Skill | Stem must contain |
    |---|---|
    | WIC | `most logical and precise word or phrase` or `most nearly mean` |
    | TSP | `function of the underlined`, `overall structure` or `main purpose` |
    | CTC | `Based on the texts` |
    | CID | `main idea`, `According to the text` or `Based on the text` |
    | COE-T | `most directly support`, `most directly weaken` or `most effectively illustrates` |
    | COE-Q | `data from the table` |
    | INF | `most logically completes the text` |
    | BND, FSS | `conforms to the conventions of Standard English` |
    | TRN | `most logical transition` |
    | RS | `relevant information from the notes` |
  - **Complete-form tests,** red until filled:
    - length is 27 or 22;
    - per-module topic counts >= 5 each;
    - letter spread (RW 4-9, math MC 2-6);
    - math numeric MC choices ascending;
    - across both math modules, each ALG skill >= 2 and each ADV skill >= 4;
    - PSD/GEO slot skills equal the Blueprint's fixed list;
    - no duplicate stimulus across all forms, `lessons.json` and `questions.json`.
- [ ] **Step 2: Run** `node --test tests/test-forms.test.js`. Expect slot and invariant tests to pass, vacuously for forms and for real on fixtures, and complete-form tests to FAIL.
- [ ] **Step 3: Commit** `test: add full-test form validator and UI fixtures`.

### Task 3: Shared renderer (model: sonnet)

**Files:** Create `render.js`. Modify `app.js` (remove `renderStimulus` and `renderLessonExtras`, call `ItemRender`), `index.html` and `lessons.html` (add `<script src="render.js"></script>` before `app.js`), and `styles.css` (add `.data-table`).

**Interfaces (Produces) `window.ItemRender`:**
- `stimulus(text: string) -> html`: same output as the old `renderStimulus`.
- `table(t) -> html`: `<table class="data-table"><caption>` plus thead and tbody, or `""` when `t` is absent.
- `explanation(q) -> html`: the old `renderLessonExtras` output (core-question callout plus `<ol class="steps">`), or `""`.

- [ ] **Step 1: Write the failing test** `tests/render.test.js`. Load `render.js` in Node via `vm` with a stub `window`. Assert:
  - `stimulus("a\n• b\n• c")` equals `<p>a</p><ul><li>b</li><li>c</li></ul>`;
  - `table({caption:"T",headers:["x","y"],rows:[["1","2"]]})` contains `<caption>T</caption>`, `<th>x</th>` and `<td>2</td>`;
  - `explanation({})` is `""`;
  - `explanation({coreQuestion:"Q",steps:["a","b","c"]})` contains `class="core-question"` and 3 `<li>`.
- [ ] **Step 2: Run** it and expect FAIL.
- [ ] **Step 3: Implement** `render.js` as an IIFE assigning `window.ItemRender`, and switch `app.js` to it.
- [ ] **Step 4: Run** `node --test tests/` and expect all green.
- [ ] **Step 5: Browser regression.** Serve the folder (`python -m http.server 8000`, or `npx http-server -p 8000` if python fails). Expected: `index.html` (24 items) and `lessons.html` (15 items) render exactly as before; the lesson extras appear after answering; no console errors.
- [ ] **Step 6: Commit** `refactor: extract shared ItemRender used by practice pages`.

### Task 4: Test runner (intro, modules, break, persistence) (model: sonnet)

**Files:** Create `test.html` and `test-ui.js`. Modify `styles.css`.

**Interfaces:** Consumes `TestEngine` (Task 1) and `ItemRender` (Task 3). Produces `renderResults(session, forms)`, which is a stub in this task and filled in Task 5.

- [ ] **Step 1: Build `test.html`.**
  - Scripts: `render.js`, `test-engine.js`, `test-ui.js`. Title `DSAT Full-Length Practice Test`.
  - Form base comes from `?base=` only if it matches `/^[\w\/-]+\/$/`; otherwise `test/`. Fixtures are used through `?base=test/fixtures/`.
  - Saved progress lives under localStorage key `dsat-fulltest-v1`, with every read and write in try/catch, so the test still works when storage is unavailable.
- [ ] **Step 2: Intro screen.** An overview table:

  | Section | Modules | Questions | Minutes |
  |---|---|---|---|
  | Reading and Writing | 2 | 54 | 64 |
  | Math | 2 | 44 | 70 |

  Below the table: a 10-minute break line, short directions, a `Begin test` button, and `Resume` / `Start over` buttons when a saved session exists.
- [ ] **Step 3: Module screen.**
  - **Header:** module label, a `mm:ss` countdown, and a red "5 minutes remaining" banner at <= 300 s. Math modules also get a `Reference` button and a `Calculator` link to `https://www.desmos.com/calculator` (`target="_blank" rel="noopener"`).
  - **Layout:** RW shows the passage left and the question right at >= 900px, stacked below that. Math is one column.
  - **Answering:** MC choices are radio-style buttons and stay changeable until submit. SPR is a text input (`maxlength="6"`) with an "Answer preview" line.
  - **Controls:**
    - `Mark for review`;
    - `Back` / `Next`;
    - a `Question N of M` button that opens a navigator grid (answered filled, marked flagged, current outlined);
    - a `Review module` page after the last question, listing each item's state and a `Submit module` button whose confirm dialog states the unanswered count.
  - **Keyboard:** A-D select an MC choice only when focus is not in an input and no Ctrl/Meta/Alt is held.
- [ ] **Step 4: Reference dialog,** exact copy:
  - Circle: A = πr², C = 2πr.
  - Rectangle: A = ℓw. Triangle: A = ½bh.
  - Pythagorean theorem: c² = a² + b².
  - Special right triangles: 30°-60°-90° sides x, x√3, 2x; 45°-45°-90° sides s, s, s√2.
  - Rectangular prism V = ℓwh. Cylinder V = πr²h. Sphere V = (4/3)πr³. Cone V = (1/3)πr²h. Pyramid V = (1/3)ℓwh.
  - "The number of degrees of arc in a circle is 360. The number of radians of arc in a circle is 2π. The sum of the measures in degrees of the angles of a triangle is 180."

  SPR directions panel copy: "Enter one answer. Use up to 5 characters for a positive answer and up to 6 for a negative answer. Enter fractions like 3/4 and decimals like .75 or 0.75; do not enter mixed numbers. For a repeating decimal, enter as many digits as fit. If there is more than one correct answer, enter only one."
- [ ] **Step 5: Wire the timer and flow.**
  - A 1 s `setInterval` calls `TestEngine.tick(session, 1)` and saves the session.
  - Break screen: a 10:00 countdown and a `Resume testing` button. At 0 it auto-continues.
  - Reload restores phase, module, position, answers, marks and remaining time; time paused while the page was closed.
- [ ] **Step 6: Browser check** with fixtures at `test.html?base=test/fixtures/`. Expected:
  - the full flow works (intro, M1, M2, break, M3, M4, then the results stub);
  - Back after a submit cannot change the earlier module;
  - typing `a` in an SPR box changes nothing else;
  - setting `remaining` to 3 s via devtools localStorage and reloading makes it auto-submit;
  - the reload-resume case works;
  - no answer, `coreQuestion` or rationale appears in the DOM before results (`document.body.innerHTML` search);
  - no horizontal scroll at 375px;
  - no console errors.
- [ ] **Step 7: Commit** `feat: add timed full-test runner with modules, break and resume`.

### Task 5: Results and review (model: sonnet)

**Files:** Modify `test-ui.js` (`renderResults`) and `styles.css`.

**Interfaces:** Consumes `TestEngine.summarize`, `isCorrect`, `SKILL_NAMES`, `DOMAIN_NAMES` and `ItemRender.explanation`.

- [ ] **Step 1: Results screen.**
  - **Scores:** RW `x / 54` and Math `y / 44` (or fixture totals), per-module raw, and a domain table (CS, II, SEC, EOI, ALG, ADV, PSD, GEO with correct/total and %). The note "Raw scores only; this original form has no official scale."
  - **Review list:** filter `All | Incorrect | Marked`. Each row shows id, skill name, difficulty and correct/incorrect/omitted; expanding it shows the full item:
    - MC: choices with the student's pick, the correct one marked, and every rationale;
    - SPR: the student's answer, `acceptedAnswers` joined with " or ", and the `commonErrors` list;
    - the `ItemRender.explanation(item)` output.
  - `Retake test` asks for confirmation, then clears storage and returns to intro.
- [ ] **Step 2: Browser check** on fixtures. Expected: totals match `summarize`; filters work; the explanations show; reloading on results keeps results; Retake works; no console errors; 375px is fine.
- [ ] **Step 3: Commit** `feat: add full-test results and answer review`.

### Tasks 6-13: Author the four forms (model: sonnet; reviewer: opus for RW, sonnet for math)

Each task appends its slots to its form file in Blueprint order, follows every Global Constraint and the item schema, and makes the slot and invariant tests green for its slots. For each task:

- [ ] **Step 1: Run** `node --test tests/test-forms.test.js` first. That form's complete-form tests are RED because items are missing. The slot and invariant tests from Task 2 then gate each item you add, so no new test file is needed. Then author the items.
- [ ] **Step 2: Re-solve each item blind** before committing. Recompute every math number in node. Confirm exactly one defensible answer. For SPR, list every value that is equivalent and acceptable in `acceptedAnswers`, or one canonical value the checker covers.
- [ ] **Step 3: Run** `node --test tests/`. All slot and invariant tests pass. Only the complete-form tests for unfinished forms may stay red.
- [ ] **Step 4: Commit** `content: add <form> positions <range>`.

| Task | Form | Positions | Extra pinned requirements |
|---|---|---|---|
| 6 | rw-m1 | 1-15 (WIC-INF) | spread topics so Part B can finish >= 5 each |
| 7 | rw-m1 | 16-27 (BND-RS) | SEC coverage rule; module complete: topic >= 5 each, letter spread 4-9 |
| 8 | rw-m2 | 1-15 | harder register per Blueprint; no topic overlap with rw-m1 |
| 9 | rw-m2 | 16-27 | as Task 7 |
| 10 | math-m1 | 1-11 | >= 3 word problems in context; PSD/GEO skills per Blueprint |
| 11 | math-m1 | 12-22 | >= 3 word problems; module letter spread 2-6 and ascending numeric choices |
| 12 | math-m2 | 1-11 | as Task 10; no repeated setups from math-m1 |
| 13 | math-m2 | 12-22 | as Task 11; across both modules each ALG skill >= 2 and ADV skill >= 4 (all complete-form tests green) |

### Task 14: Whole-test verification (model: sonnet)

**Files:** Modify only what the checks below find defective.

- [ ] **Step 1: Run** `node --test tests/` and expect all green, including every complete-form test.
- [ ] **Step 2: Browser full run** on the real forms at `test.html`:
  - answer about half of the items in each module;
  - let one module time out via the localStorage trick;
  - take the break;
  - on results, check RW total 54, Math 44, and per-domain totals RW 16/14/14/10 and Math 16/16/6/6;
  - spot-check 10 explanations;
  - 375px on an RW item with a table (COE-Q) and on a long CTC item;
  - `index.html` and `lessons.html` regressions;
  - no console errors.
- [ ] **Step 3: Commit** any fixes: `fix: full-test verification fixes`.

---

## Self-Review

- **Spec coverage:**
  - 54/44 totals and the 27/22 modules are pinned in the Blueprint and enforced by the Task 1 and 2 tests.
  - "Guidelines" means the official domain weights, skill order, stems, timing, SPR rules, reference sheet and break, all pinned above.
  - "Difficulty" means per-slot difficulty, the rubric, and a harder Module 2.
  - The per-item core question and steps are schema-enforced.
  - "Cheapest yet most appropriate model" is a model tag on every task.
- **Type consistency:** `TestEngine` function names, `ItemRender` names, module ids, item ids, skill codes and the storage key are identical across tasks.
- **Known judgment left to reviewers:** content correctness, defensibility and Bluebook register. These are the per-task blind solves.
