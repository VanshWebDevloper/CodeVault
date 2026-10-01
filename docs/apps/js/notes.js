(function () {
  "use strict";

  /* ---------- Auth placeholder ----------
     This is a stand-in for real authentication. It does not verify
     passwords or talk to a server. Swap AUTH.* functions for real
     API calls (e.g. fetch('/api/login')) when a backend exists.
     Notes are namespaced per "account name" so the storage model
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
    return "notes_app_data_" + scope;
  }

  /* ---------- Storage ---------- */
  const Store = {
    load() {
      const key = storageKeyFor(AUTH.getCurrentUser());
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        console.error("Failed to read notes", e);
        return [];
      }
    },
    save(notes) {
      const key = storageKeyFor(AUTH.getCurrentUser());
      localStorage.setItem(key, JSON.stringify(notes));
    }
  };

  /* ---------- State ---------- */
  let notes = Store.load();
  let editingId = null;
  let query = "";

  /* ---------- Elements ---------- */
  const form = document.getElementById("noteForm");
  const nameInput = document.getElementById("nameNote");
  const bodyInput = document.getElementById("note");
  const searchInput = document.getElementById("searchNote");
  const listEl = document.getElementById("notesList");
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
    const filtered = notes
      .filter(n => n.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="empty-state">' +
        (notes.length === 0 ? "No notes yet. Write your first one above." : "No notes match your search.") +
        "</div>";
      return;
    }

    listEl.innerHTML = filtered.map(n => `
      <article class="note-card" data-id="${n.id}">
        <h3>${escapeHtml(n.name)}</h3>
        <p>${escapeHtml(n.body)}</p>
        <div class="note-meta-row">
          <span class="note-time">${formatTime(n.updatedAt)}</span>
          <span class="note-actions">
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
      whoLabel.textContent = "Not signed in (using guest notes)";
      authBtn.textContent = "Sign in";
    }
  }

  /* ---------- Events ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const name = nameInput.value.trim();
    const body = bodyInput.value.trim();
    if (!name || !body) return;

    if (editingId) {
      const n = notes.find(n => n.id === editingId);
      if (n) {
        n.name = name;
        n.body = body;
        n.updatedAt = Date.now();
      }
      editingId = null;
      saveBtn.textContent = "Save note";
      editHint.textContent = "";
    } else {
      notes.push({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        name,
        body,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    Store.save(notes);
    form.reset();
    render();
  });

  listEl.addEventListener("click", function (e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const card = e.target.closest(".note-card");
    const id = card.dataset.id;
    const n = notes.find(n => n.id === id);
    if (!n) return;

    if (btn.dataset.action === "delete") {
      if (!confirm('Delete "' + n.name + '"?')) return;
      notes = notes.filter(x => x.id !== id);
      if (editingId === id) {
        editingId = null;
        form.reset();
        saveBtn.textContent = "Save note";
        editHint.textContent = "";
      }
      Store.save(notes);
      render();
    }

    if (btn.dataset.action === "edit") {
      editingId = id;
      nameInput.value = n.name;
      bodyInput.value = n.body;
      saveBtn.textContent = "Update note";
      editHint.textContent = "Editing \u201c" + n.name + "\u201d";
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
    notes = Store.load();
    editingId = null;
    form.reset();
    saveBtn.textContent = "Save note";
    editHint.textContent = "";
    updateAuthUI();
    render();
  });

  /* ---------- Init ---------- */
  updateAuthUI();
  render();
})();
