"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../test-engine.js");

const snap = s => JSON.parse(JSON.stringify(s));
const count = (arr, f) => arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});

test("modules and break", () => {
  assert.deepEqual(E.MODULES.map(m => m.id), ["rw-m1", "rw-m2", "math-m1", "math-m2"]);
  assert.deepEqual(E.MODULES.map(m => m.seconds), [1920, 1920, 2100, 2100]);
  assert.equal(E.MODULES[0].label, "Reading and Writing: Module 1");
  assert.equal(E.MODULES[3].label, "Math: Module 2");
  assert.equal(E.MODULES[2].file, "math-m1.json");
  assert.equal(E.MODULES[2].section, "math");
  assert.equal(E.BREAK_SECONDS, 600);
});

test("blueprint counts", () => {
  const B = E.BLUEPRINT;
  assert.deepEqual(["rw-m1", "rw-m2", "math-m1", "math-m2"].map(k => B[k].length), [27, 27, 22, 22]);
  const skills = { WIC: 4, TSP: 3, CTC: 1, CID: 2, "COE-T": 2, "COE-Q": 2, INF: 1, BND: 4, FSS: 3, TRN: 2, RS: 3 };
  ["rw-m1", "rw-m2"].forEach(k => {
    assert.deepEqual(count(B[k], x => x.skill), skills);
    assert.ok(B[k].every(x => x.type === "mc"));
  });
  assert.deepEqual(count(B["rw-m1"], x => x.difficulty), { Easy: 9, Medium: 10, Hard: 8 });
  assert.deepEqual(count(B["rw-m2"], x => x.difficulty), { Easy: 4, Medium: 10, Hard: 13 });
  assert.deepEqual(B["rw-m1"].slice(0, 4).map(x => x.difficulty), ["Easy", "Easy", "Medium", "Hard"]);
  ["math-m1", "math-m2"].forEach(k => {
    assert.deepEqual(count(B[k], x => x.domain), { ALG: 8, ADV: 8, PSD: 3, GEO: 3 });
    assert.equal(B[k].filter(x => x.type === "spr").length, 6);
  });
  assert.deepEqual(count(B["math-m1"], x => x.difficulty), { Easy: 7, Medium: 8, Hard: 7 });
  assert.deepEqual(count(B["math-m2"], x => x.difficulty), { Easy: 3, Medium: 8, Hard: 11 });
});

test("blueprint PSD/GEO skills (R1)", () => {
  const pick = (k, pos) => E.BLUEPRINT[k][pos - 1].skill;
  assert.deepEqual([2, 8, 16, 4, 11, 18].map(p => pick("math-m1", p)),
    ["PSD-PCT", "PSD-1V", "PSD-2V", "GEO-AV", "GEO-LAT", "GEO-CIR"]);
  assert.deepEqual([2, 8, 15, 5, 12, 18].map(p => pick("math-m2", p)),
    ["PSD-RATE", "PSD-PROB", "PSD-INF", "GEO-RT", "GEO-AV", "GEO-CIR"]);
  ["math-m1", "math-m2"].forEach(k => E.BLUEPRINT[k].forEach(x => {
    if (x.domain === "PSD" || x.domain === "GEO") assert.ok(x.skill && x.skill.indexOf(x.domain) === 0);
  }));
});

test("domainOf and names", () => {
  const m = { WIC: "CS", TSP: "CS", CTC: "CS", CID: "II", "COE-T": "II", "COE-Q": "II", INF: "II",
    BND: "SEC", FSS: "SEC", TRN: "EOI", RS: "EOI", "ALG-1V": "ALG", "ADV-EXP": "ADV", "PSD-PCT": "PSD", "GEO-CIR": "GEO" };
  Object.keys(m).forEach(k => assert.equal(E.domainOf(k), m[k], k));
  assert.equal(E.SKILL_NAMES.WIC, "Words in Context");
  assert.equal(E.SKILL_NAMES["GEO-AV"], "Area and volume");
  assert.equal(E.DOMAIN_NAMES.CS, "Craft and Structure");
  assert.equal(E.DOMAIN_NAMES.GEO, "Geometry and Trigonometry");
});

test("sprMatches", () => {
  const t = (acc, yes, no) => {
    yes.forEach(v => assert.equal(E.sprMatches(v, acc), true, acc + " yes " + v));
    no.forEach(v => assert.equal(E.sprMatches(v, acc), false, acc + " no " + v));
  };
  t(["2/3"], ["2/3", ".6666", ".6667", "0.666", "0.667", "4/6", " 2/3 "], ["0.66", ".67", "0.6667", "0.6"]);
  t(["-1/3"], ["-1/3", "−1/3", "-.3333", "-0.333"], ["-0.33"]);
  t(["3.5"], ["7/2", "3.50"], ["3 1/2"]);
  t(["12"], ["12", "12.0"], ["+12", "1/0", "", "abc"]);
  t(["5", "-5"], ["-5"], []);
  t(["0.25"], ["1/4"], []);
});

test("isCorrect", () => {
  const mc = { type: "mc", correctAnswer: "B" };
  assert.equal(E.isCorrect(mc, "B"), true);
  assert.equal(E.isCorrect(mc, "C"), false);
  assert.equal(E.isCorrect(mc, null), false);
  const spr = { type: "spr", acceptedAnswers: ["2/3"] };
  assert.equal(E.isCorrect(spr, ".6667"), true);
  assert.equal(E.isCorrect(spr, null), false);
});

