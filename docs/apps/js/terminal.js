(function () {
  "use strict";

  const log = document.getElementById("termLog");
  const input = document.getElementById("termInput");
  const promptEl = document.getElementById("termPrompt");
  const titleEl = document.getElementById("termTitle");
  const body = document.getElementById("termBody");

  const HISTORY_KEY = "coolzie_term_history_" + (localStorage.getItem(VFS.AUTH_KEY) || "guest");
  let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  let historyIndex = history.length;

  function userLabel() {
    return localStorage.getItem(VFS.AUTH_KEY) || "guest";
  }

  function refreshPrompt() {
    const cwd = VFS.getCwd();
    const label = userLabel() + "@coolzie:" + cwd + "$";
    promptEl.textContent = label;
    titleEl.textContent = userLabel() + "@coolzie:" + cwd;
  }

  function print(text, cls) {
    const div = document.createElement("div");
    div.className = "term-line " + (cls || "out");
    div.textContent = text;
    log.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function printEcho(cmdText) {
    const div = document.createElement("div");
    div.className = "term-line cmd";
    const span = document.createElement("span");
    span.className = "prompt-echo";
    span.textContent = promptEl.textContent + " ";
    div.appendChild(span);
    div.appendChild(document.createTextNode(cmdText));
    log.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function fmtSize(node) {
    if (node.type === "folder") return "-";
    return (node.content || "").length + "B";
  }

  const COMMANDS = {
    help() {
      print([
        "Coolzie OS terminal — available commands:",
        "  ls [path]            list directory contents",
        "  cd <path>             change directory",
        "  pwd                   print working directory",
        "  mkdir <name>          create a folder",
        "  touch <name>          create an empty file",
        "  cat <file>            print file contents",
        "  echo <text> > <file>  write text to a file",
        "  rm <path>             delete a file or folder",
        "  mv <path> <dir>       move a file or folder",
        "  clear                 clear the screen",
        "  whoami                show current user",
        "  date                  show current date and time",
        "  history               show command history",
        "  reset-fs              reset the virtual filesystem"
      ].join("\n"), "info");
    },

    pwd() {
      print(VFS.getCwd());
    },

    whoami() {
      print(userLabel());
    },

    date() {
      print(new Date().toString());
    },

    history() {
      if (history.length === 0) { print("(no history yet)", "info"); return; }
      history.forEach((h, i) => print((i + 1) + "  " + h, "out"));
    },

    clear() {
      log.innerHTML = "";
    },

    "reset-fs"() {
      VFS.reset();
      VFS.setCwd("/home");
      print("Filesystem reset.", "info");
    },

    ls(args) {
      const path = args[0] || ".";
      const items = VFS.list(path);
      if (items === null) { print("ls: cannot access '" + path + "': no such directory", "err"); return; }
      if (items.length === 0) { print("(empty)", "info"); return; }
      print(items.map(i => i.type === "folder" ? i.name + "/" : i.name).join("  "));
    },

    cd(args) {
      const path = args[0] || "/home";
      const abs = VFS.resolve(path);
      const node = VFS.stat(abs);
      if (!node) { print("cd: no such directory: " + path, "err"); return; }
      if (node.type !== "folder") { print("cd: not a directory: " + path, "err"); return; }
      VFS.setCwd(abs);
      refreshPrompt();
    },

    mkdir(args) {
      if (!args[0]) { print("mkdir: missing folder name", "err"); return; }
      const res = VFS.mkdir(args[0]);
      if (!res.ok) print("mkdir: " + res.error, "err");
    },

    touch(args) {
      if (!args[0]) { print("touch: missing file name", "err"); return; }
      const res = VFS.writeFile(args[0], VFS.exists(args[0]) ? undefined : "");
      if (!res.ok) print("touch: " + res.error, "err");
    },

    cat(args) {
      if (!args[0]) { print("cat: missing file name", "err"); return; }
      const res = VFS.readFile(args[0]);
      if (!res.ok) { print("cat: " + res.error, "err"); return; }
      print(res.content.length ? res.content : "(empty file)");
    },

    rm(args) {
      if (!args[0]) { print("rm: missing path", "err"); return; }
      const res = VFS.remove(args[0]);
      if (!res.ok) print("rm: " + res.error, "err");
    },

    mv(args) {
      if (!args[0] || !args[1]) { print("mv: usage: mv <path> <destination folder>", "err"); return; }
      const res = VFS.move(args[0], args[1]);
      if (!res.ok) print("mv: " + res.error, "err");
    },

    echo(args, rawLine) {
      const gtIndex = rawLine.indexOf(">");
      if (gtIndex === -1) {
        print(args.join(" "));
        return;
      }
      const text = rawLine.slice(5, gtIndex).trim().replace(/^["']|["']$/g, "");
      const target = rawLine.slice(gtIndex + 1).trim();
      if (!target) { print("echo: missing target file after '>'", "err"); return; }
      const res = VFS.writeFile(target, text);
      if (!res.ok) print("echo: " + res.error, "err");
    }
  };

  function runCommand(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    history.push(trimmed);
    historyIndex = history.length;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-200)));

    printEcho(trimmed);

    const parts = trimmed.split(/\s+/);
    const cmdName = parts[0];
    const args = parts.slice(1);

    const fn = COMMANDS[cmdName];
    if (!fn) {
      print(cmdName + ": command not found (try 'help')", "err");
      return;
    }
    if (window.ANALYTICS) ANALYTICS.logEvent("terminal_command", { command: cmdName });
    try {
      fn(args, trimmed);
    } catch (e) {
      print(cmdName + ": " + e.message, "err");
    }
  }

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      const val = input.value;
      input.value = "";
      runCommand(val);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        input.value = history[historyIndex] || "";
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        historyIndex++;
        input.value = history[historyIndex] || "";
      } else {
        historyIndex = history.length;
        input.value = "";
      }
    }
  });

  document.addEventListener("click", function () {
    input.focus();
  });

  window.addEventListener("vfs:change", refreshPrompt);

  if (window.ANALYTICS) ANALYTICS.trackPage("terminal");
  refreshPrompt();
  print("Coolzie OS terminal. Type 'help' to see available commands.", "info");
  input.focus();
})();
