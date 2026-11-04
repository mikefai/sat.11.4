(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TestEngine = factory();
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MODULES = [
    { id: "rw-m1", section: "rw", label: "Reading and Writing: Module 1", seconds: 1920, file: "rw-m1.json" },
    { id: "rw-m2", section: "rw", label: "Reading and Writing: Module 2", seconds: 1920, file: "rw-m2.json" },
    { id: "math-m1", section: "math", label: "Math: Module 1", seconds: 2100, file: "math-m1.json" },
    { id: "math-m2", section: "math", label: "Math: Module 2", seconds: 2100, file: "math-m2.json" }
  ];
  var BREAK_SECONDS = 600;

  var SKILL_NAMES = {
    "WIC": "Words in Context",
    "TSP": "Text Structure and Purpose",
    "CTC": "Cross-Text Connections",
    "CID": "Central Ideas and Details",
    "COE-T": "Command of Evidence (Textual)",
    "COE-Q": "Command of Evidence (Quantitative)",
    "INF": "Inferences",
    "BND": "Boundaries",
    "FSS": "Form, Structure, and Sense",
    "TRN": "Transitions",
    "RS": "Rhetorical Synthesis",
    "ALG-1V": "Linear equations in one variable",
    "ALG-LF": "Linear functions",
    "ALG-2V": "Linear equations in two variables",
    "ALG-SYS": "Systems of two linear equations in two variables",
    "ALG-INEQ": "Linear inequalities in one or two variables",
    "ADV-FN": "Nonlinear functions",
    "ADV-EQ": "Nonlinear equations in one variable and systems of equations in two variables",
    "ADV-EXP": "Equivalent expressions",
    "PSD-RATE": "Ratios, rates, proportional relationships, and units",
    "PSD-PCT": "Percentages",
    "PSD-1V": "One-variable data: distributions and measures of center and spread",
    "PSD-2V": "Two-variable data: models and scatterplots",
    "PSD-PROB": "Probability and conditional probability",
    "PSD-INF": "Inference from sample statistics and margin of error",
    "PSD-CLAIM": "Evaluating statistical claims: observational studies and experiments",
    "GEO-AV": "Area and volume",
    "GEO-LAT": "Lines, angles, and triangles",
    "GEO-RT": "Right triangles and trigonometry",
    "GEO-CIR": "Circles"
  };

  var DOMAIN_NAMES = {
    CS: "Craft and Structure",
    II: "Information and Ideas",
    SEC: "Standard English Conventions",
    EOI: "Expression of Ideas",
    ALG: "Algebra",
    ADV: "Advanced Math",
    PSD: "Problem-Solving and Data Analysis",
    GEO: "Geometry and Trigonometry"
  };

  var RW_DOMAIN = {
    WIC: "CS", TSP: "CS", CTC: "CS",
    CID: "II", "COE-T": "II", "COE-Q": "II", INF: "II",
    BND: "SEC", FSS: "SEC", TRN: "EOI", RS: "EOI"
  };

  function domainOf(skill) {
    return RW_DOMAIN[skill] || String(skill).split("-")[0];
  }

  // ---- Blueprint (pinned) ----
  var DIFF = { E: "Easy", M: "Medium", H: "Hard" };

  // "WIC:EEMH" -> four slots; groups in module order
  function rwSlots(spec) {
    var out = [];
    spec.split(" ").forEach(function (g) {
      var p = g.split(":");
      p[1].split("").forEach(function (d) { out.push({ skill: p[0], difficulty: DIFF[d], type: "mc" }); });
    });
    return out;
  }

  // "E ALG", "E PSD-PCT", "M ADV S" in position order
  function mathSlots(spec) {
    return spec.split(",").map(function (t) {
      var p = t.trim().split(" ");
      var slot = { domain: p[1].split("-")[0], difficulty: DIFF[p[0]], type: p[2] === "S" ? "spr" : "mc" };
      if (p[1].indexOf("-") > 0) slot.skill = p[1];
      return slot;
    });
  }

  var BLUEPRINT = {
    "rw-m1": rwSlots("WIC:EEMH TSP:EMH CTC:M CID:EM COE-T:MH COE-Q:EH INF:H BND:EEMM FSS:EMH TRN:EM RS:MHH"),
    "rw-m2": rwSlots("WIC:EMHH TSP:MHH CTC:H CID:MH COE-T:MH COE-Q:EM INF:H BND:EMHH FSS:EMH TRN:MH RS:MMH"),
    "math-m1": mathSlots("E ALG,E PSD-PCT,E ADV,E GEO-AV,E ALG S,E ADV,E ALG,M PSD-1V,M ADV S,M ALG,M GEO-LAT,M ADV," +
      "M ALG S,M ADV,M ALG,H PSD-2V,H ADV S,H GEO-CIR,H ALG,H ADV S,H ALG,H ADV S"),
    "math-m2": mathSlots("E ALG,E PSD-RATE,E ADV S,M ALG,M GEO-RT,M ADV,M ALG S,M PSD-PROB,M ADV,M ALG,M ADV S," +
      "H GEO-AV,H ALG,H ADV,H PSD-INF S,H ALG,H ADV,H GEO-CIR S,H ALG,H ADV,H ALG S,H ADV")
  };

  // ---- Student-produced response ----
  var SPR_RE = /^-?(\d+(\.\d*)?|\.\d+|\d+\/\d+)$/;

  function parseSpr(str) {
    var t = String(str).trim().replace(/−/g, "-");
    if (!SPR_RE.test(t)) return null;
    if (t.indexOf("/") > 0) {
      var f = t.split("/");
      var den = Number(f[1]);
      if (den === 0) return null;
      return { text: t, value: Number(f[0]) / den, dp: -1 };
    }
    return { text: t, value: Number(t), dp: t.indexOf(".") < 0 ? -1 : t.length - t.indexOf(".") - 1 };
  }

  function sprMatches(input, accepted) {
    var p = parseSpr(input);
    if (!p) return false;
    if (p.text.length > (p.text.charAt(0) === "-" ? 6 : 5)) return false;
    var atMax = p.dp >= 0 && p.text.length === (p.text.charAt(0) === "-" ? 6 : 5);
    return accepted.some(function (a) {
      var q = parseSpr(a);
      if (!q) return false;
      if (Math.abs(p.value - q.value) < 1e-9) return true;
      if (!atMax) return false;
      var k = Math.pow(10, p.dp), abs = Math.abs(q.value), sign = q.value < 0 ? -1 : 1;
      var trunc = sign * Math.floor(abs * k + 1e-9) / k;
      var rounded = sign * Math.round(abs * k) / k;
      return Math.abs(p.value - trunc) < 1e-9 || Math.abs(p.value - rounded) < 1e-9;
    });
  }

  function isCorrect(item, response) {
    if (response === null || response === undefined) return false;
    if (item.type === "spr") return sprMatches(response, item.acceptedAnswers || []);
    return response === item.correctAnswer;
  }

  // ---- Session (every function returns a new object) ----
  function clone(s) {
    return {
      phase: s.phase,
      moduleIndex: s.moduleIndex,
      position: s.position,
      responses: Object.assign({}, s.responses),
      marked: Object.assign({}, s.marked),
      remaining: Object.assign({}, s.remaining),
      breakRemaining: s.breakRemaining
    };
  }

  function newSession() {
    var remaining = {};
    MODULES.forEach(function (m) { remaining[m.id] = m.seconds; });
    return { phase: "intro", moduleIndex: 0, position: 0, responses: {}, marked: {}, remaining: remaining, breakRemaining: BREAK_SECONDS };
  }

  function start(s) {
    var n = clone(s);
    n.phase = "module";
    n.moduleIndex = 0;
    n.position = 0;
    return n;
  }

  function isCurrent(s, moduleId) {
    return s.phase === "module" && MODULES[s.moduleIndex].id === moduleId;
  }

  function setResponse(s, moduleId, itemId, value) {
    var n = clone(s);
    if (isCurrent(s, moduleId)) n.responses[itemId] = value;
    return n;
  }

  function toggleMark(s, moduleId, itemId) {
    var n = clone(s);
    if (isCurrent(s, moduleId)) {
      if (n.marked[itemId]) delete n.marked[itemId];
      else n.marked[itemId] = true;
    }
    return n;
  }

  function goTo(s, position) {
    var n = clone(s);
    n.position = Math.max(0, position);
    return n;
  }

  function submitModule(s) {
    var n = clone(s);
    n.position = 0;
    if (s.moduleIndex >= MODULES.length - 1) n.phase = "results";
    else if (s.moduleIndex === 1) { n.phase = "break"; n.moduleIndex = 2; }
    else n.moduleIndex = s.moduleIndex + 1;
    return n;
  }

  function endBreak(s) {
    var n = clone(s);
    n.phase = "module";
    n.position = 0;
    return n;
  }

  function tick(s, seconds) {
    var n = clone(s);
    if (s.phase === "module") {
      var id = MODULES[s.moduleIndex].id;
      n.remaining[id] = Math.max(0, s.remaining[id] - seconds);
      return n.remaining[id] === 0 ? submitModule(n) : n;
    }
    if (s.phase === "break") {
      n.breakRemaining = Math.max(0, s.breakRemaining - seconds);
      return n.breakRemaining === 0 ? endBreak(n) : n;
    }
    return n;
  }

  function summarize(s, forms) {
    var out = { sections: { rw: { correct: 0, total: 0 }, math: { correct: 0, total: 0 } }, modules: {}, domains: {} };
    function add(bucket, key, ok) {
      var b = bucket[key] || (bucket[key] = { correct: 0, total: 0 });
      b.total++;
      if (ok) b.correct++;
    }
    MODULES.forEach(function (m) {
      (forms[m.id] || []).forEach(function (item) {
        var ok = isCorrect(item, s.responses[item.id] === undefined ? null : s.responses[item.id]);
        add(out.sections, m.section, ok);
        add(out.modules, m.id, ok);
        add(out.domains, domainOf(item.skill), ok);
      });
    });
    return out;
  }

  return {
    MODULES: MODULES, BREAK_SECONDS: BREAK_SECONDS, BLUEPRINT: BLUEPRINT,
    SKILL_NAMES: SKILL_NAMES, DOMAIN_NAMES: DOMAIN_NAMES, domainOf: domainOf,
    sprMatches: sprMatches, isCorrect: isCorrect,
    newSession: newSession, start: start, setResponse: setResponse, toggleMark: toggleMark,
    goTo: goTo, submitModule: submitModule, tick: tick, endBreak: endBreak, summarize: summarize
  };
}));
