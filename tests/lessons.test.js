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

module.exports = { items, get, wc };