test("flow", () => {
  let s = E.newSession();
  assert.equal(s.phase, "intro");
  assert.equal(s.breakRemaining, 600);
  assert.deepEqual(s.remaining, { "rw-m1": 1920, "rw-m2": 1920, "math-m1": 2100, "math-m2": 2100 });
  s = E.start(s);
  assert.equal(s.phase, "module");
  assert.equal(s.moduleIndex, 0);
  s = E.submitModule(E.goTo(s, 5));
  assert.equal(s.moduleIndex, 1);
  assert.equal(s.position, 0);
  assert.equal(s.phase, "module");
  s = E.submitModule(s);
  assert.equal(s.phase, "break");
  s = E.endBreak(s);
  assert.equal(s.phase, "module");
  assert.equal(s.moduleIndex, 2);
  s = E.submitModule(s);
  assert.equal(s.phase, "module");
  s = E.submitModule(s);
  assert.equal(s.phase, "results");
});

test("goTo clamps, marks toggle, responses", () => {
  let s = E.start(E.newSession());
  assert.equal(E.goTo(s, -3).position, 0);
  s = E.setResponse(s, "rw-m1", "RW1-01", "A");
  assert.equal(s.responses["RW1-01"], "A");
  s = E.toggleMark(s, "rw-m1", "RW1-01");
  assert.deepEqual(s.marked, { "RW1-01": true });
  s = E.toggleMark(s, "rw-m1", "RW1-01");
  assert.deepEqual(s.marked, {});
});

test("tick to zero submits, keeps responses", () => {
  let s = E.setResponse(E.start(E.newSession()), "rw-m1", "RW1-01", "A");
  s = E.tick(s, 1000);
  assert.equal(s.remaining["rw-m1"], 920);
  assert.equal(s.moduleIndex, 0);
  s = E.tick(s, 920);
  assert.equal(s.moduleIndex, 1);
  assert.equal(s.responses["RW1-01"], "A");
  assert.equal(s.remaining["rw-m1"], 0);
});

test("tick in break counts down and auto ends", () => {
  let s = E.submitModule(E.submitModule(E.start(E.newSession())));
  s = E.tick(s, 100);
  assert.equal(s.phase, "break");
  assert.equal(s.breakRemaining, 500);
  s = E.tick(s, 500);
  assert.equal(s.phase, "module");
  assert.equal(s.moduleIndex, 2);
});

test("tick elsewhere is a no-op", () => {
  const s = E.newSession();
  assert.deepEqual(E.tick(s, 50), s);
});

test("setResponse ignores non-current module", () => {
  const s = E.submitModule(E.start(E.newSession()));
  assert.deepEqual(E.setResponse(s, "rw-m1", "RW1-01", "A"), s);
  assert.deepEqual(E.toggleMark(s, "rw-m1", "RW1-01"), s);
  const i = E.newSession();
  assert.deepEqual(E.setResponse(i, "rw-m1", "RW1-01", "A"), i);
});

test("immutability", () => {
  const check = (s, f) => { const before = snap(s); const out = f(s); assert.deepEqual(snap(s), before); assert.notEqual(out, s); return out; };
  const intro = E.newSession();
  let s = check(intro, E.start);
  s = E.setResponse(s, "rw-m1", "RW1-01", "A");
  check(s, x => E.setResponse(x, "rw-m1", "RW1-02", "B"));
  check(s, x => E.setResponse(x, "math-m1", "M1-01", "B"));
  check(s, x => E.toggleMark(x, "rw-m1", "RW1-01"));
  check(s, x => E.goTo(x, 4));
  check(s, x => E.tick(x, 10));
  check(s, x => E.tick(x, 5000));
  check(intro, x => E.tick(x, 5));
  const brk = check(s, x => E.submitModule(E.submitModule(x)));
  check(brk, E.endBreak);
  check(brk, x => E.tick(x, 600));
});

test("summarize", () => {
  const forms = {
    "rw-m1": [
      { id: "a", section: "rw", skill: "WIC", type: "mc", correctAnswer: "A" },
      { id: "b", section: "rw", skill: "BND", type: "mc", correctAnswer: "B" }
    ],
    "math-m1": [
      { id: "c", section: "math", skill: "ALG-1V", type: "spr", acceptedAnswers: ["3"] },
      { id: "d", section: "math", skill: "GEO-CIR", type: "mc", correctAnswer: "C" }
    ]
  };
  const s = snap(E.newSession());
  s.responses = { a: "A", b: "C", c: "3.0" };
  const r = E.summarize(s, forms);
  assert.deepEqual(r.sections, { rw: { correct: 1, total: 2 }, math: { correct: 1, total: 2 } });
  assert.deepEqual(r.modules["rw-m1"], { correct: 1, total: 2 });
  assert.deepEqual(r.modules["math-m1"], { correct: 1, total: 2 });
  assert.deepEqual(r.domains, {
    CS: { correct: 1, total: 1 }, SEC: { correct: 0, total: 1 },
    ALG: { correct: 1, total: 1 }, GEO: { correct: 0, total: 1 }
  });
});
