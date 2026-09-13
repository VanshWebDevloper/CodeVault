// ---------- File state ----------
// Each file has: name, language (for CodeMirror mode), content, and a CodeMirror doc instance (created lazily)
const files = {
  "index.html": {
    lang: "htmlmixed",
    content:
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
</html>`
  },
  "style.css": {
    lang: "css",
    content:
`body {
  font-family: sans-serif;
  text-align: center;
  margin-top: 60px;
}

h1 {
  color: #007acc;
}`
  },
  "script.js": {
    lang: "javascript",
    content:
`function sayHi() {
  console.log("Button clicked!");
  alert("Hello from script.js");
}`
  }
};

let openTabs = ["index.html", "style.css", "script.js"];
let activeFile = "index.html";
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

// ---------- Render file tree ----------
function renderFileTree() {
  fileTreeEl.innerHTML = "";
  Object.keys(files).forEach(name => {
    const li = document.createElement("li");
    li.textContent = fileIcon(name) + " " + name;
    if (name === activeFile) li.classList.add("active-file");
    li.addEventListener("click", () => openFile(name));
    fileTreeEl.appendChild(li);
  });
}

function fileIcon(name) {
  if (name.endsWith(".html")) return "🌐";
  if (name.endsWith(".css")) return "🎨";
  if (name.endsWith(".js")) return "📜";
  return "📄";
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
  }
  renderFileTree();
}

// ---------- Open a file into the editor ----------
function openFile(name) {
  if (!openTabs.includes(name)) openTabs.push(name);
  activeFile = name;
  renderTabs();
  renderFileTree();
  loadIntoEditor(name);
}

function loadIntoEditor(name) {
  const file = files[name];

  // Save previous file's content before switching
  if (cmInstance && activeFile) {
    // handled by change listener already, but keep safe
  }

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
  });

  cmInstance.on("cursorActivity", () => {
    const pos = cmInstance.getCursor();
    statusPos.textContent = `Ln ${pos.line + 1}, Col ${pos.ch + 1}`;
  });

  statusFile.textContent = name;
  statusLang.textContent = langLabels[file.lang] || file.lang;
}

// ---------- Run: build a real HTML doc with CSS + JS injected, load into sandboxed iframe ----------
function runProject() {
  const html = files["index.html"] ? files["index.html"].content : "";
  const css = files["style.css"] ? files["style.css"].content : "";
  const js = files["script.js"] ? files["script.js"].content : "";

  // Parse the html and inject css/js in place of linked files so it runs standalone in the iframe
  let doc = html
    .replace(/<link[^>]*href=["']style\.css["'][^>]*>/i, `<style>${css}<\/style>`)
    .replace(/<script[^>]*src=["']script\.js["'][^>]*><\/script>/i, `<script>${js}<\/script>`);

  const frame = document.getElementById("output-frame");
  frame.srcdoc = doc;
}

document.getElementById("run-btn").addEventListener("click", runProject);
document.getElementById("clear-console").addEventListener("click", () => {
  document.getElementById("output-frame").srcdoc = "";
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

// ---------- Init ----------
renderFileTree();
renderTabs();
loadIntoEditor(activeFile);
runProject(); // show something on load

// Fix CodeMirror sizing glitches that happen when it's laid out before the
// flex/viewport dimensions are fully settled (common on mobile browsers)
setTimeout(() => { if (cmInstance) cmInstance.refresh(); }, 150);
window.addEventListener("orientationchange", () => {
  setTimeout(() => { if (cmInstance) cmInstance.refresh(); }, 200);
});
