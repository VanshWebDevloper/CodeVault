(function () {
  "use strict";

  const pathBar = document.getElementById("pathBar");
  const grid = document.getElementById("filesGrid");
  const emptyHint = document.getElementById("emptyHint");

  const newFolderBtn = document.getElementById("newFolderBtn");
  const newFileBtn = document.getElementById("newFileBtn");
  const importBtn = document.getElementById("importBtn");
  const importInput = document.getElementById("importInput");

  const modalOverlay = document.getElementById("modalOverlay");
  const modalTitle = document.getElementById("modalTitle");
  const modalInput = document.getElementById("modalInput");
  const modalError = document.getElementById("modalError");
  const modalCancel = document.getElementById("modalCancel");
  const modalConfirm = document.getElementById("modalConfirm");

  const fileViewOverlay = document.getElementById("fileViewOverlay");
  const fileViewTitle = document.getElementById("fileViewTitle");
  const fileViewContent = document.getElementById("fileViewContent");
  const fileViewError = document.getElementById("fileViewError");
  const fileViewCancel = document.getElementById("fileViewCancel");
  const fileViewSave = document.getElementById("fileViewSave");
  const openInEditorBtn = document.getElementById("openInEditorBtn");

  let cwd = VFS.getCwd() === "/" ? "/home" : VFS.getCwd();
  let modalMode = null; // "folder" | "file"
  let viewingPath = null;

  function iconFor(node) {
    if (node.type === "folder") return "\uD83D\uDCC1";
    return "\uD83D\uDCC4";
  }

  function renderPathBar() {
    const parts = cwd.split("/").filter(Boolean);
    pathBar.innerHTML = "";
    const rootSpan = document.createElement("span");
    rootSpan.textContent = "/";
    if (parts.length === 0) rootSpan.classList.add("current");
    rootSpan.addEventListener("click", () => navigateTo("/"));
    pathBar.appendChild(rootSpan);

    let acc = "";
    parts.forEach((part, i) => {
      acc += "/" + part;
      const sep = document.createTextNode(" / ");
      pathBar.appendChild(sep);
      const span = document.createElement("span");
      span.textContent = part;
      if (i === parts.length - 1) span.classList.add("current");
      const target = acc;
      span.addEventListener("click", () => navigateTo(target));
      pathBar.appendChild(span);
    });
  }

  function navigateTo(path) {
    cwd = path === "" ? "/" : path;
    VFS.setCwd(cwd);
    render();
  }

  function render() {
    renderPathBar();
    const items = VFS.list(cwd) || [];
    grid.innerHTML = "";
    emptyHint.hidden = items.length > 0;

    items.forEach(node => {
      const el = document.createElement("div");
      el.className = "file-item";
      el.innerHTML =
        '<div class="file-icon">' + iconFor(node) + '</div>' +
        '<div class="file-name"></div>' +
        '<button type="button" class="item-menu" title="Delete">\u00d7</button>';
      el.querySelector(".file-name").textContent = node.name;

      el.addEventListener("click", (e) => {
        if (e.target.closest(".item-menu")) return;
        if (node.type === "folder") {
          navigateTo((cwd === "/" ? "" : cwd) + "/" + node.name);
        } else {
          openFileViewer((cwd === "/" ? "" : cwd) + "/" + node.name, node);
        }
      });

      el.querySelector(".item-menu").addEventListener("click", (e) => {
        e.stopPropagation();
        const fullPath = (cwd === "/" ? "" : cwd) + "/" + node.name;
        if (confirm('Delete "' + node.name + '"?')) {
          VFS.remove(fullPath);
          if (window.ANALYTICS) {
            ANALYTICS.logEvent(node.type === "folder" ? "folder_deleted" : "file_deleted", { path: fullPath });
          }
          render();
        }
      });

      grid.appendChild(el);
    });
  }

  /* ---------- New folder / file modal ---------- */
  function openModal(mode) {
    modalMode = mode;
    modalTitle.textContent = mode === "folder" ? "New folder" : "New file";
    modalConfirm.textContent = "Create";
    modalInput.value = "";
    modalError.textContent = "";
    modalOverlay.hidden = false;
    modalInput.focus();
  }

  function closeModal() {
    modalOverlay.hidden = true;
    modalMode = null;
  }

  modalCancel.addEventListener("click", closeModal);

  modalConfirm.addEventListener("click", () => {
    const name = modalInput.value.trim();
    if (!name) { modalError.textContent = "Enter a name first."; return; }
    const fullPath = (cwd === "/" ? "" : cwd) + "/" + name;
    const res = modalMode === "folder" ? VFS.mkdir(fullPath) : VFS.writeFile(fullPath, "");
    if (!res.ok) { modalError.textContent = res.error; return; }
    if (window.ANALYTICS) {
      ANALYTICS.logEvent(modalMode === "folder" ? "folder_created" : "file_created", { path: fullPath });
    }
    closeModal();
    render();
  });

  modalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") modalConfirm.click();
    if (e.key === "Escape") closeModal();
  });

  newFolderBtn.addEventListener("click", () => openModal("folder"));
  newFileBtn.addEventListener("click", () => openModal("file"));

  /* ---------- File viewer / editor ---------- */
  function openFileViewer(path, node) {
    viewingPath = path;
    fileViewTitle.textContent = node.name;
    fileViewContent.value = node.content || "";
    fileViewError.textContent = "";
    fileViewOverlay.hidden = false;
    fileViewContent.focus();
  }

  fileViewCancel.addEventListener("click", () => { fileViewOverlay.hidden = true; viewingPath = null; });

  fileViewSave.addEventListener("click", () => {
    if (window.ANALYTICS && viewingPath) ANALYTICS.logEvent("file_saved", { path: viewingPath });
    if (!viewingPath) return;
    const res = VFS.writeFile(viewingPath, fileViewContent.value);
    if (!res.ok) { fileViewError.textContent = res.error; return; }
    fileViewOverlay.hidden = true;
    viewingPath = null;
    render();
  });

  openInEditorBtn.addEventListener("click", () => {
    if (!viewingPath) return;
    VFS.writeFile(viewingPath, fileViewContent.value);
    sessionStorage.setItem("coolzie_editor_open_path", viewingPath);
    sessionStorage.setItem("coolzie_editor_open_content", fileViewContent.value);
    window.location.href = "code-editor.html";
  });

  /* ---------- Import / export ---------- */
  importBtn.addEventListener("click", () => importInput.click());

  importInput.addEventListener("change", () => {
    const file = importInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let node;
      if (file.name.endsWith(".json")) {
        try {
          node = JSON.parse(reader.result);
          if (!node.type || !node.name) throw new Error("not a valid export");
        } catch (e) {
          alert("Could not import: not a valid Coolzie export file.");
          return;
        }
      } else {
        node = {
          type: "file",
          name: file.name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          content: reader.result
        };
      }
      const res = VFS.importNode(cwd, node);
      if (!res.ok) { alert("Import failed: " + res.error); return; }
      render();
    };
    reader.readAsText(file);
    importInput.value = "";
  });

  // Right-click / long item menu could export; keep it simple: double-click exports
  grid.addEventListener("dblclick", (e) => {
    const item = e.target.closest(".file-item");
    if (!item) return;
    const name = item.querySelector(".file-name").textContent;
    const fullPath = (cwd === "/" ? "" : cwd) + "/" + name;
    const node = VFS.exportNode(fullPath);
    if (!node) return;
    const blob = new Blob([JSON.stringify(node, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name.replace(/[^a-z0-9_.-]/gi, "_") + ".json";
    a.click();
    URL.revokeObjectURL(url);
  });

  window.addEventListener("vfs:change", render);

  if (window.ANALYTICS) ANALYTICS.trackPage("files");
  render();
})();
