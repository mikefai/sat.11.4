(function () {
  function stimulus(text) {
    var lines = text.split("\n");
    var html = "";
    var inList = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.trim() === "") continue;
      if (line.trim().indexOf("\u2022") === 0) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += "<li>" + line.trim().substring(1).trim() + "</li>";
      } else {
        if (inList) { html += "</ul>"; inList = false; }
        html += "<p>" + line + "</p>";
      }
    }
    if (inList) html += "</ul>";
    return html;
  }

  function table(t) {
    if (!t) return "";
    var html = '<table class="data-table">';
    if (t.caption) html += "<caption>" + t.caption + "</caption>";
    html += "<thead><tr>";
    for (var i = 0; i < t.headers.length; i++) html += "<th>" + t.headers[i] + "</th>";
    html += "</tr></thead><tbody>";
    for (var r = 0; r < t.rows.length; r++) {
      html += "<tr>";
      for (var c = 0; c < t.rows[r].length; c++) html += "<td>" + t.rows[r][c] + "</td>";
      html += "</tr>";
    }
    return html + "</tbody></table>";
  }

  function explanation(q) {
    var html = "";
    if (q.coreQuestion) {
      html += '<div class="core-question"><div class="note-label">Underlying core question</div>' + q.coreQuestion + "</div>";
    }
    if (q.steps && q.steps.length) {
      html += '<ol class="steps">';
      for (var i = 0; i < q.steps.length; i++) html += "<li>" + q.steps[i] + "</li>";
      html += "</ol>";
    }
    return html;
  }

  window.ItemRender = { stimulus: stimulus, table: table, explanation: explanation };
})();
