"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const items = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "lessons.json"), "utf8"));
const get = id => items.find(i => i.id === id);
const wc = s => s.trim().split(/\s+/).filter(Boolean).length;

const IDS = [
  "LESSON-01-WIC", "LESSON-02-TSP", "LESSON-03-CTC", "LESSON-04-CID", "LESSON-05-COE-TEXT",
  "LESSON-06-COE-QUANT", "LESSON-07-INF", "LESSON-08-BND", "LESSON-09-FSS", "LESSON-10-RS",
  "LESSON-11-TRN", "LESSON-12-LIN", "LESSON-13-EQX", "LESSON-14-CPR", "LESSON-15-TRG"
];

test("ids are unique", () => {
  const ids = items.map(i => i.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("domain is allowed", () => {
  for (const i of items) assert.ok(["Reading and Writing", "Math"].includes(i.domain), i.id);
});

test("choices are well formed", () => {
  for (const i of items) {
    assert.equal(i.choices.map(c => c.letter).join(""), "ABCD", i.id);
    const correct = i.choices.filter(c => c.isCorrect);
    assert.equal(correct.length, 1, i.id);
    assert.equal(correct[0].letter, i.correctAnswer, i.id);
    for (const c of i.choices) {
      assert.ok(typeof c.rationale === "string" && c.rationale.trim(), i.id + c.letter + " rationale");
      assert.match(c.trapType, /^[A-Z_]+$/, i.id + c.letter);
      assert.equal(c.trapType === "NONE", c.isCorrect, i.id + c.letter + " trapType NONE iff correct");
    }
  }
});

test("coreQuestion, steps and studyNote present", () => {
  for (const i of items) {
    assert.ok(typeof i.coreQuestion === "string" && i.coreQuestion.length >= 20, i.id + " coreQuestion");
    assert.ok(Array.isArray(i.steps) && i.steps.length >= 3, i.id + " steps");
    for (const s of i.steps) assert.ok(typeof s === "string" && s.trim(), i.id + " step");
    assert.deepEqual(
      Object.keys(i.studyNote).sort(),
      ["keyVocabularyOrFormulas", "ruleOrPrinciple", "strategicShortcut", "trapAlert"],
      i.id
    );
  }
});

test("markup is safe", () => {
  for (const i of items) {
    const s = JSON.stringify(i).replace(/<\/?sup>/g, "");
    assert.ok(!/[<&]/.test(s), i.id + " contains < or &");
  }
});

test("correct choice is not the unique longest", () => {
  for (const i of items.filter(x => x.domain === "Reading and Writing")) {
    const lens = i.choices.map(c => c.text.length);
    if (lens.reduce((a, b) => a + b, 0) / lens.length <= 25) continue;
    const correct = i.choices.find(c => c.isCorrect).text.length;
    const others = i.choices.filter(c => !c.isCorrect).map(c => c.text.length);
    assert.ok(!others.every(n => correct > n), i.id + " correct choice is unique longest");
  }
});

test("15 items in brief order", () => {
  assert.deepEqual(items.map(i => i.id), IDS);
});

test("correct letters are spread", () => {
  for (const L of "ABCD") {
    const n = items.filter(i => i.correctAnswer === L).length;
    assert.ok(n >= 2 && n <= 6, L + " is the answer " + n + " times");
  }
});

test("WIC seed item", () => {
  const q = get("LESSON-01-WIC");
  assert.ok(q, "LESSON-01-WIC exists");
  const n = wc(q.stimulus);
  assert.ok(n >= 40 && n <= 80, "stimulus word count " + n);
  assert.ok(q.stimulus.includes("______"));
  assert.equal(q.choices.length, 4);
  for (const c of q.choices) assert.equal(wc(c.text), 1, c.letter + " single word");
});

test("TSP item", () => {
  const q = get("LESSON-02-TSP");
  assert.ok(q, "LESSON-02-TSP exists");
  const n = wc(q.stimulus);
  assert.ok(n >= 60 && n <= 120, "stimulus word count " + n);
  assert.match(q.questionStem, /structure|purpose|function/i);
});

test("CTC item", () => {
  const q = get("LESSON-03-CTC");
  assert.ok(q, "LESSON-03-CTC exists");
  assert.ok(q.stimulus.includes("Text 1:") && q.stimulus.includes("Text 2:"));
  const [t1, t2] = q.stimulus.split("Text 1:")[1].split("Text 2:");
  for (const t of [t1, t2]) {
    const n = wc(t);
    assert.ok(n >= 40 && n <= 80, "text word count " + n);
  }
  assert.match(q.questionStem, /Text 2/);
  assert.match(q.questionStem, /respond/i);
});

test("CID item", () => {
  const q = get("LESSON-04-CID");
  assert.ok(q, "LESSON-04-CID exists");
  const n = wc(q.stimulus);
  assert.ok(n >= 60 && n <= 100, "stimulus word count " + n);
});

test("COE-TEXT item", () => {
  const q = get("LESSON-05-COE-TEXT");
  assert.ok(q, "LESSON-05-COE-TEXT exists");
  for (const c of q.choices) assert.ok(c.text.startsWith("\"") && c.text.endsWith("\""), c.letter + " is a direct quote");
  assert.match(q.questionStem, /support|weaken/i);
});

test("COE-QUANT item", () => {
  const q = get("LESSON-06-COE-QUANT");
  assert.ok(q, "LESSON-06-COE-QUANT exists");
  const bullets = q.stimulus.split("\n").filter(l => l.startsWith("•"));
  assert.ok(bullets.length >= 3, "bullet rows " + bullets.length);
  for (const c of q.choices) assert.match(c.text, /\d/, c.letter + " cites a number");
});

test("INF item", () => {
  const q = get("LESSON-07-INF");
  assert.ok(q, "LESSON-07-INF exists");
  assert.match(q.questionStem, /logically|conclusion|follows/i);
});

test("BND item", () => {
  const q = get("LESSON-08-BND");
  assert.ok(q, "LESSON-08-BND exists");
  assert.ok(q.stimulus.includes("______"));
  const texts = q.choices.map(c => c.text).join(" ");
  for (const mark of [";", ":", "."]) assert.ok(texts.includes(mark), "choices use " + mark);
  assert.match(q.questionStem, /Standard English/);
});

test("FSS item", () => {
  const q = get("LESSON-09-FSS");
  assert.ok(q, "LESSON-09-FSS exists");
  assert.ok(q.stimulus.includes("______"));
  assert.match(q.questionStem, /Standard English/);
});

test("RS item", () => {
  const q = get("LESSON-10-RS");
  assert.ok(q, "LESSON-10-RS exists");
  const bullets = q.stimulus.split("\n").filter(l => l.startsWith("•"));
  assert.ok(bullets.length >= 4 && bullets.length <= 6, "bullet notes " + bullets.length);
  assert.match(q.questionStem, /wants to/);
  const correct = q.choices.find(c => c.isCorrect).text;
  assert.ok((correct.match(/\.(\s|$)/g) || []).length <= 1, "correct choice is one sentence");
});

test("TRN item", () => {
  const q = get("LESSON-11-TRN");
  assert.ok(q, "LESSON-11-TRN exists");
  const texts = q.choices.map(c => c.text.trim().toLowerCase());
  for (const group of [["however", "nevertheless"], ["therefore", "as a result", "consequently"], ["furthermore", "moreover", "in addition"]]) {
    assert.ok(texts.some(t => group.includes(t)), "choices include one of " + group.join("/"));
  }
  assert.match(q.stimulus, /\.\s+______,/);
});

module.exports = { items, get, wc };
