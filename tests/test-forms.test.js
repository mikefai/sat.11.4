"use strict";
var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var E = require("../test-engine.js");

var ROOT = path.join(__dirname, "..");
function load(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); }

var FORMS = {};
E.MODULES.forEach(function (m) { FORMS[m.id] = load("test/" + m.file); });

var PREFIX = { "rw-m1": "RW1", "rw-m2": "RW2", "math-m1": "M1", "math-m2": "M2" };
var TOPICS = ["literature", "history", "humanities", "science"];
var STEMS = {
  "WIC": /most logical and precise word or phrase|most nearly mean/i,
  "TSP": /function of the underlined|overall structure|main purpose/i,
  "CTC": /Based on the texts/i,
  "CID": /main idea|According to the text|Based on the text/i,
  "COE-T": /most directly support|most directly weaken|most effectively illustrates/i,
  "COE-Q": /data from the table/i,
  "INF": /most logically completes the text/i,
  "BND": /conforms to the conventions of Standard English/i,
  "FSS": /conforms to the conventions of Standard English/i,
  "TRN": /most logical transition/i,
  "RS": /relevant information from the notes/i
};
var BAD_TRAPS = ["HALF_RIGHT_ALL_WRONG", "CONFIRMATION_BIAS"];

// ---- numeric choice parsing (ruling R2) ----
function numValue(text) {
  var s = String(text).trim().replace(/−/g, "-");
  var neg = false, m;
  if (s.charAt(0) === "-") { neg = true; s = s.slice(1).trim(); }
  if (s.charAt(0) === "$") s = s.slice(1).trim();
  if (s.charAt(0) === "-") { neg = true; s = s.slice(1).trim(); }
  if (/%$/.test(s)) s = s.slice(0, -1).trim();
  var mult = 1;
  if (/π$/.test(s)) { mult = Math.PI; s = s.slice(0, -1).trim(); }
  else if ((m = /^(.*?)√(\d+)$/.exec(s))) { mult = Math.sqrt(Number(m[2])); s = m[1].trim(); }
  if (s === "" && mult !== 1) s = "1";
  var v;
  if (/^\d+\/\d+$/.test(s)) {
    var f = s.split("/");
    if (Number(f[1]) === 0) return null;
    v = Number(f[0]) / Number(f[1]);
  } else if (/^(\d+(\.\d*)?|\.\d+)$/.test(s)) v = Number(s);
  else return null;
  return (neg ? -1 : 1) * v * mult;
}

test("numValue helper", function () {
  assert.equal(numValue("12"), 12);
  assert.equal(numValue("−3.5"), -3.5);
  assert.equal(numValue("-1/2"), -0.5);
  assert.equal(numValue("$4.50"), 4.5);
  assert.equal(numValue("25%"), 25);
  assert.ok(Math.abs(numValue("3π") - 3 * Math.PI) < 1e-12);
  assert.ok(Math.abs(numValue("6√3") - 6 * Math.sqrt(3)) < 1e-12);
  assert.equal(numValue("x + 2"), null);
  assert.equal(numValue("3x"), null);
  assert.equal(numValue("1/0"), null);
});

// ---- helpers ----
function strings(v, out) {
  out = out || [];
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach(function (x) { strings(x, out); });
  else if (v && typeof v === "object") Object.keys(v).forEach(function (k) { strings(v[k], out); });
  return out;
}
function words(s) { return s.split(/\s+/).filter(Boolean).length; }
function norm(s) { return String(s).trim().replace(/\s+/g, " ").toLowerCase(); }
function isStr(x) { return typeof x === "string" && x.trim() !== ""; }

function rwProblems(item, p) {
  var st = item.stimulus || "";
  if (TOPICS.indexOf(item.topic) < 0) p.push("topic not in set");
  if (item.type !== "mc") p.push("RW item must be mc");
  if (item.skill === "CTC") {
    var a = st.indexOf("Text 1:"), b = st.indexOf("Text 2:");
    if (a < 0 || b < 0 || a > b) p.push("CTC needs Text 1: then Text 2:");
    else [st.slice(a + 7, b), st.slice(b + 7)].forEach(function (t, i) {
      var n = words(t);
      if (n < 25 || n > 150) p.push("CTC text " + (i + 1) + " has " + n + " words");
    });
  } else {
    var n = words(st);
    if (n < 25 || n > 150) p.push("stimulus has " + n + " words");
  }
  var re = STEMS[item.skill];
  if (!re) p.push("unknown RW skill " + item.skill);
  else if (!re.test(item.questionStem || "")) p.push("stem does not match " + item.skill + " pattern");
  if (item.skill === "COE-Q" && !item.table) p.push("COE-Q needs a table");
  if (item.skill === "RS") {
    var bullets = st.split("\n").filter(function (l) { return l.indexOf("•") === 0; }).length;
    if (bullets < 4 || bullets > 6) p.push("RS has " + bullets + " bullets");
  }
  if (Array.isArray(item.choices) && item.choices.length === 4) {
    var lens = item.choices.map(function (c) { return String(c.text).length; });
    var mean = lens.reduce(function (x, y) { return x + y; }, 0) / 4;
    var ci = item.choices.findIndex(function (c) { return c.isCorrect; });
    if (mean > 25 && ci >= 0 && lens.every(function (l, i) { return i === ci || l < lens[ci]; })) {
      p.push("correct choice is the unique longest");
    }
  }
}

