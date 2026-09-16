/* ============================================================
   Coolzie OS — Virtual Filesystem (VFS)
   Shared by Terminal and Files apps. Everything lives in
   localStorage as a JSON tree, namespaced per signed-in user
   (same placeholder-auth pattern as Notes/Tasks).

   Node shape:
   {
     type: "folder" | "file",
     name: "string",
     createdAt: ts,
     updatedAt: ts,
     content: "string"        // files only
     children: { name: node } // folders only
   }

   Paths are always absolute, "/" separated, starting at "/"
   which is the root folder. No trailing slash except root itself.
   ============================================================ */

(function (global) {
  "use strict";

  const AUTH_KEY = "coolzie_current_user";
  const VFS_VERSION = 1;

  function currentUser() {
    return localStorage.getItem(AUTH_KEY) || null;
  }

  function storageKey() {
    const user = currentUser();
    const scope = user ? "user_" + user : "guest";
    return "coolzie_vfs_" + scope;
  }

  function freshRoot() {
    const now = Date.now();
    return {
      type: "folder",
      name: "/",
      createdAt: now,
      updatedAt: now,
      children: {
        "home": {
          type: "folder",
          name: "home",
          createdAt: now,
          updatedAt: now,
          children: {
            "welcome.txt": {
              type: "file",
              name: "welcome.txt",
              createdAt: now,
              updatedAt: now,
              content: "Welcome to Coolzie OS.\n\nThis is a virtual filesystem shared between\nthe Terminal and Files apps. Try:\n\n  ls\n  cd home\n  cat welcome.txt\n  mkdir projects\n  help\n"
            }
          }
        }
      }
    };
  }

  function load() {
    const key = storageKey();
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        const root = freshRoot();
        save(root);
        return root;
      }
      const parsed = JSON.parse(raw);
      return parsed.root || freshRoot();
    } catch (e) {
      console.error("VFS load failed, resetting", e);
      const root = freshRoot();
      save(root);
      return root;
    }
  }

  function save(root) {
    const key = storageKey();
    localStorage.setItem(key, JSON.stringify({ version: VFS_VERSION, root }));
    window.dispatchEvent(new CustomEvent("vfs:change"));
  }

  function splitPath(path) {
    return path.split("/").filter(Boolean);
  }

  function normalize(path, cwd) {
    let parts;
    if (path.startsWith("/")) {
      parts = splitPath(path);
    } else {
      parts = splitPath(cwd).concat(splitPath(path));
    }
    const out = [];
    for (const p of parts) {
      if (p === ".") continue;
      if (p === "..") { out.pop(); continue; }
      out.push(p);
    }
    return "/" + out.join("/");
  }

  function getNode(root, path) {
    const parts = splitPath(path);
    let node = root;
    for (const part of parts) {
      if (!node || node.type !== "folder" || !node.children[part]) return null;
      node = node.children[part];
    }
    return node;
  }

  function getParent(root, path) {
    const parts = splitPath(path);
    const name = parts.pop();
    const parentPath = "/" + parts.join("/");
    const parent = getNode(root, parentPath) || (parts.length === 0 ? root : null);
    return { parent, name, parentPath };
  }

  const VFS = {
    AUTH_KEY,

    getCwd() {
      return sessionStorage.getItem("coolzie_vfs_cwd_" + (currentUser() || "guest")) || "/home";
    },

    setCwd(path) {
      sessionStorage.setItem("coolzie_vfs_cwd_" + (currentUser() || "guest"), path);
    },

    normalize,

    resolve(path, cwd) {
      return normalize(path, cwd != null ? cwd : VFS.getCwd());
    },

    list(path) {
      const root = load();
      const abs = normalize(path, VFS.getCwd());
      const node = abs === "/" ? root : getNode(root, abs);
      if (!node || node.type !== "folder") return null;
      return Object.values(node.children).sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    },

    stat(path) {
      const root = load();
      const abs = normalize(path, VFS.getCwd());
      return abs === "/" ? root : getNode(root, abs);
    },

    exists(path) {
      return !!VFS.stat(path);
    },

    mkdir(path) {
      const root = load();
      const abs = normalize(path, VFS.getCwd());
      if (abs === "/") return { ok: false, error: "cannot recreate root" };
      const { parent, name } = getParent(root, abs);
      if (!parent || parent.type !== "folder") return { ok: false, error: "no such directory" };
      if (parent.children[name]) return { ok: false, error: "already exists" };
      const now = Date.now();
      parent.children[name] = { type: "folder", name, createdAt: now, updatedAt: now, children: {} };
      parent.updatedAt = now;
      save(root);
      return { ok: true };
    },

    writeFile(path, content) {
      const root = load();
      const abs = normalize(path, VFS.getCwd());
      const { parent, name } = getParent(root, abs);
      if (!parent || parent.type !== "folder") return { ok: false, error: "no such directory" };
      const now = Date.now();
      if (parent.children[name] && parent.children[name].type === "folder") {
        return { ok: false, error: "is a directory" };
      }
      if (parent.children[name]) {
        parent.children[name].content = content;
        parent.children[name].updatedAt = now;
      } else {
        parent.children[name] = { type: "file", name, createdAt: now, updatedAt: now, content: content || "" };
      }
      parent.updatedAt = now;
      save(root);
      return { ok: true };
    },

    readFile(path) {
      const node = VFS.stat(path);
      if (!node) return { ok: false, error: "no such file" };
      if (node.type !== "file") return { ok: false, error: "is a directory" };
      return { ok: true, content: node.content };
    },

    remove(path) {
      const root = load();
      const abs = normalize(path, VFS.getCwd());
      if (abs === "/") return { ok: false, error: "cannot remove root" };
      const { parent, name } = getParent(root, abs);
      if (!parent || !parent.children[name]) return { ok: false, error: "no such file or directory" };
      delete parent.children[name];
      parent.updatedAt = Date.now();
      save(root);
      return { ok: true };
    },

    rename(path, newName) {
      const root = load();
      const abs = normalize(path, VFS.getCwd());
      const { parent, name } = getParent(root, abs);
      if (!parent || !parent.children[name]) return { ok: false, error: "no such file or directory" };
      if (parent.children[newName]) return { ok: false, error: "target already exists" };
      const node = parent.children[name];
      node.name = newName;
      node.updatedAt = Date.now();
      delete parent.children[name];
      parent.children[newName] = node;
      save(root);
      return { ok: true };
    },

    move(fromPath, toDir) {
      const root = load();
      const fromAbs = normalize(fromPath, VFS.getCwd());
      const toAbs = normalize(toDir, VFS.getCwd());
      const { parent: fromParent, name } = getParent(root, fromAbs);
      const destNode = toAbs === "/" ? root : getNode(root, toAbs);
      if (!fromParent || !fromParent.children[name]) return { ok: false, error: "no such file or directory" };
      if (!destNode || destNode.type !== "folder") return { ok: false, error: "destination is not a directory" };
      if (destNode.children[name]) return { ok: false, error: "target already exists" };
      const node = fromParent.children[name];
      delete fromParent.children[name];
      destNode.children[name] = node;
      node.updatedAt = Date.now();
      save(root);
      return { ok: true };
    },

    exportNode(path) {
      const node = VFS.stat(path);
      if (!node) return null;
      return JSON.parse(JSON.stringify(node));
    },

    importNode(destDir, node) {
      const root = load();
      const abs = normalize(destDir, VFS.getCwd());
      const dest = abs === "/" ? root : getNode(root, abs);
      if (!dest || dest.type !== "folder") return { ok: false, error: "no such directory" };
      let name = node.name;
      let i = 1;
      while (dest.children[name]) {
        name = node.name + " (" + i + ")";
        i++;
      }
      const clone = JSON.parse(JSON.stringify(node));
      clone.name = name;
      dest.children[name] = clone;
      dest.updatedAt = Date.now();
      save(root);
      return { ok: true, name };
    },

    reset() {
      save(freshRoot());
    },

    _raw() { return load(); }
  };

  global.VFS = VFS;
})(window);
