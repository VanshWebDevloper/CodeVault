(function () {
  "use strict";

  const APP_LABELS = {
    "notes": "Notes",
    "tasks": "Tasks",
    "terminal": "Terminal",
    "files": "Files",
    "code-editor": "Code Editor",
    "analytics": "Analytics"
  };

  function fmtDuration(ms) {
    const mins = Math.round(ms / 60000);
    if (mins < 1) return "<1m";
    if (mins < 60) return mins + "m";
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return hrs + "h " + rem + "m";
  }

  function renderBarList(containerEl, emptyEl, rows, formatValue) {
    if (rows.length === 0) {
      containerEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    const max = Math.max(...rows.map(r => r.value), 1);
    containerEl.innerHTML = rows.map(r => `
      <div class="bar-row">
        <span class="bar-label">${r.label}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, (r.value / max) * 100)}%"></div></div>
        <span class="bar-value">${formatValue(r.value)}</span>
      </div>
    `).join("");
  }

  function render() {
    const events = ANALYTICS.getEvents();
    const totals = ANALYTICS.totalTimeByApp();
    const counts = ANALYTICS.countEventsByType();

    // Top stat cards
    const totalMs = Object.values(totals).reduce((a, b) => a + b, 0);
    document.getElementById("statTotalTime").textContent = fmtDuration(totalMs);
    document.getElementById("statNotesCreated").textContent = counts["note_created"] || 0;
    document.getElementById("statTasksCompleted").textContent = counts["task_completed"] || 0;
    document.getElementById("statCommandsRun").textContent = counts["terminal_command"] || 0;

    // Time by app
    const timeRows = Object.keys(totals)
      .map(app => ({ label: APP_LABELS[app] || app, value: totals[app] }))
      .sort((a, b) => b.value - a.value);
    renderBarList(
      document.getElementById("timeByApp"),
      document.getElementById("timeByAppEmpty"),
      timeRows,
      fmtDuration
    );

    // Daily activity, last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    const dayCounts = days.map(d => {
      const start = d.getTime();
      const end = start + 24 * 60 * 60 * 1000;
      const count = events.filter(e => e.ts >= start && e.ts < end).length;
      return {
        label: d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
        value: count
      };
    });
    renderBarList(
      document.getElementById("dailyActivity"),
      document.getElementById("dailyActivityEmpty"),
      dayCounts.filter(d => true),
      v => String(v)
    );
    // Daily activity should show even all-zero days, so bypass the "empty" state unless truly no events ever
    if (events.length === 0) {
      document.getElementById("dailyActivity").innerHTML = "";
      document.getElementById("dailyActivityEmpty").hidden = false;
    }

    // Top terminal commands
    const cmdCounts = {};
    events.filter(e => e.type === "terminal_command").forEach(e => {
      const name = (e.meta && e.meta.command) || "unknown";
      cmdCounts[name] = (cmdCounts[name] || 0) + 1;
    });
    const cmdRows = Object.keys(cmdCounts)
      .map(name => ({ label: name, value: cmdCounts[name] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    renderBarList(
      document.getElementById("topCommands"),
      document.getElementById("topCommandsEmpty"),
      cmdRows,
      v => String(v)
    );
  }

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (!confirm("Reset all tracked analytics for this account? This cannot be undone.")) return;
    ANALYTICS.reset();
    render();
  });

  render();
})();
