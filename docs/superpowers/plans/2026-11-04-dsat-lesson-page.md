# DSAT Lesson Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a clean, interactive lesson page with 15 original Bluebook-style DSAT questions (one per requested question type), each showing its Underlying Core Question and a step-by-step explanation after the student answers.

**Architecture:** Reuse the existing static item-bank app (`app.js`, `styles.css`, `index.html`). Add a second dataset `lessons.json` and a second page `lessons.html` that loads it through a `data-src` attribute on `<body>`. Two optional per-item fields (`coreQuestion`, `steps`) are rendered when present, so `questions.json` and `index.html` keep working untouched.

**Tech Stack:** Vanilla ES5-style JS (match `app.js`), static JSON, Node >= 18 built-in `node:test` for data tests. No new dependencies.

**Spec:** The user's brief in this conversation ("expert DSAT curriculum developer ... 15 question types ... interactive, clean, lesson-friendly webpage"). Its per-type Format and Purpose constraints are reproduced in each item task below. The brief says "Text A / Text B" in the cross-text purpose line but "Text 1 / Text 2" in its format line; this plan uses "Text 1 / Text 2" (Bluebook wording).

## Global Constraints

- Folder `C:\Users\MIKE\OneDrive\Desktop\files` is NOT a git repository, so this plan has no commit steps. A checkpoint is "tests green + page loads".
- Exactly 15 items in `lessons.json`, in the order of the brief (1 WIC ... 15 trig), one per type.
- Every item: Question (`stimulus` + `questionStem`), four choices A-D, one correct answer, `coreQuestion` (what the question is really asking the student to prove/solve), `steps` (ordered solution steps, >= 3), and a per-choice `rationale` explaining why each wrong choice is wrong (the existing UI shows these under each choice after answering).
- Bluebook style: formal register, original content, no copyrighted College Board text, no unverifiable real-world statistics (use fictional studies/names or facts you can verify).
- Passage lengths (words): WIC 40-80; TSP 60-120; CTC each text 40-80; CID 60-100; RS 4-6 bullet notes.
- Numeric choices ascending, then lettered A-D. For prose choices the correct choice must not be the unique longest.
- Item text is injected with `innerHTML`: no raw `<` or `&` anywhere (use `\u2264`, `\u2265`, `and`); `<sup>` is the only allowed tag.
- `trapType`: `NONE` for the correct choice, otherwise `UPPER_SNAKE_CASE` describing the student's mistake (e.g. `SIGN_ERROR`, `STOPPED_EARLY`, `OPPOSITE_DIRECTION`). No `HALF_RIGHT_ALL_WRONG`, no `CONFIRMATION_BIAS`.
- Follow `app.js` conventions: IIFE, `var`, function declarations, no build step.
- Do not edit `questions.json` or `index.html`.

## Review Focus

- Raw `<` or `&` in item text (math inequalities, "R&D") silently corrupts rendering. Pinned in Task 1 (`markup is safe`).
- Progress on `lessons.html` must not mix with the item bank's saved answers, and vice versa. Pinned in Task 2 (storage isolation check).
- Legacy items without `coreQuestion`/`steps` must still render on `index.html`. Pinned in Task 2.
- Pressing Ctrl/Cmd + a letter (copy, select-all, find) currently submits an answer; a lesson page invites copying passages. Pinned in Task 2.
- Long steps and the text-based data table must not cause horizontal scroll at 375px. Pinned in Task 6.

---

## File Structure

- Create `lessons.json`: the 15 items.
- Create `lessons.html`: copy of `index.html` with `data-src="lessons.json"`, `data-storage="dsat-lessons-v1"`, lesson title/subtitle.
- Create `tests/lessons.test.js`: schema, markup, per-type, and math tests.
- Modify `app.js`: dataset/storage from body attributes; render core question + steps; ignore Ctrl/Cmd/Alt key combos.
- Modify `styles.css`: styles for the core-question callout and numbered steps.

Item schema (existing fields unchanged; two new ones):

