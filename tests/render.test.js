const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "render.js"), "utf8"), ctx);
const R = ctx.window.ItemRender;

test("stimulus renders paragraphs and bullet lists", () => {
  assert.strictEqual(R.stimulus("a\n\u2022 b\n\u2022 c"), "<p>a</p><ul><li>b</li><li>c</li></ul>");
});

test("table renders caption, headers, cells; empty when absent", () => {
  const h = R.table({ caption: "T", headers: ["x", "y"], rows: [["1", "2"]] });
  assert.ok(h.includes("<caption>T</caption>") && h.includes("<th>x</th>") && h.includes("<td>2</td>"));
  assert.ok(h.startsWith('<table class="data-table">'));
  assert.strictEqual(R.table(undefined), "");
});

test("explanation renders core question and steps; empty otherwise", () => {
  assert.strictEqual(R.explanation({}), "");
  const h = R.explanation({ coreQuestion: "Q", steps: ["a", "b", "c"] });
  assert.ok(h.includes('class="core-question"'));
  assert.strictEqual((h.match(/<li>/g) || []).length, 3);
});
