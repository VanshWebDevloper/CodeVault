// ---------- Workspace (shared VFS) ----------
// The editor no longer keeps its own hardcoded file set. Every file lives in
// the same virtual filesystem the Files and Terminal apps use, under /home.
// New files created here show up in Files and vice versa.
const WORKSPACE_ROOT = "/home";

// Each entry in `files` has: name, language (CodeMirror mode), content,
// optional vfsPath (when the file came from outside /home via the Files app),
// and a CodeMirror doc instance is created lazily on open.
let files = {};
let openTabs = [];
let activeFile = null;
let cmInstance = null;

const fileTreeEl = document.getElementById("file-tree");
const tabBarEl = document.getElementById("tab-bar");
const codespaceEl = document.getElementById("codespace");
const statusFile = document.getElementById("status-file");
const statusLang = document.getElementById("status-lang");
const statusPos = document.getElementById("status-pos");

const langLabels = {
  htmlmixed: "HTML",
  css: "CSS",
  javascript: "JavaScript"
};

function langForFileName(name) {
  if (/\.html?$/i.test(name)) return "htmlmixed";
  if (/\.css$/i.test(name)) return "css";
  if (/\.js$/i.test(name)) return "javascript";
  return "javascript"; // closest available mode for plain text/unknown types
}

function fileIcon(name) {
  if (name.endsWith(".html")) return "🌐";
  if (name.endsWith(".css")) return "🎨";
  if (name.endsWith(".js")) return "📜";
  return "📄";
}

// ---------- VFS helpers ----------
function listWorkspaceFiles() {
  const entries = VFS.list(WORKSPACE_ROOT) || [];
  return entries.filter(e => e.type === "file").map(e => e.name);
}

function seedStarterFiles() {
  // Only seed once: if /home already contains any HTML file, leave it alone.
  if (listWorkspaceFiles().some(n => /\.html?$/i.test(n))) return;

  VFS.writeFile(WORKSPACE_ROOT + "/index.html",
`<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Hello world</h1>
  <button onclick="sayHi()">Click me</button>
  <script src="script.js"><\/script>
</body>
</html>`);

  VFS.writeFile(WORKSPACE_ROOT + "/style.css",
`body {
  font-family: sans-serif;
  text-align: center;
  margin-top: 60px;
}

h1 {
  color: #007acc;
}`);

  VFS.writeFile(WORKSPACE_ROOT + "/script.js",
`function sayHi() {
  console.log("Button clicked!");
  alert("Hello from script.js");
}`);
}

// Load (or refresh) the `files` cache from the VFS. Keeps whatever is
// currently open in an unsaved state if the file vanished from the VFS.
function syncFromVfs() {
  listWorkspaceFiles().forEach(name => {
    const res = VFS.readFile(WORKSPACE_ROOT + "/" + name);
    if (!res.ok) return;
    if (files[name] && files[name].content === res.content) return;
    files[name] = { lang: langForFileName(name), content: res.content };
    if (!openTabs.includes(name) && !activeFile) {
      // first sync: open the first html file by default
    }
  });
}

// Persist one file back to the VFS.
function saveFile(name) {
  const file = files[name];
  if (!file) return;
  const path = file.vfsPath || (WORKSPACE_ROOT + "/" + name);
  VFS.writeFile(path, file.content);
}

// Debounced autosave so typing doesn't hammer localStorage.
let saveTimers = {};
function scheduleSave(name) {
  clearTimeout(saveTimers[name]);
  saveTimers[name] = setTimeout(() => saveFile(name), 500);
}

// ---------- Create / delete files ----------
function createFile(name) {
  name = (name || "").trim();
  if (!name) return;
  if (/[\/\\]/.test(name)) {
    alert("File names can't contain / or \\ (use folders in the Files app).");
    return;
  }
  if (files[name]) {
    alert("A file with that name is already open.");
    return;
  }
  const res = VFS.writeFile(WORKSPACE_ROOT + "/" + name, "");
  if (!res.ok) {
    alert("Could not create file: " + res.error);
    return;
  }
  files[name] = { lang: langForFileName(name), content: "" };
  openFile(name);
  renderFileTree();
}

