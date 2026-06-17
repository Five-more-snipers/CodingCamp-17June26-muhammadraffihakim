const fc = require('fast-check');
const { KEYS, Storage, State, Theme, Timer, Greeting, formatTime, formatDate, getGreeting, composeGreeting } = require('./js/app');

describe('Storage', () => {
  beforeEach(() => {
    // Clear localStorage between tests
    localStorage.clear();
  });

  // Property 5: User Name Storage Round-Trip
  // Validates: Requirements 2.3, 9.2
  it('P5: saves and loads user name round-trip', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 50 }), (name) => {
        Storage.save(KEYS.USER_NAME, name);
        const loaded = Storage.load(KEYS.USER_NAME, null);
        return loaded === name;
      }),
      { numRuns: 100 }
    );
  });

  // Property 11: Pomodoro Duration Storage Round-Trip
  // Validates: Requirements 4.3, 9.2
  it('P11: saves and loads pomodoro duration round-trip', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 120 }), (duration) => {
        Storage.save(KEYS.POMO_DURATION, duration);
        const loaded = Storage.load(KEYS.POMO_DURATION, 25);
        return loaded === duration;
      }),
      { numRuns: 100 }
    );
  });

  // Property 22: Corrupted Storage Graceful Fallback
  // Validates: Requirements 9.5
  it('P22: corrupted storage returns default without throwing', () => {
    fc.assert(
      fc.property(fc.string(), (corruptedValue) => {
        // Only test strings that are definitely invalid JSON
        // (filter out valid JSON strings like "null", "true", numbers, quoted strings)
        try {
          JSON.parse(corruptedValue);
          return true; // skip valid JSON
        } catch (_) {
          // corruptedValue is invalid JSON — test the fallback
          localStorage.setItem('test_key', corruptedValue);
          const defaultValue = 'DEFAULT';
          const result = Storage.load('test_key', defaultValue);
          return result === defaultValue;
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Greeting / Time-formatting properties ────────────────────────────────────

describe('Greeting – time and date formatting + greeting logic', () => {
  const VALID_DAYS = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ];
  const VALID_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Feature: todo-life-dashboard, Property 1: Time Formatting Correctness
  // Validates: Requirements 1.1
  it('P1: formatTime returns HH:MM:SS with valid ranges for any Date', () => {
    fc.assert(
      fc.property(fc.date(), (date) => {
        const result = formatTime(date);
        // Must match pattern HH:MM:SS
        expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        const [hh, mm, ss] = result.split(':').map(Number);
        expect(hh).toBeGreaterThanOrEqual(0);
        expect(hh).toBeLessThanOrEqual(23);
        expect(mm).toBeGreaterThanOrEqual(0);
        expect(mm).toBeLessThanOrEqual(59);
        expect(ss).toBeGreaterThanOrEqual(0);
        expect(ss).toBeLessThanOrEqual(59);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: todo-life-dashboard, Property 2: Date Formatting Correctness
  // Validates: Requirements 1.2
  it('P2: formatDate returns "Weekday, DD Month YYYY" with valid components for any Date', () => {
    // Constrain to years 1000-9998 (local time) so getFullYear() always returns a
    // 4-digit number, matching the "YYYY" requirement (Requirements 1.2).
    // We stay well within year 9999 to avoid timezone-offset boundary issues where
    // a UTC date near Dec 31 9999 could roll into year 10000 in local time.
    const realisticDate = fc.date({
      min: new Date('1000-01-02T00:00:00.000Z'),
      max: new Date('9998-12-30T00:00:00.000Z'),
    });
    fc.assert(
      fc.property(realisticDate, (date) => {
        const result = formatDate(date);
        // Pattern: "Weekday, DD Month YYYY"
        expect(result).toMatch(/^[A-Za-z]+, \d{2} [A-Za-z]+ \d{4}$/);
        const [weekdayPart, rest] = result.split(', ');
        expect(VALID_DAYS).toContain(weekdayPart);
        const parts = rest.split(' ');
        expect(parts).toHaveLength(3);
        const [dd, month, yyyy] = parts;
        // Zero-padded day: 01-31
        expect(dd).toMatch(/^\d{2}$/);
        const dayNum = Number(dd);
        expect(dayNum).toBeGreaterThanOrEqual(1);
        expect(dayNum).toBeLessThanOrEqual(31);
        // Valid month name
        expect(VALID_MONTHS).toContain(month);
        // 4-digit year
        expect(yyyy).toMatch(/^\d{4}$/);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: todo-life-dashboard, Property 3: Greeting Message by Hour
  // Validates: Requirements 1.3, 1.4, 1.5, 1.6
  it('P3: getGreeting returns correct message for any hour 0-23', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 23 }), (hour) => {
        const result = getGreeting(hour);
        if (hour >= 5 && hour < 12) {
          expect(result).toBe('Good Morning');
        } else if (hour >= 12 && hour < 18) {
          expect(result).toBe('Good Afternoon');
        } else if (hour >= 18 && hour < 21) {
          expect(result).toBe('Good Evening');
        } else {
          // [0,4] ∪ [21,23]
          expect(result).toBe('Good Night');
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: todo-life-dashboard, Property 4: Personalized Greeting Composition
  // Validates: Requirements 2.2
  it('P4: composeGreeting returns "msg, name!" for non-empty name, otherwise just msg', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (msg, name) => {
        const result = composeGreeting(msg, name);
        if (name && name.trim()) {
          // Non-empty, non-whitespace name → "${msg}, ${name}!"
          expect(result).toBe(`${msg}, ${name}!`);
        } else {
          // Empty or whitespace-only name → just msg
          expect(result).toBe(msg);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('Theme', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Feature: todo-life-dashboard, Property 21: Theme Storage Round-Trip
  // Validates: Requirements 8.3
  it('P21: persisting any valid theme and loading it back returns the same theme', () => {
    fc.assert(
      fc.property(fc.constantFrom('light', 'dark'), (theme) => {
        Theme.persist(theme);
        const loaded = Storage.load(KEYS.THEME, null);
        return loaded === theme;
      }),
      { numRuns: 100 }
    );
  });
});

// Validates: Requirements 8.4, 8.5, 8.6
describe('Theme – initialization', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset document theme
    delete document.documentElement.dataset.theme;
    // Set up the toggle button
    document.body.innerHTML = '<button id="btn-theme-toggle">🌙</button>';
  });

  it('no saved theme + prefers-color-scheme dark → applies dark', () => {
    // Mock matchMedia to return dark preference
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query) => ({
        matches: query.includes('dark'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    Theme.init();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('saved theme "dark" → applies dark on init', () => {
    Storage.save(KEYS.THEME, 'dark');
    // matchMedia result doesn't matter since saved value takes precedence
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
    });
    Theme.init();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

// ─── Greeting – name validation (unit tests) ─────────────────────────────────
// Task 3.4 — Validates: Requirements 2.1, 2.5, 2.6

describe('Greeting – name validation', () => {
  beforeEach(() => {
    localStorage.clear();
    State.userName = '';
    // Minimal DOM: the three elements Greeting.saveName and renderGreeting touch
    document.body.innerHTML = `
      <span id="name-error"></span>
      <input id="name-input" />
      <span id="greeting-display"></span>
    `;
  });

  // Requirement 2.1: name longer than 50 chars is rejected; #name-error is shown
  it('rejects a name longer than 50 characters and shows #name-error', () => {
    const longName = 'a'.repeat(51);
    Greeting.saveName(longName);
    // State must remain unchanged
    expect(State.userName).toBe('');
    // Inline error element must have non-empty text
    expect(document.getElementById('name-error').textContent).toBeTruthy();
  });

  // Requirement 2.5: whitespace-only input clears the stored name; greeting is non-personalized
  it('whitespace-only name clears stored name and shows non-personalized greeting', () => {
    // Pre-condition: a valid name is already stored
    State.userName = 'Alice';
    Storage.save(KEYS.USER_NAME, 'Alice');

    // Submit whitespace
    Greeting.saveName('   ');

    // State and storage must be cleared
    expect(State.userName).toBe('');
    expect(Storage.load(KEYS.USER_NAME, null)).toBeNull();

    // Greeting display must not show the old name or the personalized "!" suffix
    const greetingEl = document.getElementById('greeting-display');
    expect(greetingEl.textContent).not.toContain('Alice');
    expect(greetingEl.textContent).not.toContain('!');
  });

  // Requirement 2.6: valid name is saved and greeting reads "[Greeting], [Name]!"
  it('valid name saved → greeting displays "[Greeting], [Name]!"', () => {
    Greeting.saveName('Alice');

    expect(State.userName).toBe('Alice');

    const greetingEl = document.getElementById('greeting-display');
    // Must match the pattern "Good Morning, Alice!" (or whichever time-of-day prefix)
    expect(greetingEl.textContent).toMatch(/^.+, Alice!$/);
  });
});

// ─── Timer countdown invariants ───────────────────────────────────────────────

describe('Timer – countdown invariants', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="timer-display"></div>
      <div id="timer-completion" class="hidden"></div>
      <button id="btn-start"></button>
      <button id="btn-stop" disabled></button>
      <input id="duration-input" type="number" />
    `;
    // Reset timer state to a clean baseline
    State.timer.intervalId = null;
    State.timer.running = false;
    State.timer.status = 'IDLE';
    State.timer.durationMinutes = 25;
    State.timer.secondsLeft = 1500;
  });

  // Feature: todo-life-dashboard, Property 7: Timer Countdown Decrement Invariant
  // Validates: Requirements 3.2
  it('P7: after k ticks from full duration, secondsLeft === duration*60 - k', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 120 }),
        fc.nat({ max: 7199 }),
        (durationMinutes, k) => {
          const totalSeconds = durationMinutes * 60;
          // Skip cases where k would reach or exceed the timer (would call complete())
          if (k >= totalSeconds) return true;

          // Set up timer state directly (avoid Timer.start() which creates a real interval)
          State.timer.durationMinutes = durationMinutes;
          State.timer.secondsLeft = totalSeconds;
          State.timer.status = 'RUNNING';
          State.timer.running = true;
          State.timer.intervalId = null;

          // Call tick() k times
          for (let i = 0; i < k; i++) {
            if (State.timer.status !== 'RUNNING') break;
            Timer.tick();
          }

          return State.timer.secondsLeft === totalSeconds - k;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: todo-life-dashboard, Property 8: Timer Reset Restores Duration
  // Validates: Requirements 3.4
  it('P8: after any ticks, reset() restores secondsLeft to duration*60 and status to IDLE', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 120 }),
        fc.nat({ max: 100 }),
        (durationMinutes, ticks) => {
          // Set up timer state directly
          State.timer.durationMinutes = durationMinutes;
          State.timer.secondsLeft = durationMinutes * 60;
          State.timer.status = 'RUNNING';
          State.timer.running = true;
          State.timer.intervalId = null;

          // Tick some number of times (may or may not reach completion)
          for (let i = 0; i < ticks && State.timer.status === 'RUNNING'; i++) {
            Timer.tick();
          }

          // Reset must restore full duration and IDLE status regardless of prior state
          Timer.reset();

          return (
            State.timer.secondsLeft === durationMinutes * 60 &&
            State.timer.status === 'IDLE'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: todo-life-dashboard, Property 9: Timer Button-State Invariant
  // Validates: Requirements 3.6, 3.7, 3.8, 4.5
  it('P9: button states match timer status after render()', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('IDLE', 'RUNNING', 'PAUSED', 'COMPLETED'),
        (status) => {
          State.timer.status = status;
          State.timer.secondsLeft = 100;
          Timer.render();

          const btnStart    = document.getElementById('btn-start');
          const btnStop     = document.getElementById('btn-stop');
          const durationInp = document.getElementById('duration-input');

          if (status === 'RUNNING') {
            // Start disabled, Stop enabled, duration-input disabled
            expect(btnStart.disabled).toBe(true);
            expect(btnStop.disabled).toBe(false);
            expect(durationInp.disabled).toBe(true);
          } else if (status === 'COMPLETED') {
            // Start disabled, Stop disabled, duration-input enabled
            expect(btnStart.disabled).toBe(true);
            expect(btnStop.disabled).toBe(true);
            expect(durationInp.disabled).toBe(false);
          } else {
            // IDLE or PAUSED: Start enabled, Stop disabled, duration-input enabled
            expect(btnStart.disabled).toBe(false);
            expect(btnStop.disabled).toBe(true);
            expect(durationInp.disabled).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── To-Do List – validation properties ──────────────────────────────────────

const { validateTaskText, createTask } = require('./js/app');

describe('To-Do List – validation', () => {
  // Feature: todo-life-dashboard, Property 12: Task Addition Grows Task List
  // Validates: Requirements 5.2
  it('P12: validateTaskText accepts non-empty, non-whitespace text (1-200 chars)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        (text) => {
          const result = validateTaskText(text);
          expect(result.ok).toBe(true);
          // Also verify createTask produces a well-formed task object
          const task = createTask(text);
          expect(task.text).toBe(text.trim());
          expect(task.done).toBe(false);
          expect(task.editing).toBe(false);
          expect(typeof task.id).toBe('string');
          expect(task.id.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: todo-life-dashboard, Property 13: Whitespace Task Rejection
  // Validates: Requirements 5.11
  it('P13: validateTaskText rejects empty and whitespace-only strings', () => {
    // Explicit edge cases
    expect(validateTaskText('').ok).toBe(false);
    expect(validateTaskText('   ').ok).toBe(false);

    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(' ', '\t', '\n')),
        (whitespaceStr) => {
          const result = validateTaskText(whitespaceStr);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
