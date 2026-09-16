(function () {
  "use strict";

  /* ---------- Auth placeholder ----------
     This is a stand-in for real authentication. It does not verify
     passwords or talk to a server. Swap AUTH.* functions for real
     API calls (e.g. fetch('/api/login')) when a backend exists.
     Tasks are namespaced per "account name" so the storage model
     already matches what per-user data will look like later.
  */
  const AUTH_KEY = "coolzie_current_user";

  const AUTH = {
    getCurrentUser() {
      return localStorage.getItem(AUTH_KEY) || null;
    },
    signIn(name) {
      localStorage.setItem(AUTH_KEY, name);
    },
    signOut() {
      localStorage.removeItem(AUTH_KEY);
    }
  };

  function storageKeyFor(user) {
    const scope = user ? "user_" + user : "guest";
    return "tasks_app_data_" + scope;
  }

  /* ---------- Storage ---------- */
  const Store = {
    load() {
      const key = storageKeyFor(AUTH.getCurrentUser());
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        console.error("Failed to read tasks", e);
        return [];
      }
    },
    save(tasks) {
      const key = storageKeyFor(AUTH.getCurrentUser());
      localStorage.setItem(key, JSON.stringify(tasks));
    }
  };

  /* ---------- State ---------- */
  let tasks = Store.load();
  let editingId = null;
  let query = "";

  /* ---------- Elements ---------- */
  const form = document.getElementById("taskForm");
  const nameInput = document.getElementById("taskName");
  const bodyInput = document.getElementById("taskInput");
  const searchInput = document.getElementById("searchTask");
  const listEl = document.getElementById("taskList");
  const saveBtn = document.getElementById("saveBtn");
  const editHint = document.getElementById("editHint");
  const whoLabel = document.getElementById("whoLabel");
  const authBtn = document.getElementById("authBtn");

  /* ---------- Rendering ---------- */
  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function render() {
    const filtered = tasks
      .filter(t => t.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="empty-state">' +
        (tasks.length === 0 ? "No tasks yet. Add your first one above." : "No tasks match your search.") +
        "</div>";
      return;
    }

    listEl.innerHTML = filtered.map(t => `
      <article class="task-card${t.done ? " done" : ""}" data-id="${t.id}">
        <h3>${escapeHtml(t.name)}</h3>
        <p>${escapeHtml(t.body)}</p>
        <div class="task-meta-row">
          <span class="task-time">${formatTime(t.updatedAt)}</span>
          <span class="task-actions">
            <button type="button" data-action="toggle">${t.done ? "Undo" : "Done"}</button>
            <button type="button" data-action="edit">Edit</button>
            <button type="button" data-action="delete">Delete</button>
          </span>
        </div>
      </article>
    `).join("");
  }

  function updateAuthUI() {
    const user = AUTH.getCurrentUser();
    if (user) {
      whoLabel.textContent = "Signed in as " + user;
      authBtn.textContent = "Sign out";
    } else {
      whoLabel.textContent = "Not signed in (using guest tasks)";
      authBtn.textContent = "Sign in";
    }
  }

  /* ---------- Events ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const wasEditing = !!editingId;
    const name = nameInput.value.trim();
    const body = bodyInput.value.trim();
    if (!name || !body) return;

    if (editingId) {
      const t = tasks.find(t => t.id === editingId);
      if (t) {
        t.name = name;
        t.body = body;
        t.updatedAt = Date.now();
      }
      editingId = null;
      saveBtn.textContent = "Add task";
      editHint.textContent = "";
    } else {
      tasks.push({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        name,
        body,
        done: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    if (window.ANALYTICS) {
      ANALYTICS.logEvent(wasEditing ? "task_updated" : "task_created", { name });
    }
    Store.save(tasks);
    form.reset();
    render();
  });

  listEl.addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const card = e.target.closest(".task-card");
    const id = card.dataset.id;
    const t = tasks.find(t => t.id === id);
    if (!t) return;

    if (btn.dataset.action === "delete") {
      if (!confirm('Delete "' + t.name + '"?')) return;
      if (window.ANALYTICS) ANALYTICS.logEvent("task_deleted", { name: t.name });
      tasks = tasks.filter(x => x.id !== id);
      if (editingId === id) {
        editingId = null;
        form.reset();
        saveBtn.textContent = "Add task";
        editHint.textContent = "";
      }
      Store.save(tasks);
      render();
    }

    if (btn.dataset.action === "toggle") {
      t.done = !t.done;
      t.updatedAt = Date.now();
      if (window.ANALYTICS) ANALYTICS.logEvent(t.done ? "task_completed" : "task_reopened", { name: t.name });
      Store.save(tasks);
      render();
    }

    if (btn.dataset.action === "edit") {
      editingId = id;
      nameInput.value = t.name;
      bodyInput.value = t.body;
      saveBtn.textContent = "Update task";
      editHint.textContent = "Editing \u201c" + t.name + "\u201d";
      nameInput.focus();
      window.scrollTo({ top: form.offsetTop - 20, behavior: "smooth" });
    }
  });

  searchInput.addEventListener("input", function (e) {
    query = e.target.value;
    render();
  });

  authBtn.addEventListener("click", function () {
    if (AUTH.getCurrentUser()) {
      AUTH.signOut();
    } else {
      const name = prompt("Placeholder sign-in \u2014 enter any name:");
      if (name && name.trim()) {
        AUTH.signIn(name.trim());
      } else {
        return;
      }
    }
    tasks = Store.load();
    editingId = null;
    form.reset();
    saveBtn.textContent = "Add task";
    editHint.textContent = "";
    updateAuthUI();
    render();
  });

  /* ---------- Init ---------- */
  updateAuthUI();
  render();
})();

  if (window.ANALYTICS) ANALYTICS.trackPage("tasks");