function deleteFile(name) {
  const file = files[name];
  const path = file && file.vfsPath ? file.vfsPath : (WORKSPACE_ROOT + "/" + name);
  if (!confirm("Delete " + name + "? This cannot be undone.")) return;

  VFS.remove(path);
  delete files[name];
  delete saveTimers[name];
  closeTab(name);
  renderFileTree();
}

// ---------- Render file tree ----------
function renderFileTree() {
  fileTreeEl.innerHTML = "";
  Object.keys(files).sort().forEach(name => {
    const li = document.createElement("li");
    li.textContent = fileIcon(name) + " " + name;
    if (name === activeFile) li.classList.add("active-file");

    // small delete affordance next to the filename
    const del = document.createElement("span");
    del.className = "file-delete";
    del.textContent = "✕";
    del.title = "Delete " + name;
    del.addEventListener("click", e => {
      e.stopPropagation();
      deleteFile(name);
    });
    li.appendChild(del);

    li.addEventListener("click", () => openFile(name));
    fileTreeEl.appendChild(li);
  });
}

// ---------- Render tabs ----------
function renderTabs() {
  tabBarEl.innerHTML = "";
  openTabs.forEach(name => {
    const tab = document.createElement("div");
    tab.className = "tab" + (name === activeFile ? " active" : "");

    const label = document.createElement("span");
    label.textContent = name;
    tab.appendChild(label);

    const close = document.createElement("span");
    close.className = "tab-close";
    close.textContent = "✕";
    close.addEventListener("click", e => {
      e.stopPropagation();
      closeTab(name);
    });
    tab.appendChild(close);

    tab.addEventListener("click", () => openFile(name));
    tabBarEl.appendChild(tab);
  });
}

function closeTab(name) {
  openTabs = openTabs.filter(t => t !== name);
  if (activeFile === name) {
    activeFile = openTabs[openTabs.length - 1] || null;
  }
  renderTabs();
  if (activeFile) {
    loadIntoEditor(activeFile);
  } else {
    codespaceEl.innerHTML = "";
    statusFile.textContent = "—";
    statusLang.textContent = "—";
  }
}

// ---------- Open a file into the editor ----------
function openFile(name) {
  if (!files[name]) return;
  if (!openTabs.includes(name)) openTabs.push(name);
  activeFile = name;
  renderTabs();
  renderFileTree();
  loadIntoEditor(name);
}

function loadIntoEditor(name) {
  const file = files[name];

  codespaceEl.innerHTML = "";
  cmInstance = CodeMirror(codespaceEl, {
    value: file.content,
    mode: file.lang,
    theme: document.getElementById("ext-theme").value,
    lineNumbers: document.getElementById("ext-minimap").checked,
    lineWrapping: document.getElementById("ext-wordwrap").checked,
    tabSize: 2,
    autoCloseBrackets: true
  });

  cmInstance.on("change", () => {
    files[name].content = cmInstance.getValue();
    scheduleSave(name); // autosave to the shared VFS
  });

  cmInstance.on("cursorActivity", () => {
    const pos = cmInstance.getCursor();
    statusPos.textContent = `Ln ${pos.line + 1}, Col ${pos.ch + 1}`;
  });

  statusFile.textContent = name;
  statusLang.textContent = langLabels[file.lang] || file.lang;
}

// Ctrl/Cmd+S saves immediately (autosave normally covers it anyway)
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (activeFile) saveFile(activeFile);
  }
});

