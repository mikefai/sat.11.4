(function () {
  var E = window.TestEngine;
  var R = window.ItemRender;
  var STORE_KEY = "dsat-fulltest-v1";
  var CALC_URL = "https://www.desmos.com/calculator";

  var params = new URLSearchParams(location.search);
  var base = /^[\w\/-]+\/$/.test(params.get("base") || "") ? params.get("base") : "test/";

  var app = document.getElementById("app");
  var forms = {};
  var problems = [];   // modules whose form is missing or empty
  var session = null;
  var navOpen = false;
  var lastTick = 0;
  var timerId = null;

  // ---------- storage (every access guarded) ----------

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ base: base, session: session })); } catch (e) {}
  }

  function loadSaved() {
    try {
      var d = JSON.parse(localStorage.getItem(STORE_KEY));
      var s = d && d.base === base && d.session;
      if (s && ["intro", "module", "break", "results"].indexOf(s.phase) >= 0 &&
          E.MODULES[s.moduleIndex] && s.responses && s.marked && s.remaining &&
          typeof s.position === "number" && typeof s.breakRemaining === "number") return s;
    } catch (e) {}
    return null;
  }

  function clearSaved() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  // ---------- helpers ----------

  function clock(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function curModule() { return E.MODULES[session.moduleIndex]; }
  function curItems() { return forms[curModule().id]; }

  function answered(item) {
    var v = session.responses[item.id];
    return v !== undefined && v !== null && String(v).trim() !== "";
  }

  function commit(next) {
    session = next;
    save();
    render();
  }

  // ---------- screens ----------

  function renderIntro() {
    var rows = ["rw", "math"].map(function (sec) {
      var mods = E.MODULES.filter(function (m) { return m.section === sec; });
      var q = 0, min = 0;
      mods.forEach(function (m) { q += E.BLUEPRINT[m.id].length; min += m.seconds / 60; });
      return "<tr><td>" + (sec === "rw" ? "Reading and Writing" : "Math") + "</td><td>" + mods.length +
        "</td><td>" + q + "</td><td>" + min + "</td></tr>";
    }).join("");
    var saved = loadSaved();
    var ready = !problems.length;
    var html = '<section class="tm-card"><h1>DSAT Full-Length Practice Test</h1>' +
      '<table class="data-table tm-overview"><thead><tr><th>Section</th><th>Modules</th><th>Questions</th><th>Minutes</th></tr></thead><tbody>' +
      rows + "</tbody></table>" +
      "<p>There is a " + E.BREAK_SECONDS / 60 + "-minute break between Reading and Writing and Math.</p>" +
      "<p>Directions: each module is timed. You can move freely and change answers within a module, and mark questions for review. " +
      "When you submit a module, or when time runs out, you cannot go back to it. Answers are shown only after the test ends. Your progress is saved in this browser.</p>";
    if (!ready) {
      html += '<p class="tm-error" role="alert">The test forms are not ready yet:</p><ul class="tm-error">' +
        problems.map(function (p) { return "<li>" + p + "</li>"; }).join("") + "</ul>";
    }
    html += '<div class="tm-actions"><button type="button" class="tm-btn tm-primary" data-action="begin"' + (ready ? "" : " disabled") + ">Begin test</button>";
    if (saved && saved.phase !== "intro") {
      html += '<button type="button" class="tm-btn" data-action="resume"' + (ready ? "" : " disabled") + '>Resume</button>' +
        '<button type="button" class="tm-btn" data-action="startover">Start over</button>';
    }
    app.innerHTML = html + "</div></section>";
  }

  function refDialog() {
    return '<dialog id="tmRef" class="tm-dialog"><h2>Reference</h2><ul>' +
      "<li>Circle: A = πr², C = 2πr.</li>" +
      "<li>Rectangle: A = ℓw. Triangle: A = ½bh.</li>" +
      "<li>Pythagorean theorem: c² = a² + b².</li>" +
      "<li>Special right triangles: 30°-60°-90° sides x, x√3, 2x; 45°-45°-90° sides s, s, s√2.</li>" +
      "<li>Rectangular prism V = ℓwh. Cylinder V = πr²h. Sphere V = (4/3)πr³. Cone V = (1/3)πr²h. Pyramid V = (1/3)ℓwh.</li></ul>" +
      "<p>The number of degrees of arc in a circle is 360. The number of radians of arc in a circle is 2π. " +
      "The sum of the measures in degrees of the angles of a triangle is 180.</p>" +
      '<button type="button" class="tm-btn" data-action="closeref">Close</button></dialog>';
  }

  function renderModule() {
    var mod = curModule(), items = curItems(), n = items.length;
    var pos = Math.min(session.position, n);
    var html = '<header class="tm-head"><div class="tm-head-row"><strong>' + mod.label + '</strong>' +
      '<span class="tm-timer" id="tmTimer" role="timer"></span>';
    if (mod.section === "math") {
      html += '<span class="tm-tools"><button type="button" class="tm-btn" data-action="openref">Reference</button>' +
        '<a class="tm-btn" href="' + CALC_URL + '" target="_blank" rel="noopener">Calculator</a></span>';
    }
    html += '</div><div class="tm-warn" id="tmWarn" role="status" hidden>5 minutes remaining</div></header>';
    html += pos >= n ? reviewPage(items) : questionPage(items, pos, mod);
    if (navOpen) html += navigator_(items, pos);
    if (mod.section === "math") html += refDialog();
    app.innerHTML = '<div class="tm-module">' + html + "</div>";
    updateTimer();
  }

  function questionPage(items, pos, mod) {
    var item = items[pos], n = items.length;
    var val = session.responses[item.id];
    var stim = R.stimulus(item.stimulus) + R.table(item.table);
    var q = '<p class="tm-stem">' + item.questionStem + "</p>";
    if (item.type === "spr") {
      var v = val == null ? "" : String(val).replace(/"/g, "&quot;");
      q += '<div class="tm-directions">Enter one answer. Use up to 5 characters for a positive answer and up to 6 for a negative answer. ' +
        "Enter fractions like 3/4 and decimals like .75 or 0.75; do not enter mixed numbers. For a repeating decimal, enter as many digits as fit. " +
        "If there is more than one correct answer, enter only one.</div>" +
        '<label class="tm-spr">Your answer <input type="text" id="tmSpr" maxlength="6" autocomplete="off" value="' + v + '"></label>' +
        '<div class="tm-preview">Answer preview: <span id="tmPreview">' + (val == null ? "" : String(val).replace(/</g, "&lt;")) + "</span></div>";
    } else {
      q += '<div class="tm-choices" role="radiogroup">' + item.choices.map(function (c) {
        var on = val === c.letter;
        return '<button type="button" class="tm-choice' + (on ? " selected" : "") + '" role="radio" aria-checked="' + on +
          '" data-letter="' + c.letter + '"><span class="tm-letter">' + c.letter + "</span><span>" + c.text + "</span></button>";
      }).join("") + "</div>";
    }
    var marked = !!session.marked[item.id];
    var left = mod.section === "rw" ? '<div class="tm-passage">' + stim + "</div>" : "";
    var right = '<div class="tm-question">' + (mod.section === "rw" ? "" : '<div class="tm-passage-inline">' + stim + "</div>") + q + "</div>";
    return '<div class="tm-body tm-' + mod.section + '">' + left + right + "</div>" +
      '<footer class="tm-foot"><button type="button" class="tm-btn" data-action="mark" aria-pressed="' + marked + '">' +
      (marked ? "Marked for review" : "Mark for review") + "</button>" +
      '<button type="button" class="tm-btn" data-action="back"' + (pos === 0 ? " disabled" : "") + ">Back</button>" +
      '<button type="button" class="tm-btn tm-navbtn" data-action="nav" aria-expanded="' + navOpen + '">Question ' + (pos + 1) + " of " + n + "</button>" +
      '<button type="button" class="tm-btn tm-primary" data-action="next">' + (pos === n - 1 ? "Review module" : "Next") + "</button></footer>";
  }

  function reviewPage(items) {
    var open = items.filter(function (it) { return !answered(it); }).length;
    return '<section class="tm-card"><h2>Review module</h2><p>' + (open ? open + " unanswered. " : "All questions answered. ") +
      "Select a question to go back to it. After you submit you cannot return to this module.</p><ol class=\"tm-review\">" +
      items.map(function (it, i) {
        var st = (answered(it) ? "Answered" : "Unanswered") + (session.marked[it.id] ? ", marked for review" : "");
        return '<li><button type="button" class="tm-btn" data-goto="' + i + '">Question ' + (i + 1) + ": " + st + "</button></li>";
      }).join("") + '</ol><div class="tm-actions"><button type="button" class="tm-btn" data-action="back">Back</button>' +
      '<button type="button" class="tm-btn tm-primary" data-action="submit">Submit module</button></div></section>';
  }

  function navigator_(items, pos) {
    return '<div class="tm-nav" role="dialog" aria-label="Question navigator"><div class="tm-nav-grid">' + items.map(function (it, i) {
      var cls = "tm-cell" + (answered(it) ? " answered" : "") + (session.marked[it.id] ? " marked" : "") + (i === pos ? " current" : "");
      return '<button type="button" class="' + cls + '" data-goto="' + i + '" aria-label="Question ' + (i + 1) +
        (answered(it) ? ", answered" : ", unanswered") + (session.marked[it.id] ? ", marked" : "") + '">' + (i + 1) + "</button>";
    }).join("") + '</div><div class="tm-actions"><button type="button" class="tm-btn" data-goto="' + items.length + '">Go to review page</button>' +
      '<button type="button" class="tm-btn" data-action="nav">Close</button></div></div>';
  }

  function renderBreak() {
    app.innerHTML = '<section class="tm-card tm-center"><h1>Break</h1><div class="tm-timer tm-big" id="tmTimer" role="timer"></div>' +
      "<p>Reading and Writing is complete. Math starts when the break ends or when you choose to continue.</p>" +
      '<button type="button" class="tm-btn tm-primary" data-action="endbreak">Resume testing</button></section>';
    updateTimer();
  }

  // Task 5 replaces the body of this function with the real results view.
  function renderResults(s, f) {
    app.innerHTML = '<section class="tm-card"><h1>Results</h1><p>The results view arrives in the next task.</p>' +
      '<button type="button" class="tm-btn" data-action="startover">Start over</button></section>';
  }

  function render() {
    if (session.phase === "intro") renderIntro();
    else if (session.phase === "module") renderModule();
    else if (session.phase === "break") renderBreak();
    else renderResults(session, forms);
  }

  // ---------- timer ----------

  function updateTimer() {
    var t = document.getElementById("tmTimer");
    if (!t) return;
    var sec = session.phase === "break" ? session.breakRemaining : session.remaining[curModule().id];
    t.textContent = clock(sec);
    var w = document.getElementById("tmWarn");
    if (w) w.hidden = sec > 300;
  }

  function onTick() {
    if (session.phase !== "module" && session.phase !== "break") { lastTick = Date.now(); return; }
    var secs = Math.floor((Date.now() - lastTick) / 1000);
    if (secs < 1) return;
    lastTick += secs * 1000;
    var before = session.phase + session.moduleIndex;
    session = E.tick(session, secs);
    save();
    if (session.phase + session.moduleIndex !== before) { navOpen = false; render(); }
    else updateTimer();
  }

  // ---------- events ----------

  function choose(letter) {
    var item = curItems()[session.position];
    commit(E.setResponse(session, curModule().id, item.id, letter));
  }

  function submit() {
    if (session.phase !== "module") return;
    var open = curItems().filter(function (it) { return !answered(it); }).length;
    if (!window.confirm("Submit this module? You have " + open + " unanswered question" + (open === 1 ? "" : "s") +
      ". You cannot return to it after submitting.")) return;
    if (session.phase !== "module") return;
    navOpen = false;
    commit(E.submitModule(session));
  }

  function go(pos) {
    navOpen = false;
    commit(E.goTo(session, pos));
  }

  function startSession() {
    lastTick = Date.now();
    commit(E.start(E.newSession()));
  }

  app.addEventListener("click", function (e) {
    var el = e.target.closest("button");
    if (!el || el.disabled) return;
    if (el.hasAttribute("data-letter") && session.phase === "module") return choose(el.getAttribute("data-letter"));
    if (el.hasAttribute("data-goto") && session.phase === "module") return go(Number(el.getAttribute("data-goto")));
    var a = el.getAttribute("data-action");
    var inMod = session.phase === "module";
    if (a === "begin" && !problems.length) startSession();
    else if (a === "resume") { lastTick = Date.now(); session = loadSaved(); render(); }
    else if (a === "startover") { clearSaved(); session = E.newSession(); render(); }
    else if (a === "openref") document.getElementById("tmRef").showModal();
    else if (a === "closeref") document.getElementById("tmRef").close();
    else if (a === "endbreak" && session.phase === "break") commit(E.endBreak(session));
    else if (inMod && a === "mark") commit(E.toggleMark(session, curModule().id, curItems()[session.position].id));
    else if (inMod && a === "back") go(Math.max(0, Math.min(session.position, curItems().length) - 1));
    else if (inMod && a === "next") go(session.position + 1);
    else if (inMod && a === "nav") { navOpen = !navOpen; render(); }
    else if (inMod && a === "submit") submit();
  });

  app.addEventListener("input", function (e) {
    if (e.target.id !== "tmSpr" || session.phase !== "module") return;
    var item = curItems()[session.position];
    session = E.setResponse(session, curModule().id, item.id, e.target.value);
    save();
    document.getElementById("tmPreview").textContent = e.target.value;
  });

  document.addEventListener("keydown", function (e) {
    if (session.phase !== "module" || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target.tagName;
    if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return;
    if (document.querySelector("dialog[open]")) return;
    var item = curItems()[session.position];
    if (!item || item.type !== "mc") return;
    var k = e.key.toUpperCase();
    if (/^[A-D]$/.test(k)) choose(k);
  });

  // ---------- boot ----------

  function boot() {
    var errs = [];
    var reqs = E.MODULES.map(function (m, i) {
      return fetch(base + m.file).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }).then(function (data) {
        if (!Array.isArray(data) || !data.length) throw new Error("empty");
        forms[m.id] = data;
      }).catch(function (err) {
        errs[i] = (m.label + ": form " + (err.message === "empty" ? "is empty" : "is missing or could not be loaded") + " (" + base + m.file + ")");
      });
    });
    Promise.all(reqs).then(function () {
      problems = errs.filter(Boolean);
      var saved = loadSaved();
      session = problems.length || !saved ? E.newSession() : saved;
      if (session.phase === "module") session.position = Math.min(session.position, forms[curModule().id].length);
      lastTick = Date.now();
      render();
      timerId = setInterval(onTick, 1000);
    });
  }

  boot();
})();