```
{ id, domain, skillCategory, difficulty, stimulus, questionStem,
  choices:[{letter,text,isCorrect,trapType,rationale} x4], correctAnswer,
  coreQuestion: string, steps: string[], studyNote:{ruleOrPrinciple,trapAlert,strategicShortcut,keyVocabularyOrFormulas[]} }
```

IDs, in order: `LESSON-01-WIC`, `LESSON-02-TSP`, `LESSON-03-CTC`, `LESSON-04-CID`, `LESSON-05-COE-TEXT`, `LESSON-06-COE-QUANT`, `LESSON-07-INF`, `LESSON-08-BND`, `LESSON-09-FSS`, `LESSON-10-RS`, `LESSON-11-TRN`, `LESSON-12-LIN`, `LESSON-13-EQX`, `LESSON-14-CPR`, `LESSON-15-TRG`.
`skillCategory` values (the app filters on `domain` only): Words in Context; Text Structure and Purpose; Cross-Text Connections; Central Ideas and Details; Command of Evidence: Textual; Command of Evidence: Quantitative; Inferences; Boundaries; Form, Structure, and Sense; Rhetorical Synthesis; Transitions; Linear Interpretation; Equivalent Expressions; Conditional Probability; Right Triangle Trigonometry. `domain` is `"Reading and Writing"` for 1-11 and `"Math"` for 12-15.

---

### Task 1: Test harness (red)

**Files:**
- Create: `tests/lessons.test.js`
- Create: `lessons.json` containing `[]`

**Interfaces:**
- Produces: `items` (parsed array), `get(id)`, `wc(s)` word counter; later tasks add per-type tests to this file.

- [ ] **Step 1: Write the invariant tests.** In `tests/lessons.test.js` using `node:test` and `node:assert/strict`: load `lessons.json`; define `wc = s => s.trim().split(/\s+/).filter(Boolean).length` and `get = id => items.find(i => i.id === id)`. For every item assert: unique `id`; `domain` in the two allowed values; choices have letters `"ABCD"` in order; exactly one `isCorrect` and its letter equals `correctAnswer`; every choice has non-empty `rationale` and `trapType` matching `/^[A-Z_]+$/` (`NONE` iff correct); `coreQuestion` is a string of >= 20 chars; `steps` is an array of >= 3 non-empty strings; `studyNote` has the four keys. Test `markup is safe`: `JSON.stringify(item).replace(/<\/?sup>/g, "")` contains no `<` or `&`. Test `correct choice is not the unique longest`: for Reading and Writing items whose mean choice length exceeds 25 characters, the correct choice's text length must not exceed every other choice's.
- [ ] **Step 2: Write the count test.** `test("15 items in brief order")` asserts `items.map(i => i.id)` deep-equals the ID list in File Structure. Also `test("correct letters are spread")`: each of A-D is the answer 2-6 times.
- [ ] **Step 3: Run.** `node --test tests/` -> invariants pass vacuously, count test FAILS (`0 !== 15`).

### Task 2: Page, renderer, and seed item (Words in Context)

**Files:**
- Modify: `app.js` (top constants ~lines 4-5; `renderQuestion` after the verdict block ~line 166; keydown handler ~line 335)
- Modify: `styles.css` (append)
- Create: `lessons.html`
- Modify: `lessons.json` (item 1)
- Test: `tests/lessons.test.js`

**Interfaces:**
- Produces: `renderLessonExtras(q: object): string` (private in `app.js`) returning `""` when neither `coreQuestion` nor `steps` exists; DOM classes `.core-question`, `.steps`.