function mcProblems(item, p) {
  var ch = item.choices;
  if (!Array.isArray(ch) || ch.length !== 4) { p.push("needs 4 choices"); return; }
  ch.forEach(function (c, i) {
    if (c.letter !== "ABCD".charAt(i)) p.push("choice " + i + " letter");
    if (!isStr(c.text)) p.push("choice " + c.letter + " text");
    if (typeof c.isCorrect !== "boolean") p.push("choice " + c.letter + " isCorrect");
    if (!isStr(c.rationale)) p.push("choice " + c.letter + " rationale");
    if (c.isCorrect) {
      if (c.trapType !== "NONE") p.push("correct choice trapType must be NONE");
    } else if (!/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(c.trapType) || c.trapType === "NONE" || BAD_TRAPS.indexOf(c.trapType) >= 0) {
      p.push("choice " + c.letter + " bad trapType " + c.trapType);
    }
  });
  var correct = ch.filter(function (c) { return c.isCorrect; });
  if (correct.length !== 1) p.push("needs exactly one correct choice");
  else if (item.correctAnswer !== correct[0].letter) p.push("correctAnswer does not match");
  if (item.section === "math") {
    var vals = ch.map(function (c) { return numValue(c.text); });
    var allNum = vals.every(function (v) { return v !== null; });
    if (allNum && !vals.every(function (v, i) { return i === 0 || v > vals[i - 1]; })) p.push("numeric choices not ascending");
  }
}

function sprProblems(item, p) {
  var acc = item.acceptedAnswers;
  if (!Array.isArray(acc) || acc.length < 1) { p.push("acceptedAnswers missing"); return; }
  acc.forEach(function (a) { if (!E.sprMatches(a, acc)) p.push("accepted answer not enterable: " + a); });
  var ce = item.commonErrors;
  if (!Array.isArray(ce) || ce.length < 2) { p.push("needs >= 2 commonErrors"); return; }
  ce.forEach(function (c) {
    if (!isStr(c.why)) p.push("commonError why");
    if (E.sprMatches(c.value, acc)) p.push("commonError value is accepted: " + c.value);
  });
}

function itemProblems(item, section) {
  var p = [];
  if (!isStr(item.id)) p.push("id");
  if (item.section !== section) p.push("section should be " + section);
  if (!E.SKILL_NAMES[item.skill]) p.push("unknown skill " + item.skill);
  if (["Easy", "Medium", "Hard"].indexOf(item.difficulty) < 0) p.push("difficulty");
  if (["mc", "spr"].indexOf(item.type) < 0) p.push("type");
  if (!isStr(item.stimulus)) p.push("stimulus");
  if (!isStr(item.questionStem)) p.push("questionStem");
  if (!isStr(item.coreQuestion) || item.coreQuestion.length < 20) p.push("coreQuestion >= 20 chars");
  if (!Array.isArray(item.steps) || item.steps.length < 3 || !item.steps.every(isStr)) p.push("steps >= 3 strings");
  if (item.type === "mc") mcProblems(item, p);
  if (item.type === "spr") sprProblems(item, p);
  strings(item).forEach(function (s) {
    if (/[<&]/.test(s.replace(/<\/?(sup|u)>/g, ""))) p.push("bad markup in: " + s.slice(0, 40));
  });
  if (item.table) {
    var t = item.table;
    if (!Array.isArray(t.headers) || !Array.isArray(t.rows)) p.push("table shape");
    else t.rows.forEach(function (r, i) {
      if (!Array.isArray(r) || r.length !== t.headers.length) p.push("table row " + i + " length");
    });
  }
  var visible = strings([item.stimulus, item.questionStem, item.table,
    (item.choices || []).map(function (c) { return c.text; })]);
  if (visible.some(function (s) { return /\bfigure\b|diagram|graph (shown|above|below)/i.test(s); })) p.push("references a figure");
  if (section === "rw") rwProblems(item, p);
  return p;
}

