(function () {
  "use strict";

  // ── Keys ──────────────────────────────────────────────────────────────────────
  const KEYS = {
    USER_NAME:     "tld_userName",
    TASKS:         "tld_tasks",
    LINKS:         "tld_links",
    POMO_DURATION: "tld_pomoDuration",
    THEME:         "tld_theme",
  };

  const NAME_MAX      = 50;
  const TASK_MAX      = 200;
  const LINK_NAME_MAX = 100;
  const LINK_URL_MAX  = 2048;
  const DURATION_MIN  = 1;
  const DURATION_MAX  = 120;

  // ── Storage ───────────────────────────────────────────────────────────────────
  const Storage = {
    save(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    },
    load(key, def = null) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return def;
        return JSON.parse(raw);
      } catch (_) {
        try { localStorage.removeItem(key); } catch (__) {}
        return def;
      }
    },
  };

  // ── State ─────────────────────────────────────────────────────────────────────
  const State = {
    userName: "",
    tasks: [],
    links: [],
    timer: {
      durationMinutes: 25,
      secondsLeft: 1500,
      running: false,
      status: "IDLE",   // IDLE | RUNNING | PAUSED | COMPLETED
      intervalId: null,
    },
    theme: "light",
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MONTHS = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];

  function formatTime(date) {
    return [date.getHours(), date.getMinutes(), date.getSeconds()]
      .map(n => String(n).padStart(2, "0")).join(":");
  }

  function formatDate(date) {
    return `${DAYS[date.getDay()]}, ${String(date.getDate()).padStart(2,"0")} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }

  function getGreeting(hour) {
    if (hour >= 5  && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 18) return "Good Afternoon";
    if (hour >= 18 && hour < 21) return "Good Evening";
    return "Good Night";
  }

  function composeGreeting(msg, name) {
    return (name && name.trim()) ? `${msg}, ${name}!` : msg;
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  // ── Greeting ──────────────────────────────────────────────────────────────────
  const Greeting = {
    init() {
      const saved = Storage.load(KEYS.USER_NAME, "");
      State.userName = typeof saved === "string" ? saved : "";
      Greeting.tick();
      setInterval(Greeting.tick, 1000);
    },
    tick() {
      const now = new Date();
      const el = id => document.getElementById(id);
      if (el("time-display"))    el("time-display").textContent    = formatTime(now);
      if (el("date-display"))    el("date-display").textContent    = formatDate(now);
      if (el("greeting-display")) el("greeting-display").textContent =
        composeGreeting(getGreeting(now.getHours()), State.userName);
    },
    saveName(value) {
      const trimmed = (value || "").trim();
      const err = document.getElementById("name-error");
      if (!trimmed) { Greeting.clearName(); return; }
      if (trimmed.length > NAME_MAX) {
        if (err) err.textContent = `Max ${NAME_MAX} characters.`;
        return;
      }
      State.userName = trimmed;
      Storage.save(KEYS.USER_NAME, trimmed);
      if (err) err.textContent = "";
      Greeting.tick();
    },
    clearName() {
      State.userName = "";
      Storage.save(KEYS.USER_NAME, null);
      Greeting.tick();
    },
  };

  // ── Timer ─────────────────────────────────────────────────────────────────────
  function validateDuration(v) {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < DURATION_MIN || n > DURATION_MAX)
      return { ok: false, error: `Duration must be ${DURATION_MIN}–${DURATION_MAX} min.` };
    return { ok: true, value: n };
  }

  const Timer = {
    fmt(s) {
      return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
    },
    render() {
      const { status, secondsLeft } = State.timer;
      const el = id => document.getElementById(id);
      if (el("timer-display"))    el("timer-display").textContent = Timer.fmt(secondsLeft);
      if (el("timer-completion")) el("timer-completion").classList.toggle("hidden", status !== "COMPLETED");
      const running = status === "RUNNING", done = status === "COMPLETED";
      if (el("btn-start"))     el("btn-start").disabled     = running || done;
      if (el("btn-stop"))      el("btn-stop").disabled      = !running;
      if (el("duration-input")) el("duration-input").disabled = running;
    },
    start() {
      if (State.timer.status === "RUNNING") return;
      clearInterval(State.timer.intervalId);
      State.timer.status = "RUNNING"; State.timer.running = true;
      State.timer.intervalId = setInterval(Timer.tick, 1000);
      Timer.render();
    },
    tick() {
      if (State.timer.secondsLeft <= 0) { Timer.complete(); return; }
      State.timer.secondsLeft--; Timer.render();
    },
    stop() {
      clearInterval(State.timer.intervalId); State.timer.intervalId = null;
      State.timer.running = false; State.timer.status = "PAUSED"; Timer.render();
    },
    reset() {
      clearInterval(State.timer.intervalId); State.timer.intervalId = null;
      State.timer.secondsLeft = State.timer.durationMinutes * 60;
      State.timer.running = false; State.timer.status = "IDLE"; Timer.render();
    },
    complete() {
      clearInterval(State.timer.intervalId); State.timer.intervalId = null;
      State.timer.running = false; State.timer.status = "COMPLETED"; Timer.render();
    },
    saveDuration(v) {
      const r = validateDuration(v);
      const err = document.getElementById("duration-error");
      if (!r.ok) { if (err) err.textContent = r.error; return; }
      State.timer.durationMinutes = r.value;
      Storage.save(KEYS.POMO_DURATION, r.value);
      if (err) err.textContent = "";
      Timer.reset();
    },
    init() {
      const saved = Storage.load(KEYS.POMO_DURATION, 25);
      const n = typeof saved === "number" && saved >= DURATION_MIN && saved <= DURATION_MAX ? saved : 25;
      State.timer.durationMinutes = n;
      State.timer.secondsLeft = n * 60;
      Timer.render();
    },
  };

  // ── To-Do List ────────────────────────────────────────────────────────────────
  function validateTaskText(v) {
    const t = (v || "").trim();
    if (!t) return { ok: false, error: "Task cannot be empty." };
    if (t.length > TASK_MAX) return { ok: false, error: `Max ${TASK_MAX} characters.` };
    return { ok: true };
  }

  function createTask(text) {
    return { id: crypto.randomUUID(), text: text.trim(), done: false, editing: false, createdAt: Date.now() };
  }

  const TodoList = {
    init() {
      const raw = Storage.load(KEYS.TASKS, []);
      State.tasks = Array.isArray(raw) ? raw.map(t => ({ ...t, editing: false })) : [];
      TodoList.render();
    },
    addTask(text) {
      const v = validateTaskText(text);
      const err = document.getElementById("task-error");
      if (!v.ok) { if (err) err.textContent = v.error; return; }
      if (err) err.textContent = "";
      State.tasks.push(createTask(text));
      TodoList._save(); TodoList.render();
    },
    deleteTask(id) {
      State.tasks = State.tasks.filter(t => t.id !== id);
      TodoList._save(); TodoList.render();
    },
    toggleTask(id) {
      const t = State.tasks.find(t => t.id === id);
      if (t) { t.done = !t.done; TodoList._save(); TodoList.render(); }
    },
    startEdit(id) {
      const t = State.tasks.find(t => t.id === id);
      if (t) { t.editing = true; TodoList.render(); }
    },
    confirmEdit(id, text) {
      const t = State.tasks.find(t => t.id === id);
      if (!t) return;
      const trimmed = (text || "").trim();
      if (!trimmed) {
        const li = document.querySelector(`[data-id="${id}"]`);
        if (li) { const e = li.querySelector(".edit-error"); if (e) e.textContent = "Cannot be empty."; }
        return;
      }
      t.text = trimmed; t.editing = false;
      TodoList._save(); TodoList.render();
    },
    cancelEdit(id) {
      const t = State.tasks.find(t => t.id === id);
      if (t) { t.editing = false; TodoList.render(); }
    },
    handleClick(e) {
      const li = e.target.closest("[data-id]"); if (!li) return;
      const id = li.dataset.id;
      if (e.target.classList.contains("task-check"))       TodoList.toggleTask(id);
      else if (e.target.classList.contains("btn-delete"))  TodoList.deleteTask(id);
      else if (e.target.classList.contains("btn-edit"))    TodoList.startEdit(id);
      else if (e.target.classList.contains("btn-save-edit")) {
        const inp = li.querySelector(".task-edit-input");
        TodoList.confirmEdit(id, inp ? inp.value : "");
      } else if (e.target.classList.contains("btn-cancel-edit")) TodoList.cancelEdit(id);
    },
    handleKeydown(e) {
      const li = e.target.closest("[data-id]"); if (!li) return;
      if (e.target.classList.contains("task-edit-input")) {
        if (e.key === "Enter")  TodoList.confirmEdit(li.dataset.id, e.target.value);
        if (e.key === "Escape") TodoList.cancelEdit(li.dataset.id);
      }
    },
    render() {
      const list = document.getElementById("task-list"); if (!list) return;
      list.innerHTML = "";
      if (!State.tasks.length) {
        list.innerHTML = `<li class="empty">No tasks yet. Add one above!</li>`;
        return;
      }
      State.tasks.forEach(t => list.appendChild(TodoList._item(t)));
    },
    _item(t) {
      const li = document.createElement("li");
      li.className = "task-item"; li.dataset.id = t.id;
      if (t.editing) {
        li.innerHTML = `
          <input type="text" class="task-edit-input" value="${_esc(t.text)}" maxlength="${TASK_MAX}" aria-label="Edit task">
          <button class="btn-save-edit ibtn" title="Save">✔</button>
          <button class="btn-cancel-edit ibtn" title="Cancel">✖</button>
          <span class="edit-error err"></span>`;
      } else {
        li.innerHTML = `
          <input type="checkbox" class="task-check" aria-label="Done"${t.done ? " checked" : ""}>
          <span class="task-text${t.done ? " task-done" : ""}">${_esc(t.text)}</span>
          <button class="btn-edit ibtn" title="Edit">✏️</button>
          <button class="btn-delete ibtn" title="Delete">🗑️</button>`;
      }
      return li;
    },
    _save() {
      Storage.save(KEYS.TASKS, State.tasks.map(({ editing, ...r }) => r));
    },
  };

  // ── Quick Links ───────────────────────────────────────────────────────────────
  function validateLinkName(v) {
    const t = (v || "").trim();
    if (!t) return { ok: false, error: "Name cannot be empty." };
    if (t.length > LINK_NAME_MAX) return { ok: false, error: `Max ${LINK_NAME_MAX} chars.` };
    return { ok: true };
  }

  function validateURL(url) {
    if (!url || url.length > LINK_URL_MAX) return { ok: false, error: "URL too long." };
    try {
      const p = new URL(url);
      if (p.protocol !== "http:" && p.protocol !== "https:")
        return { ok: false, error: "URL must start with http:// or https://." };
      if (!p.hostname) return { ok: false, error: "URL must have a valid host." };
      return { ok: true };
    } catch (_) { return { ok: false, error: "Enter a valid URL (e.g. https://example.com)." }; }
  }

  const QuickLinks = {
    init() {
      const raw = Storage.load(KEYS.LINKS, []);
      State.links = Array.isArray(raw) ? raw : [];
      QuickLinks.render();
    },
    addLink(name, url) {
      const nr = validateLinkName(name), ur = validateURL(url);
      const ne = document.getElementById("link-name-error");
      const ue = document.getElementById("link-url-error");
      if (ne) ne.textContent = nr.ok ? "" : nr.error;
      if (ue) ue.textContent = ur.ok ? "" : ur.error;
      if (!nr.ok || !ur.ok) return;
      State.links.push({ id: crypto.randomUUID(), name: name.trim(), url });
      Storage.save(KEYS.LINKS, State.links);
      QuickLinks.render();
    },
    deleteLink(id) {
      State.links = State.links.filter(l => l.id !== id);
      Storage.save(KEYS.LINKS, State.links); QuickLinks.render();
    },
    handleClick(e) {
      const item = e.target.closest("[data-id]"); if (!item) return;
      if (e.target.classList.contains("btn-delete-link")) QuickLinks.deleteLink(item.dataset.id);
    },
    render() {
      const c = document.getElementById("links-list"); if (!c) return;
      c.innerHTML = "";
      if (!State.links.length) {
        c.innerHTML = `<p class="empty">No links yet. Add one above!</p>`;
        return;
      }
      State.links.forEach(l => {
        const div = document.createElement("div");
        div.className = "link-item"; div.dataset.id = l.id;
        div.innerHTML = `
          <a href="${_esc(l.url)}" target="_blank" rel="noopener noreferrer" class="link-btn">${_esc(l.name)}</a>
          <button class="btn-delete-link ibtn" title="Remove">🗑️</button>`;
        c.appendChild(div);
      });
    },
  };

  // ── Theme ─────────────────────────────────────────────────────────────────────
  const Theme = {
    apply(theme) {
      document.documentElement.dataset.theme = theme;
      const btn = document.getElementById("btn-theme-toggle");
      if (btn) { btn.textContent = theme === "light" ? "🌙" : "☀️"; }
    },
    toggle() {
      State.theme = State.theme === "light" ? "dark" : "light";
      Storage.save(KEYS.THEME, State.theme); Theme.apply(State.theme);
    },
    init() {
      const saved = Storage.load(KEYS.THEME, null);
      State.theme = (saved === "light" || saved === "dark") ? saved
        : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      Theme.apply(State.theme);
    },
  };

  // ── Bootstrap ─────────────────────────────────────────────────────────────────
  function on(id, event, fn) {
    const el = document.getElementById(id); if (el) el.addEventListener(event, fn);
  }

  function Bootstrap() {
    Theme.init();
    Greeting.init();
    Timer.init();
    TodoList.init();
    QuickLinks.init();

    on("btn-save-name",    "click",   () => Greeting.saveName(document.getElementById("name-input").value));
    on("name-input",       "keydown", e => { if (e.key === "Enter") Greeting.saveName(e.target.value); });
    on("btn-theme-toggle", "click",   () => Theme.toggle());
    on("btn-start",        "click",   () => Timer.start());
    on("btn-stop",         "click",   () => Timer.stop());
    on("btn-reset",        "click",   () => Timer.reset());
    on("btn-save-duration","click",   () => Timer.saveDuration(document.getElementById("duration-input").value));
    on("btn-add-task",     "click",   () => {
      const inp = document.getElementById("task-input");
      TodoList.addTask(inp.value); inp.value = "";
    });
    on("task-input",       "keydown", e => {
      if (e.key === "Enter") { TodoList.addTask(e.target.value); e.target.value = ""; }
    });
    on("task-list",        "click",   e => TodoList.handleClick(e));
    on("task-list",        "keydown", e => TodoList.handleKeydown(e));
    on("btn-add-link",     "click",   () => {
      const ni = document.getElementById("link-name-input");
      const ui = document.getElementById("link-url-input");
      QuickLinks.addLink(ni.value, ui.value); ni.value = ""; ui.value = "";
    });
    on("links-list",       "click",   e => QuickLinks.handleClick(e));
  }

  document.addEventListener("DOMContentLoaded", Bootstrap);

})();
