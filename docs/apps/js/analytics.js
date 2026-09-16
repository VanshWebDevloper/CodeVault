/* ============================================================
   Coolzie OS — Analytics tracker
   Shared by every app. Logs real local usage events to
   localStorage, namespaced per signed-in user (same placeholder
   auth pattern as VFS/Notes/Tasks). No server involved yet —
   this is designed so a later backend sync can just read
   ANALYTICS.getEvents() / getSessions() and POST them.

   Event shape:
   { type: "note_created" | "note_deleted" | "task_created" |
           "task_completed" | "terminal_command" | ... ,
     ts: epoch ms,
     meta: { ...small extra info, e.g. command name }
   }

   Session shape (time per app):
   { app: "notes" | "tasks" | "terminal" | "files" | "code-editor",
     start: ts, end: ts | null }
   ============================================================ */

(function (global) {
  "use strict";

  const AUTH_KEY = "coolzie_current_user";
  const MAX_EVENTS = 2000;
  const MAX_SESSIONS = 2000;

  function currentUser() {
    return localStorage.getItem(AUTH_KEY) || null;
  }

  function scope() {
    const user = currentUser();
    return user ? "user_" + user : "guest";
  }

  function eventsKey() { return "coolzie_analytics_events_" + scope(); }
  function sessionsKey() { return "coolzie_analytics_sessions_" + scope(); }
  function activeSessionKey() { return "coolzie_analytics_active_" + scope(); }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error("Analytics read failed for " + key, e);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  const ANALYTICS = {
    AUTH_KEY,

    logEvent(type, meta) {
      const events = readJSON(eventsKey(), []);
      events.push({ type, ts: Date.now(), meta: meta || {} });
      writeJSON(eventsKey(), events.slice(-MAX_EVENTS));
    },

    getEvents() {
      return readJSON(eventsKey(), []);
    },

    // Call when an app page loads.
    startSession(appName) {
      const session = { app: appName, start: Date.now(), end: null };
      writeJSON(activeSessionKey(), session);
      return session;
    },

    // Call on unload (or manually) to close out the active session.
    endSession() {
      const active = readJSON(activeSessionKey(), null);
      if (!active) return;
      active.end = Date.now();
      // Ignore sessions under 1s (accidental opens/reloads)
      if (active.end - active.start >= 1000) {
        const sessions = readJSON(sessionsKey(), []);
        sessions.push(active);
        writeJSON(sessionsKey(), sessions.slice(-MAX_SESSIONS));
      }
      localStorage.removeItem(activeSessionKey());
    },

    getSessions() {
      return readJSON(sessionsKey(), []);
    },

    // Convenience: wire up start/end automatically for the current page.
    trackPage(appName) {
      ANALYTICS.startSession(appName);
      window.addEventListener("beforeunload", ANALYTICS.endSession);
      window.addEventListener("pagehide", ANALYTICS.endSession);
    },

    // Aggregate helpers used by the Analytics app itself.
    totalTimeByApp() {
      const sessions = ANALYTICS.getSessions();
      const totals = {};
      sessions.forEach(s => {
        if (!s.end) return;
        totals[s.app] = (totals[s.app] || 0) + (s.end - s.start);
      });
      return totals;
    },

    countEventsByType() {
      const events = ANALYTICS.getEvents();
      const counts = {};
      events.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1; });
      return counts;
    },

    eventsInLastDays(days) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      return ANALYTICS.getEvents().filter(e => e.ts >= cutoff);
    },

    reset() {
      localStorage.removeItem(eventsKey());
      localStorage.removeItem(sessionsKey());
      localStorage.removeItem(activeSessionKey());
    }
  };

  global.ANALYTICS = ANALYTICS;
})(window);