function report(items, section) {
  var out = [];
  items.forEach(function (it) {
    itemProblems(it, section).forEach(function (m) { out.push(it.id + ": " + m); });
  });
  return out;
}

// ---- per-module tests ----
E.MODULES.forEach(function (mod) {
  var form = FORMS[mod.id];

  test(mod.id + ": present items match Blueprint slots", function () {
    var bad = [];
    form.forEach(function (it, i) {
      var slot = E.BLUEPRINT[mod.id][i];
      var want = PREFIX[mod.id] + "-" + (i < 9 ? "0" : "") + (i + 1);
      if (!slot) { bad.push(want + ": beyond blueprint"); return; }
      if (it.id !== want) bad.push(it.id + ": id should be " + want);
      if (it.difficulty !== slot.difficulty) bad.push(want + ": difficulty " + it.difficulty + " != " + slot.difficulty);
      if (it.type !== slot.type) bad.push(want + ": type " + it.type + " != " + slot.type);
      if (mod.section === "rw") {
        if (it.skill !== slot.skill) bad.push(want + ": skill " + it.skill + " != " + slot.skill);
      } else {
        if (E.domainOf(it.skill) !== slot.domain) bad.push(want + ": domain " + E.domainOf(it.skill) + " != " + slot.domain);
        if (slot.skill && it.skill !== slot.skill) bad.push(want + ": skill " + it.skill + " != " + slot.skill);
      }
    });
    assert.deepEqual(bad, []);
  });

  test(mod.id + ": present items satisfy invariants", function () {
    assert.deepEqual(report(form, mod.section), []);
  });

  test(mod.id + ": fixture has 2 valid items", function () {
    var fx = load("test/fixtures/" + mod.file);
    assert.equal(fx.length, 2);
    assert.deepEqual(report(fx, mod.section), []);
    if (mod.section === "rw") {
      assert.notEqual(fx[0].skill, fx[1].skill);
      assert.notEqual(fx[0].topic, fx[1].topic);
    } else {
      assert.deepEqual(fx.map(function (i) { return i.type; }).sort(), ["mc", "spr"]);
    }
  });

  // ---- complete-form tests (intentionally red until the form is full) ----
  var n = E.BLUEPRINT[mod.id].length;
  test("complete: " + mod.id + " has " + n + " items", function () {
    assert.equal(form.length, n);
  });

  if (mod.section === "rw") {
    test("complete: " + mod.id + " has >= 5 items per topic", function () {
      var c = {};
      TOPICS.forEach(function (t) { c[t] = 0; });
      form.forEach(function (it) { if (it.topic in c) c[it.topic]++; });
      TOPICS.forEach(function (t) { assert.ok(c[t] >= 5, t + " has " + c[t]); });
    });
  }

  test("complete: " + mod.id + " correct-letter spread", function () {
    var lo = mod.section === "rw" ? 4 : 2, hi = mod.section === "rw" ? 9 : 6;
    var c = { A: 0, B: 0, C: 0, D: 0 };
    form.forEach(function (it) { if (it.type === "mc" && it.correctAnswer in c) c[it.correctAnswer]++; });
    assert.ok(form.length > 0, "form is empty");
    Object.keys(c).forEach(function (l) {
      assert.ok(c[l] >= lo && c[l] <= hi, l + " appears " + c[l] + " times (want " + lo + "-" + hi + ")");
    });
  });
});

test("complete: math ALG skills >= 2 and ADV skills >= 4 across both modules", function () {
  var all = FORMS["math-m1"].concat(FORMS["math-m2"]);
  Object.keys(E.SKILL_NAMES).forEach(function (code) {
    var need = code.indexOf("ALG-") === 0 ? 2 : code.indexOf("ADV-") === 0 ? 4 : 0;
    if (!need) return;
    var c = all.filter(function (it) { return it.skill === code; }).length;
    assert.ok(c >= need, code + " has " + c + ", needs " + need);
  });
});

test("no duplicate stimulus across forms, lessons.json and questions.json", function () {
  var external = {};
  ["lessons.json", "questions.json"].forEach(function (f) {
    load(f).forEach(function (q) { if (q.stimulus) external[norm(q.stimulus)] = f + " " + q.id; });
  });
  var seen = {}, dups = [];
  E.MODULES.forEach(function (m) {
    FORMS[m.id].forEach(function (it) {
      var k = norm(it.stimulus);
      if (external[k]) dups.push(it.id + " duplicates " + external[k]);
      if (seen[k]) dups.push(it.id + " duplicates " + seen[k]);
      seen[k] = it.id;
    });
  });
  assert.deepEqual(dups, []);
});