// ---------- Run: build a real HTML doc with any css/js inlined ----------
// Instead of hardcoding style.css/script.js, every css file referenced with
// <link href="..."> and every js file referenced with <script src="..."> that
// exists in the workspace gets inlined into the output.
function runProject() {
  const htmlName = openTabs.find(n => /\.html?$/i.test(n)) ||
                   Object.keys(files).find(n => /\.html?$/i.test(n));
  let doc = htmlName && files[htmlName]
    ? files[htmlName].content
    : "<h1 style=\"font-family:sans-serif\">No HTML file to run</h1>";

  const escapeHtmlRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  Object.keys(files).filter(n => n.endsWith(".css")).forEach(name => {
    const re = new RegExp(`<link[^>]*href=["']${escapeHtmlRe(name)}["'][^>]*>`, "gi");
    doc = doc.replace(re, () => "<style>" + files[name].content + "</style>");
  });

  Object.keys(files).filter(n => n.endsWith(".js")).forEach(name => {
    const re = new RegExp(`<script[^>]*src=["']${escapeHtmlRe(name)}["'][^>]*>\\s*<\\/script>`, "gi");
    doc = doc.replace(re, () => "<script>" + files[name].content + "<\\/script>");
  });

  const frame = document.getElementById("output-frame");
  frame.srcdoc = doc;
}

document.getElementById("run-btn").addEventListener("click", runProject);
document.getElementById("clear-console").addEventListener("click", () => {
  document.getElementById("output-frame").srcdoc = "";
});

// ---------- New file button in the explorer ----------
document.getElementById("new-file-btn").addEventListener("click", () => {
  const name = prompt("New file name (e.g. about.html, utils.js):");
  if (name !== null) createFile(name);
});

// ---------- Extensions panel toggles ----------
document.getElementById("ext-wordwrap").addEventListener("change", e => {
  if (cmInstance) cmInstance.setOption("lineWrapping", e.target.checked);
});
document.getElementById("ext-minimap").addEventListener("change", e => {
  if (cmInstance) cmInstance.setOption("lineNumbers", e.target.checked);
});
document.getElementById("ext-theme").addEventListener("change", e => {
  if (cmInstance) cmInstance.setOption("theme", e.target.value);
});

// ---------- Activity bar: switch between Explorer / Extensions ----------
const sidebar = document.getElementById("sidebar");
const extensionsPanel = document.getElementById("extensions-panel");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const menuBtn = document.getElementById("menu-btn");

function isMobile() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function currentPanel() {
  return sidebar.classList.contains("hidden") ? extensionsPanel : sidebar;
}

function openMobileDrawer() {
  currentPanel().classList.add("mobile-open");
  sidebarBackdrop.classList.add("visible");
}

function closeMobileDrawer() {
  sidebar.classList.remove("mobile-open");
  extensionsPanel.classList.remove("mobile-open");
  sidebarBackdrop.classList.remove("visible");
}

document.querySelectorAll(".activity-icon").forEach(icon => {
  icon.addEventListener("click", () => {
    document.querySelectorAll(".activity-icon").forEach(i => i.classList.remove("active"));
    icon.classList.add("active");
    const panel = icon.dataset.panel;
    if (panel === "explorer") {
      sidebar.classList.remove("hidden");
      extensionsPanel.classList.add("hidden");
    } else {
      sidebar.classList.add("hidden");
      extensionsPanel.classList.remove("hidden");
    }
    // On mobile, tapping an activity icon should open the drawer
    if (isMobile()) openMobileDrawer();
  });
});

menuBtn.addEventListener("click", () => {
  if (currentPanel().classList.contains("mobile-open")) {
    closeMobileDrawer();
  } else {
    openMobileDrawer();
  }
});

sidebarBackdrop.addEventListener("click", closeMobileDrawer);

// Close drawer after picking a file on mobile (better UX than staying open)
fileTreeEl.addEventListener("click", () => {
  if (isMobile()) closeMobileDrawer();
});

// If the window is resized from mobile to desktop, clear mobile-only state
window.addEventListener("resize", () => {
  if (!isMobile()) closeMobileDrawer();
  if (cmInstance) cmInstance.refresh();
});

// ---------- Drag to resize sidebar width ----------
const resizeHandle = document.getElementById("resize-handle");
let isResizingSidebar = false;

resizeHandle.addEventListener("mousedown", () => {
  isResizingSidebar = true;
  resizeHandle.classList.add("dragging");
  document.body.style.cursor = "col-resize";
});