- [ ] **Step 1: Write the failing test** `WIC` in `tests/lessons.test.js`: `get("LESSON-01-WIC")` exists, stimulus word count 40-80 (blank written as `______` counts as one word), stimulus contains `______`, four single-word choices.
- [ ] **Step 2: Run** `node --test tests/` -> FAIL (item missing).
- [ ] **Step 3: Author item 1** in `lessons.json`. Format: one sentence-pair passage with a blank; Purpose: answer provable from in-sentence clues only. Pinned design: a naturalist's field notes "appear ______ at first glance (page after page of repetitive measurements)" contrasted with "in fact capture remarkable precision". Correct: `mundane`. Distractors: `ornate` (`SOUNDS_RIGHT_NO_CUE`), `erratic` (`OPPOSITE_DIRECTION`, contradicts "precision"), `provocative` (`WRONG_CONNOTATION`). `coreQuestion`: which word do the clues "repetitive measurements" and the contrast with "remarkable precision" force, before looking at the options? Steps: predict a word from the clues; name the contrast signal; test each option against the prediction.
- [ ] **Step 4: Create `lessons.html`** as a copy of `index.html` with `<body data-src="lessons.json" data-storage="dsat-lessons-v1">`, `<title>DSAT Lesson Set</title>`, `<h1>DSAT Lesson Set</h1>`, subtitle "15 question types, each with its core question and a worked explanation".
- [ ] **Step 5: Edit `app.js` constants:** `DATA_URL = document.body.getAttribute("data-src") || "questions.json"` and `STORAGE_KEY = document.body.getAttribute("data-storage") || "item-bank-progress-v2"` (the default keeps the item bank's saved progress).
- [ ] **Step 6: Implement `renderLessonExtras(q)` in `app.js`** and insert its result in `renderQuestion` immediately after the verdict, before the `<details class="study-note">`. Output: a `<div class="core-question"><div class="note-label">Underlying core question</div>...</div>` and an `<ol class="steps">` of `<li>` per step. Leave all other markup unchanged.
- [ ] **Step 7: Add the key guard.** At the top of the keydown handler body: `if (e.ctrlKey || e.metaKey || e.altKey) return;`
- [ ] **Step 8: Style** `.core-question` (left border in `--rw`, `--rw-tint` background, mono label like `.note-label`) and `.steps` (padding-left 1.3em, `font-size: 0.92rem`, `max-width: 62ch`, `margin: 0 0 12px`) in `styles.css`, reusing existing variables.
- [ ] **Step 9: Run** `node --test tests/` -> WIC test and invariants PASS, count test still FAILS (1 of 15).
- [ ] **Step 10: Browser check.** Run `python -m http.server 8000` in the folder, open `http://localhost:8000/lessons.html`. Expected: item renders; answering shows verdict, core-question callout, numbered steps, per-choice rationales; Ctrl+C on the passage does NOT answer; answering on lessons.html leaves `http://localhost:8000/index.html` score chip unchanged (storage isolation); `index.html` items still render with no core-question/steps block (legacy tolerance); no console errors.

### Task 3: Information and Ideas + Craft items (2-7)

**Files:**
- Modify: `lessons.json` (items 2-7)
- Test: `tests/lessons.test.js`

**Interfaces:**
- Consumes: item schema and `get`, `wc` from Task 1.

- [ ] **Step 1: Write failing tests,** one per item:
  - `TSP`: stimulus 60-120 words; `questionStem` matches `/structure|purpose|function/i`.
  - `CTC`: stimulus contains `Text 1:` and `Text 2:`; each text 40-80 words (split on those labels); `questionStem` matches `/Text 2/` and `/respond/i`.
  - `CID`: stimulus 60-100 words.
  - `COE-TEXT`: every choice text starts with `"` and ends with `"` (direct quotes); `questionStem` matches `/support|weaken/i`.
  - `COE-QUANT`: stimulus has >= 3 bullet lines starting with `\u2022` (the text-based table); every choice contains a digit.
  - `INF`: `questionStem` matches `/logically|conclusion|follows/i`.
- [ ] **Step 2: Run** -> FAIL for each missing item.
- [ ] **Step 3: Author items 2-7** to these pinned designs (invent the passage prose; keep facts fictional or verifiable):
  - **2 TSP:** scientific or literary passage that states a general pattern, introduces an exception, then offers a possible explanation. Question: overall structure. Correct: "It states a general pattern, introduces an exception, and proposes an explanation for it." Traps: problem-then-solution, chronological narrative, theory-then-refutation-without-explanation. Core question: what is the passage's trajectory, sentence by sentence?
  - **3 CTC:** Text 1 reports a finding (a survey linking community gardens to more neighbors knowing each other); Text 2 accepts the data but argues it may reflect who chooses to join. Correct: "By suggesting the finding may reflect who joins gardens rather than an effect of the gardens." Traps: rejects data wholesale (`TOO_BROAD_EXTREME`), fully agrees (`OPPOSITE_DIRECTION`), shifts to an unrelated cost objection (`OFF_TOPIC`). Core question: does Text 2 dispute the data, its interpretation, or neither?
  - **4 CID:** academic/historical passage with one main argument and one directly stated detail; question asks the main idea. Traps: over-extension to a universal claim, a true but minor detail, an unverified causal claim. Core question: what claim could stand as a one-sentence summary without adding anything the text never says?
  - **5 COE-TEXT (supports):** passage describes a hypothesis (fictional urban crows learn crosswalk use by watching other crows) and a study. Four direct quotes from the study report; correct quote shows observers using the crosswalk more than non-observers. Traps: same topic but no comparison (`TRUE_BUT_IRRELEVANT`), shows the opposite (`OPPOSITE_DIRECTION`), supports a different claim (`WRONG_CLAIM`). Core question: which quote shows learning by observation specifically, with a comparison?
  - **6 COE-QUANT:** short passage with a claim (reading time rose for grade 6 but fell for grade 8 between 2015 and 2023) plus bullets `\u2022 Row 1: Grade 6, 2015 = 24 min/day, 2023 = 31 min/day`, `\u2022 Row 2: Grade 8, 2015 = 19, 2023 = 17`, `\u2022 Row 3: Grade 10, 2015 = 15, 2023 = 15`. Correct choice cites 24 to 31 and 19 to 17 accurately. Traps: swapped years, only one grade (`TRUE_BUT_INCOMPLETE`), cites grade 10 (`WRONG_ROW`). Core question: which choice reads the right rows and years in the right direction for both halves of the claim?
  - **7 INF:** passage gives two facts and leaves the conclusion unstated (a lichen species grows only on limestone; this cliff face is limestone). Correct is the conservative conclusion ("lichen of this species could grow there" / "may be found"). Traps: universal overreach ("all limestone cliffs have it", `TOO_BROAD_EXTREME`), reversed conditional (`REVERSED_LOGIC`), unsupported cause (`UNSUPPORTED_CLAIM`). Core question: what is the most that the two facts guarantee?
  - Each item: `coreQuestion`, >= 3 `steps`, rationales for all four choices, `studyNote`, `difficulty` per Bluebook feel (assign 2 Easy, 3 Medium, 1 Hard across 2-7).
- [ ] **Step 4: Run** `node --test tests/` -> items 2-7 tests and invariants PASS.

### Task 4: Standard English Conventions + Expression of Ideas items (8-11)

**Files:**
- Modify: `lessons.json` (items 8-11)
- Test: `tests/lessons.test.js`

**Interfaces:**
- Consumes: Task 1 helpers.

- [ ] **Step 1: Write failing tests:**
  - `BND`: stimulus contains `______`; the four choices' texts contain between them at least one each of `;`, `:`, and `.`; `questionStem` matches `/Standard English/`.
  - `FSS`: stimulus contains `______`; `questionStem` matches `/Standard English/`.
  - `RS`: stimulus has 4-6 lines starting with `\u2022`; `questionStem` matches `/wants to/`; the correct choice is a single sentence (no more than one `.` ending).
  - `TRN`: choices (lowercased, trimmed) include one of {`however`, `nevertheless`}, one of {`therefore`, `as a result`, `consequently`}, one of {`furthermore`, `moreover`, `in addition`}; stimulus contains `______` at the start of the second sentence (`/\.\s+______,/`).
- [ ] **Step 2: Run** -> FAIL.
- [ ] **Step 3: Author items 8-11:**
  - **8 BND:** two independent clauses where a colon (introducing a list or explanation after a complete clause) is the only defensible mark. Choices must each use a different mark/construction (colon, semicolon, comma splice, period-then-fragment). Verify by SAT rules that exactly one option is defensible; write the rule into `ruleOrPrinciple`. Traps: `COMMA_SPLICE`, `SEMICOLON_BEFORE_NON_CLAUSE`, `FRAGMENT`. Core question: is what follows the blank an independent clause, a list, or an explanation, and which mark may legally follow a complete sentence?
  - **9 FSS:** pronoun-antecedent agreement with a collective noun ("The committee announced that ______ decision ..."): correct `its`; traps `their` (`COLLECTIVE_AS_PLURAL`), `it's` (`CONTRACTION_CONFUSION`), `there` (`HOMOPHONE`). Core question: is the antecedent singular or plural, and does the pronoun match?
  - **10 RS:** 5 factual notes about two fictional studies on sleep and recall (different sample sizes and findings). Stem: "The student wants to emphasize a contrast between the two studies' findings. Which choice most effectively uses relevant information from the notes to accomplish this goal?" Correct: one sentence naming both findings with a contrast signal. Traps: only one study (`TRUE_BUT_OFF_GOAL`), both studies without contrast (`MISSES_GOAL`), adds a fact not in the notes (`OUTSIDE_INFO`). Core question: which choice contains both required pieces of information in the required relationship, and nothing else?
  - **11 TRN:** two-sentence text: "The city lowered bus fares in 2019. ______, ridership rose the following year." Choices: `However`, `Therefore`, `Furthermore`, `For instance`. Correct `Therefore`. Traps: `OPPOSITE_DIRECTION`, `WRONG_RELATIONSHIP`. Core question: what is the relationship between sentence 2 and sentence 1 (contrast, cause-effect, addition, example)?
  - Same per-item requirements as Task 3; spread difficulties.
- [ ] **Step 4: Run** `node --test tests/` -> PASS for 8-11.

### Task 5: Math items (12-15) with computed checks

**Files:**
- Modify: `lessons.json` (items 12-15)
- Test: `tests/lessons.test.js`

**Interfaces:**
- Consumes: Task 1 helpers; `choices[].text` of numeric items must be parseable by the test's `num()` helper.

- [ ] **Step 1: Write failing tests with the pinned numbers:**
  - `LIN`: stimulus contains `y = 28x + 45`; correct choice text matches `/each additional month/`; the stem asks about `28`.
  - `EQX`: define `orig = x => (x*x - 9) / (x*x - x - 12)`. Assert the stored correct choice text equals `(x \u2212 3)/(x \u2212 4)`; assert `orig(x)` equals `(x - 3) / (x - 4)` at x = 0, 1, 2, 5, 6 and differs at x = 5 from each distractor function: `(x + 3)/(x + 4)`, `(x - 3)/(x + 4)`, `9/(x + 12)`.
  - `CPR`: stimulus lists the table as bullets: Juniors 48 morning / 32 evening (80); Seniors 30 morning / 40 evening (70); totals 78 / 72 (150). Assert correct choice is `5/9` (= 40/72); distractors `4/15` (40/150), `4/9` (32/72), `4/7` (40/70); choices ordered ascending by value: `4/15, 4/9, 5/9, 4/7`.
  - `TRG`: stimulus contains `AB = 50` and `cos(B) = 24/25`; correct choice `14`; choices `7, 14, 24, 48`; test asserts `Math.hypot(14, 48) === 50`.
- [ ] **Step 2: Run** -> FAIL.
- [ ] **Step 3: Author items 12-15:**
  - **12 LIN:** a gym charges a one-time joining fee of $45 plus $28 per month; total cost `y = 28x + 45`. Ask the meaning of 28. Correct: "The cost, in dollars, for each additional month of membership." Distractors: the joining fee (`SWAPPED_SLOPE_INTERCEPT`), the total after 28 months (`MISREAD_COEFFICIENT`), the months purchasable for $45 (`MISREAD_COEFFICIENT`). Core question: what quantity changes by 28 when x increases by 1?
  - **13 EQX:** "Which expression is equivalent to (x\u00b2 \u2212 9)/(x\u00b2 \u2212 x \u2212 12), for x not equal to \u22123 or 4?" Correct `(x \u2212 3)/(x \u2212 4)`. Traps: `SIGN_ERROR` for `(x + 3)/(x + 4)`, `MISFACTORED_DENOMINATOR` for `(x \u2212 3)/(x + 4)`, `ILLEGAL_CANCELLATION` for `9/(x + 12)`. Core question: after factoring both parts, which common factor cancels? Steps show both factorizations.
  - **14 CPR:** the two-way table above; question: "If one student who prefers evening study is selected at random, what is the probability that the student is a senior?" Rationales name each denominator mistake (`WRONG_DENOMINATOR` for 40/70, `JOINT_NOT_CONDITIONAL` for 40/150, `WRONG_GROUP` for 32/72). Core question: the "given" restricts the sample space to which column?
  - **15 TRG:** "In right triangle ABC, the right angle is at C, AB = 50, and cos(B) = 24/25. What is the length of AC?" Steps: BC = 50 \u00b7 24/25 = 48; sin(B) = cos(A) identity optional; AC = \u221a(50\u00b2 \u2212 48\u00b2) = 14 (or AC = 50 \u00b7 7/25). Traps: `7` unscaled sine numerator (`STOPPED_EARLY`), `24` unscaled cosine numerator (`STOPPED_EARLY`), `48` the wrong leg (`WRONG_SIDE`). Core question: which leg is opposite B, and what ratio gives it?
  - Math text uses unicode (`\u2212`, `\u00b2`, `\u221a`, `\u00b7`), never raw `<`; fractions as plain `a/b`.
- [ ] **Step 4: Run** `node --test tests/` -> PASS for 12-15; the count and spread tests now pass too (all 15 present). If the spread test fails, reorder/adjust difficulty-neutral distractor positions by rewriting which letter holds the correct answer for prose items only (numeric items stay ascending).

### Task 6: Whole-page verification and review

**Files:**
- Modify: any file with a defect found below.

- [ ] **Step 1: Run** `node --test tests/` -> all PASS.
- [ ] **Step 2: Independent content read.** For each of the 15 items (a fresh reader, not the author), solve the question blind, then confirm the stored answer, that each distractor is actually wrong for the stated reason, and that exactly one option is defensible. Record any item changed.
- [ ] **Step 3: Browser walkthrough** at `http://localhost:8000/lessons.html`: answer every item correctly once and incorrectly once (reset between); check keyboard A-D, arrow navigation, bubbles, Session report totals (15 answered), Reset progress, core-question and steps visible after answering, nothing visible before answering.
- [ ] **Step 4: Mobile check.** Emulate 375px width; Expected: no horizontal scroll on items 6 (bullet data table), 10 (bullet notes), 13 (math expressions), and on the steps list.
- [ ] **Step 5: Regression.** Open `index.html`; the 24-item bank loads, filters work, score chip unaffected by lesson answers.

---

## Self-Review

- **Spec coverage:** all 15 types map to Tasks 2-5 with each Format/Purpose constraint turned into a test or a pinned design; the three required parts (Q/options/answer, core question, step-by-step with distractor reasoning) are schema-enforced in Task 1; "interactive, clean, lesson-friendly page" is Task 2 plus Task 6.
- **Type consistency:** `coreQuestion`, `steps`, `renderLessonExtras`, `data-src`, `data-storage`, and the 15 IDs are named identically in every task.
- **Known gap by design:** grammar defensibility (Boundaries) and distractor soundness cannot be machine-checked; Task 6 Step 2 is the explicit independent read.
