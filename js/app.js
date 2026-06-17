(function () {
  "use strict";

  // ─── CONSTANTS ────────────────────────────────────────────────────────────────

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

  // ─── STORAGE ──────────────────────────────────────────────────────────────────

  const Storage = {
    /**
     * Persist a value under the given key.
     * Silently no-ops if localStorage is unavailable or serialisation fails.
     * Requirements: 9.1, 9.2, 9.3, 9.4
     */
    save(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        // Silently fail; in-memory state is still authoritative
      }
    },

    /**
     * Load and parse a value from localStorage.
     * On any failure (unavailable storage, corrupted JSON) the corrupted key is
     * deleted and defaultValue is returned — no exception is propagated.
     * Requirements: 9.2, 9.4, 9.5
     */
    load(key, defaultValue = null) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return defaultValue;
        return JSON.parse(raw);
      } catch (e) {
        // Corrupted entry — delete it to prevent repeated failures
        try { localStorage.removeItem(key); } catch (_) {}
        return defaultValue;
      }
    },
  };

  // ─── STATE ────────────────────────────────────────────────────────────────────
  // Requirements: 9.1

  const State = {
    userName: "",          // string, "" means no name set
    tasks: [],             // Task[]
    links: [],             // Link[]
    timer: {
      durationMinutes: 25, // integer 1-120
      secondsLeft: 1500,   // integer, derived from durationMinutes on reset/load
      running: false,      // boolean
      status: "IDLE",      // "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED"
      intervalId: null,    // setInterval handle (not persisted)
    },
    theme: "light",        // "light" | "dark"
  };

  // ─── GREETING ─────────────────────────────────────────────────────────────────
  // Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.2

  const DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MONTHS = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];

  /**
   * Returns the current time as "HH:MM:SS" (zero-padded).
   * Requirements: 1.1
   * @param {Date} date
   * @returns {string}
   */
  function formatTime(date) {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  /**
   * Returns the current date as "Weekday, DD Month YYYY".
   * Requirements: 1.2
   * @param {Date} date
   * @returns {string}
   */
  function formatDate(date) {
    const day   = DAYS[date.getDay()];
    const dd    = String(date.getDate()).padStart(2, "0");
    const month = MONTHS[date.getMonth()];
    const yyyy  = date.getFullYear();
    return `${day}, ${dd} ${month} ${yyyy}`;
  }

  /**
   * Returns the time-of-day greeting string based on the given hour (0–23).
   * Requirements: 1.3, 1.4, 1.5, 1.6
   * @param {number} hour
   * @returns {string}
   */
  function getGreeting(hour) {
    if (hour >= 5  && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 18) return "Good Afternoon";
    if (hour >= 18 && hour < 21) return "Good Evening";
    return "Good Night";
  }

  /**
   * Composes a personalized greeting.
   * Returns "${msg}, ${name}!" when name is non-empty and non-whitespace-only;
   * otherwise returns just msg.
   * Requirements: 2.2
   * @param {string} msg
   * @param {string} name
   * @returns {string}
   */
  function composeGreeting(msg, name) {
    return (name && name.trim()) ? `${msg}, ${name}!` : msg;
  }

  // ─── GREETING NAMESPACE ───────────────────────────────────────────────────────
  // Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6

  const Greeting = {
    /**
     * Initialises the Greeting widget:
     *  1. Restores saved User_Name from localStorage into State.
     *  2. Renders the current greeting immediately.
     *  3. Starts a 1-second interval to keep the clock/date/greeting live.
     * Requirements: 1.1, 1.7, 2.3, 2.4
     */
    init() {
      const saved = Storage.load(KEYS.USER_NAME, "");
      State.userName = (typeof saved === "string") ? saved : "";
      Greeting.renderGreeting();
      setInterval(Greeting.tick, 1000);
      Greeting.tick();
    },

    /**
     * Called every second by the clock interval.
     * Updates #time-display, #date-display, and #greeting-display.
     * Requirements: 1.1, 1.2, 1.7
     */
    tick() {
      const now    = new Date();
      const timeEl = document.getElementById("time-display");
      const dateEl = document.getElementById("date-display");
      if (timeEl) timeEl.textContent = formatTime(now);
      if (dateEl) dateEl.textContent = formatDate(now);
      Greeting.renderGreeting();
    },

    /**
     * Validates and persists a new User_Name value.
     *  - Empty / whitespace-only → delegates to clearName().
     *  - Length > NAME_MAX       → shows inline error, returns without saving.
     *  - Otherwise               → saves to State + Storage, clears error, re-renders.
     * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6
     * @param {string} value
     */
    saveName(value) {
      const trimmed = (value || "").trim();
      const errorEl = document.getElementById("name-error");
      if (!trimmed) {
        Greeting.clearName();
        return;
      }
      if (trimmed.length > NAME_MAX) {
        if (errorEl) errorEl.textContent = `Name must be ${NAME_MAX} characters or fewer.`;
        return;
      }
      State.userName = trimmed;
      Storage.save(KEYS.USER_NAME, trimmed);
      if (errorEl) errorEl.textContent = "";
      Greeting.renderGreeting();
    },

    /**
     * Clears the User_Name from both State and localStorage, then re-renders.
     * Requirements: 2.5
     */
    clearName() {
      State.userName = "";
      Storage.save(KEYS.USER_NAME, null);
      Greeting.renderGreeting();
    },

    /**
     * Composes the greeting string from the current hour and State.userName,
     * then writes it to #greeting-display.
     * Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 2.2
     */
    renderGreeting() {
      const hour = new Date().getHours();
      const msg  = getGreeting(hour);
      const text = composeGreeting(msg, State.userName);
      const el   = document.getElementById("greeting-display");
      if (el) el.textContent = text;
    },
  };

  // ─── TIMER ────────────────────────────────────────────────────────────────────
  // Requirements: 3.1, 3.6, 3.7, 3.8, 4.5

  /**
   * Validates a Pomodoro duration value: must be an integer between DURATION_MIN and DURATION_MAX.
   * Requirements: 4.1, 4.4
   * @param {string|number} value
   * @returns {{ ok: boolean, value?: number, error?: string }}
   */
  function validateDuration(value) {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < DURATION_MIN || n > DURATION_MAX) {
      return { ok: false, error: `Duration must be between ${DURATION_MIN} and ${DURATION_MAX} minutes.` };
    }
    return { ok: true, value: n };
  }

  const Timer = {
    /**
     * Converts a total seconds count to a zero-padded "MM:SS" string.
     * Requirements: 3.1
     * @param {number} seconds
     * @returns {string}
     */
    formatTime(seconds) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    },

    /**
     * Updates the timer display and synchronises button/input disabled states
     * with the current timer status (IDLE | RUNNING | PAUSED | COMPLETED).
     *
     * Button-state machine:
     *   RUNNING   → Start disabled, Stop enabled,  duration-input disabled
     *   IDLE/PAUSED → Start enabled,  Stop disabled, duration-input enabled
     *   COMPLETED → Start disabled,  Stop disabled, duration-input enabled,
     *               completion banner visible
     *
     * Requirements: 3.6, 3.7, 3.8, 4.5
     */
    render() {
      const { status, secondsLeft } = State.timer;
      const display     = document.getElementById("timer-display");
      const btnStart    = document.getElementById("btn-start");
      const btnStop     = document.getElementById("btn-stop");
      const durationInp = document.getElementById("duration-input");
      const completion  = document.getElementById("timer-completion");

      if (display)    display.textContent = Timer.formatTime(secondsLeft);
      if (completion) completion.classList.toggle("hidden", status !== "COMPLETED");

      const isRunning   = status === "RUNNING";
      const isCompleted = status === "COMPLETED";

      if (btnStart)    btnStart.disabled    = isRunning || isCompleted;
      if (btnStop)     btnStop.disabled     = !isRunning;
      if (durationInp) durationInp.disabled = isRunning;
    },

    /**
     * Starts the countdown. No-op if already RUNNING.
     * Clears any existing interval before creating a new one to prevent duplicates.
     * Requirements: 3.2, 3.6, 3.7
     */
    start() {
      if (State.timer.status === "RUNNING") return;
      clearInterval(State.timer.intervalId);
      State.timer.running = true;
      State.timer.status = "RUNNING";
      State.timer.intervalId = setInterval(Timer.tick, 1000);
      Timer.render();
    },

    /**
     * Decrements secondsLeft by one each tick.
     * Calls complete() when the countdown reaches zero instead of going negative.
     * Requirements: 3.2, 3.5
     */
    tick() {
      if (State.timer.secondsLeft <= 0) {
        Timer.complete();
        return;
      }
      State.timer.secondsLeft -= 1;
      Timer.render();
    },

    /**
     * Pauses the countdown by clearing the interval and setting status to PAUSED.
     * Requirements: 3.3, 3.8
     */
    stop() {
      clearInterval(State.timer.intervalId);
      State.timer.intervalId = null;
      State.timer.running = false;
      State.timer.status = "PAUSED";
      Timer.render();
    },

    /**
     * Resets the timer to the full duration and returns to IDLE state.
     * Clears the completion banner via render().
     * Requirements: 3.4, 3.8
     */
    reset() {
      clearInterval(State.timer.intervalId);
      State.timer.intervalId = null;
      State.timer.secondsLeft = State.timer.durationMinutes * 60;
      State.timer.running = false;
      State.timer.status = "IDLE";
      Timer.render();
    },

    /**
     * Fires when the countdown reaches 00:00.
     * Stops the interval, marks status COMPLETED, and shows the completion banner.
     * Requirements: 3.5, 3.8
     */
    complete() {
      clearInterval(State.timer.intervalId);
      State.timer.intervalId = null;
      State.timer.running = false;
      State.timer.status = "COMPLETED";
      Timer.render();
    },

    /**
     * Validates the given duration value and, if valid, updates the timer duration,
     * persists it to localStorage, clears any error, and resets the timer.
     * On failure writes a validation message to #duration-error.
     * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
     * @param {string|number} value
     */
    saveDuration(value) {
      const result = validateDuration(value);
      const errorEl = document.getElementById("duration-error");
      if (!result.ok) {
        if (errorEl) errorEl.textContent = result.error;
        return;
      }
      State.timer.durationMinutes = result.value;
      Storage.save(KEYS.POMO_DURATION, result.value);
      if (errorEl) errorEl.textContent = "";
      Timer.reset();
    },

    /**
     * Initialises the Timer widget:
     *  1. Loads saved Pomodoro_Duration from localStorage (default 25).
     *  2. Validates the loaded value; falls back to 25 if out of range.
     *  3. Sets State.timer.durationMinutes and secondsLeft.
     *  4. Renders the timer display.
     * Requirements: 4.3, 3.1
     */
    init() {
      const saved = Storage.load(KEYS.POMO_DURATION, 25);
      const n = (typeof saved === "number" && saved >= DURATION_MIN && saved <= DURATION_MAX) ? saved : 25;
      State.timer.durationMinutes = n;
      State.timer.secondsLeft = n * 60;
      Timer.render();
    },
  };

  // ─── TO-DO LIST ───────────────────────────────────────────────────────────────
  // Requirements: 5.2, 5.11

  /**
   * Validates task text: must be 1-200 non-whitespace characters.
   * @param {string} value
   * @returns {{ ok: boolean, error?: string }}
   */
  function validateTaskText(value) {
    const trimmed = (value || "").trim();
    if (trimmed.length === 0) return { ok: false, error: "Task cannot be empty." };
    if (trimmed.length > TASK_MAX) return { ok: false, error: `Task must be ${TASK_MAX} characters or fewer.` };
    return { ok: true };
  }

  /**
   * Creates a new task object.
   * @param {string} text
   * @returns {{ id: string, text: string, done: boolean, editing: boolean, createdAt: number }}
   */
  function createTask(text) {
    return {
      id: crypto.randomUUID(),
      text: text.trim(),
      done: false,
      editing: false,
      createdAt: Date.now(),
    };
  }

  /** Escapes HTML special chars to prevent XSS in innerHTML. */
  function _esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const TodoList = {
    init() {
      const raw = Storage.load(KEYS.TASKS, []);
      State.tasks = Array.isArray(raw)
        ? raw.map(t => ({ ...t, editing: false }))
        : [];
      TodoList.render();
    },

    addTask(text) {
      const v = validateTaskText(text);
      const errorEl = document.getElementById("task-error");
      if (!v.ok) {
        if (errorEl) errorEl.textContent = v.error;
        return;
      }
      if (errorEl) errorEl.textContent = "";
      State.tasks.push(createTask(text));
      TodoList._persist();
      TodoList.render();
    },

    deleteTask(id) {
      State.tasks = State.tasks.filter(t => t.id !== id);
      TodoList._persist();
      TodoList.render();
    },

    toggleTask(id) {
      const task = State.tasks.find(t => t.id === id);
      if (task) task.done = !task.done;
      TodoList._persist();
      TodoList.render();
    },

    startEdit(id) {
      const task = State.tasks.find(t => t.id === id);
      if (task) task.editing = true;
      TodoList.render();
    },

    confirmEdit(id, text) {
      const task = State.tasks.find(t => t.id === id);
      if (!task) return;
      const trimmed = (text || "").trim();
      if (!trimmed) {
        // Show error on the inline input
        const li = document.querySelector(`[data-id="${id}"]`);
        if (li) {
          const errEl = li.querySelector(".edit-error");
          if (errEl) errEl.textContent = "Task cannot be empty.";
        }
        return;
      }
      task.text = trimmed;
      task.editing = false;
      TodoList._persist();
      TodoList.render();
    },

    cancelEdit(id) {
      const task = State.tasks.find(t => t.id === id);
      if (task) task.editing = false;
      TodoList.render();
    },

    handleClick(e) {
      const li = e.target.closest("[data-id]");
      if (!li) return;
      const id = li.dataset.id;
      if (e.target.classList.contains("task-check")) {
        TodoList.toggleTask(id);
      } else if (e.target.classList.contains("btn-delete-task")) {
        TodoList.deleteTask(id);
      } else if (e.target.classList.contains("btn-edit-task")) {
        TodoList.startEdit(id);
      } else if (e.target.classList.contains("btn-save-edit")) {
        const input = li.querySelector(".task-edit-input");
        TodoList.confirmEdit(id, input ? input.value : "");
      } else if (e.target.classList.contains("btn-cancel-edit")) {
        TodoList.cancelEdit(id);
      }
    },

    handleKeydown(e) {
      const li = e.target.closest("[data-id]");
      if (!li) return;
      const id = li.dataset.id;
      if (e.target.classList.contains("task-edit-input")) {
        if (e.key === "Enter") {
          TodoList.confirmEdit(id, e.target.value);
        } else if (e.key === "Escape") {
          TodoList.cancelEdit(id);
        }
      }
    },

    render() {
      const list = document.getElementById("task-list");
      if (!list) return;
      list.innerHTML = "";
      State.tasks.forEach(task => list.appendChild(TodoList.renderItem(task)));
    },

    renderItem(task) {
      const li = document.createElement("li");
      li.className = "task-item";
      li.dataset.id = task.id;

      if (task.editing) {
        li.innerHTML = `
        <input type="text" class="task-edit-input" value="${_esc(task.text)}" maxlength="200" aria-label="Edit task">
        <button class="btn-save-edit" aria-label="Save edit">✔</button>
        <button class="btn-cancel-edit" aria-label="Cancel edit">✖</button>
        <span class="edit-error error-hint" aria-live="polite"></span>
      `;
      } else {
        li.innerHTML = `
        <input type="checkbox" class="task-check" aria-label="Mark task complete"${task.done ? " checked" : ""}>
        <span class="task-text${task.done ? " task-done" : ""}">${_esc(task.text)}</span>
        <button class="btn-edit-task" aria-label="Edit task">✏️</button>
        <button class="btn-delete-task" aria-label="Delete task">🗑️</button>
      `;
      }
      return li;
    },

    _persist() {
      const toSave = State.tasks.map(({ editing, ...rest }) => rest);
      Storage.save(KEYS.TASKS, toSave);
    },
  };

  // ─── QUICK LINKS ──────────────────────────────────────────────────────────────
  // Requirements: 7.1, 7.2, 7.7

  /**
   * Validates a link display name: must be 1–100 non-whitespace characters.
   * @param {string} value
   * @returns {{ ok: boolean, error?: string }}
   */
  function validateLinkName(value) {
    const trimmed = (value || "").trim();
    if (trimmed.length === 0) return { ok: false, error: "Link name cannot be empty." };
    if (trimmed.length > LINK_NAME_MAX) return { ok: false, error: `Link name must be ${LINK_NAME_MAX} characters or fewer.` };
    return { ok: true };
  }

  /**
   * Validates a URL: must be http/https, non-empty hostname, ≤2048 chars.
   * @param {string} url
   * @returns {{ ok: boolean, error?: string }}
   */
  function validateURL(url) {
    if (!url || url.length > LINK_URL_MAX) {
      return { ok: false, error: `URL must be ${LINK_URL_MAX} characters or fewer.` };
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "URL must start with http:// or https://." };
      }
      if (!parsed.hostname) {
        return { ok: false, error: "URL must have a valid host." };
      }
      return { ok: true };
    } catch (_) {
      return { ok: false, error: "Please enter a valid URL (e.g. https://example.com)." };
    }
  }

  /**
   * Creates a new link object.
   * @param {string} name
   * @param {string} url
   * @returns {{ id: string, name: string, url: string }}
   */
  function createLink(name, url) {
    return {
      id: crypto.randomUUID(),
      name: name.trim(),
      url,
    };
  }

  const QuickLinks = {
    init() {
      const raw = Storage.load(KEYS.LINKS, []);
      State.links = Array.isArray(raw) ? raw : [];
      QuickLinks.render();
    },

    addLink(name, url) {
      const nameResult = validateLinkName(name);
      const urlResult  = validateURL(url);
      const nameErr = document.getElementById("link-name-error");
      const urlErr  = document.getElementById("link-url-error");
      if (nameErr) nameErr.textContent = nameResult.ok ? "" : nameResult.error;
      if (urlErr)  urlErr.textContent  = urlResult.ok  ? "" : urlResult.error;
      if (!nameResult.ok || !urlResult.ok) return;
      State.links.push(createLink(name, url));
      Storage.save(KEYS.LINKS, State.links);
      QuickLinks.render();
    },

    deleteLink(id) {
      State.links = State.links.filter(l => l.id !== id);
      Storage.save(KEYS.LINKS, State.links);
      QuickLinks.render();
    },

    handleClick(e) {
      const item = e.target.closest("[data-id]");
      if (!item) return;
      if (e.target.classList.contains("btn-delete-link")) {
        QuickLinks.deleteLink(item.dataset.id);
      }
    },

    render() {
      const container = document.getElementById("links-list");
      if (!container) return;
      container.innerHTML = "";
      if (State.links.length === 0) {
        container.innerHTML = `<p style="color:var(--color-muted);font-size:0.875rem;">No links yet. Add one above.</p>`;
        return;
      }
      State.links.forEach(link => container.appendChild(QuickLinks.renderItem(link)));
    },

    renderItem(link) {
      const div = document.createElement("div");
      div.className = "link-item";
      div.dataset.id = link.id;
      div.innerHTML = `
      <a href="${_esc(link.url)}" target="_blank" rel="noopener noreferrer"
         class="link-btn">${_esc(link.name)}</a>
      <button class="btn-delete-link" aria-label="Delete link">🗑️</button>
    `;
      return div;
    },
  };

  // ─── THEME ────────────────────────────────────────────────────────────────────
  // Requirements: 8.1–8.6

  const Theme = {
    /**
     * Apply a theme to the document and update the toggle button.
     * Sets data-theme on <html>, updates the icon and aria-label on #btn-theme-toggle.
     * Requirements: 8.1, 8.2
     */
    apply(theme) {
      document.documentElement.dataset.theme = theme;
      const btn = document.getElementById("btn-theme-toggle");
      if (btn) {
        btn.textContent = theme === "light" ? "🌙" : "☀️";
        btn.setAttribute(
          "aria-label",
          theme === "light" ? "Switch to dark theme" : "Switch to light theme"
        );
      }
    },

    /**
     * Persist the current theme to localStorage.
     * Requirements: 8.3
     */
    persist(theme) {
      Storage.save(KEYS.THEME, theme);
    },

    /**
     * Toggle between "light" and "dark", persist, then apply.
     * Requirements: 8.1, 8.2, 8.3
     */
    toggle() {
      State.theme = State.theme === "light" ? "dark" : "light";
      Theme.persist(State.theme);
      Theme.apply(State.theme);
    },

    /**
     * Initialise the theme on page load:
     *  1. Read saved preference from localStorage.
     *  2. Fall back to prefers-color-scheme if nothing is saved.
     *  3. Update State.theme and apply.
     * Requirements: 8.4, 8.5, 8.6
     */
    init() {
      const saved = Storage.load(KEYS.THEME, null);
      if (saved === "light" || saved === "dark") {
        State.theme = saved;
      } else {
        State.theme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      Theme.apply(State.theme);
    },
  };

  // ─── BOOTSTRAP ────────────────────────────────────────────────────────────────

  const Bootstrap = {
    init() {
      Theme.init();
      Greeting.init();
      Timer.init();
      TodoList.init();
      QuickLinks.init();

      // ── Greeting bindings ──
      document.getElementById("btn-save-name")
        .addEventListener("click", () => {
          Greeting.saveName(document.getElementById("name-input").value);
        });
      document.getElementById("name-input")
        .addEventListener("keydown", e => {
          if (e.key === "Enter") Greeting.saveName(e.target.value);
        });

      // ── Theme binding ──
      document.getElementById("btn-theme-toggle")
        .addEventListener("click", () => Theme.toggle());

      // ── Timer bindings ──
      document.getElementById("btn-start")
        .addEventListener("click", () => Timer.start());
      document.getElementById("btn-stop")
        .addEventListener("click", () => Timer.stop());
      document.getElementById("btn-reset")
        .addEventListener("click", () => Timer.reset());
      document.getElementById("btn-save-duration")
        .addEventListener("click", () =>
          Timer.saveDuration(document.getElementById("duration-input").value));

      // ── To-Do bindings ──
      document.getElementById("btn-add-task")
        .addEventListener("click", () => {
          const inp = document.getElementById("task-input");
          TodoList.addTask(inp.value);
          inp.value = "";
        });
      document.getElementById("task-input")
        .addEventListener("keydown", e => {
          if (e.key === "Enter") {
            TodoList.addTask(e.target.value);
            e.target.value = "";
          }
        });
      document.getElementById("task-list")
        .addEventListener("click",   e => TodoList.handleClick(e));
      document.getElementById("task-list")
        .addEventListener("keydown", e => TodoList.handleKeydown(e));

      // ── Quick Links bindings ──
      document.getElementById("btn-add-link")
        .addEventListener("click", () => {
          QuickLinks.addLink(
            document.getElementById("link-name-input").value,
            document.getElementById("link-url-input").value
          );
          document.getElementById("link-name-input").value = "";
          document.getElementById("link-url-input").value = "";
        });
      document.getElementById("links-list")
        .addEventListener("click", e => QuickLinks.handleClick(e));
    },
  };

  document.addEventListener("DOMContentLoaded", Bootstrap.init);

  // ─── EXPORT GUARD (for Vitest / Node test runner) ─────────────────────────────
  if (typeof module !== "undefined") {
    module.exports = {
      KEYS, Storage, State,
      formatTime, formatDate, getGreeting, composeGreeting,
      validateDuration, validateTaskText, createTask,
      validateLinkName, validateURL, createLink,
      Greeting, Timer, TodoList, QuickLinks, Theme, Bootstrap,
    };
  }

})();