// ---------- Drag to resize editor/output split (vertical height) ----------
const vResizeHandle = document.getElementById("v-resize-handle");
const outputPane = document.getElementById("output-pane");
let isResizingOutput = false;

vResizeHandle.addEventListener("mousedown", () => {
  isResizingOutput = true;
  vResizeHandle.classList.add("dragging");
  document.body.style.cursor = "row-resize";
});

function handleDragMove(clientX, clientY) {
  if (isResizingSidebar) {
    const activityBarWidth = 48;
    const newWidth = Math.min(Math.max(clientX - activityBarWidth, 150), 500);
    const visiblePanel = sidebar.classList.contains("hidden") ? extensionsPanel : sidebar;
    visiblePanel.style.width = newWidth + "px";
    if (cmInstance) cmInstance.refresh();
  }
  if (isResizingOutput) {
    const splitRect = document.getElementById("editor-output-split").getBoundingClientRect();
    const newHeight = Math.min(Math.max(splitRect.bottom - clientY, 80), splitRect.height - 100);
    outputPane.style.height = newHeight + "px";
    if (cmInstance) cmInstance.refresh();
  }
}

function stopDragging() {
  if (isResizingSidebar) {
    isResizingSidebar = false;
    resizeHandle.classList.remove("dragging");
  }
  if (isResizingOutput) {
    isResizingOutput = false;
    vResizeHandle.classList.remove("dragging");
  }
  document.body.style.cursor = "default";
}

document.addEventListener("mousemove", e => handleDragMove(e.clientX, e.clientY));
document.addEventListener("mouseup", stopDragging);

// Touch support so the editor/output resize handle works on tablets and touch laptops
vResizeHandle.addEventListener("touchstart", () => {
  isResizingOutput = true;
  vResizeHandle.classList.add("dragging");
}, { passive: true });

document.addEventListener("touchmove", e => {
  if (isResizingSidebar || isResizingOutput) {
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
  }
}, { passive: true });

document.addEventListener("touchend", stopDragging);

// ---------- Files app handoff ----------
// If the Files app sent a file over (via sessionStorage), open it here.
// The Files app writes the file into the VFS before navigating, so we just
// read it back out of the VFS by path (handles files outside /home too).
function importFromFilesApp() {
  const path = sessionStorage.getItem("coolzie_editor_open_path");
  if (!path) return false;

  const res = VFS.readFile(path);
  const content = res.ok ? res.content : (sessionStorage.getItem("coolzie_editor_open_content") || "");
  const name = path.split("/").filter(Boolean).pop() || "untitled.txt";

  files[name] = {
    lang: langForFileName(name),
    content: content,
    vfsPath: path // remembered so saves go back to the original location
  };

  if (!openTabs.includes(name)) openTabs.push(name);
  activeFile = name;

  sessionStorage.removeItem("coolzie_editor_open_path");
  sessionStorage.removeItem("coolzie_editor_open_content");
  return true;
}

// ---------- Init ----------
VFS.stat("/"); // touch so a fresh browser gets the default tree created
seedStarterFiles();
syncFromVfs();

// Pick a sensible default active file
if (!activeFile) {
  const firstHtml = Object.keys(files).find(n => /\.html?$/i.test(n));
  const fallback = firstHtml || Object.keys(files).sort()[0];
  if (fallback) {
    activeFile = fallback;
    openTabs = [fallback];
  }
}

const openedFromFiles = importFromFilesApp();
renderFileTree();
renderTabs();
if (activeFile) loadIntoEditor(activeFile);
runProject(); // show something on load

// Fix CodeMirror sizing glitches that happen when it's laid out before the
// flex/viewport dimensions are fully settled (common on mobile browsers)
setTimeout(() => { if (cmInstance) cmInstance.refresh(); }, 150);
window.addEventListener("orientationchange", () => {
  setTimeout(() => { if (cmInstance) cmInstance.refresh(); }, 200);
});
