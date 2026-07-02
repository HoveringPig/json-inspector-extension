# JSON Formatter Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a no-build Manifest V3 Chrome extension that extracts JSON from logs, expands nested escaped JSON strings, and opens from selected page text.

**Architecture:** The extension is split into a pure parser module and a small Chrome extension shell. Parser behavior is covered by `node --test`; browser behavior is handled by Manifest V3, a background service worker, and a full-page formatter UI.

**Tech Stack:** Manifest V3, plain HTML/CSS/JavaScript, ES modules, Node built-in test runner.

---

## File Structure

- Create `package.json`: defines `npm test` as `node --test`.
- Create `manifest.json`: Chrome extension metadata, action, permissions, and background service worker.
- Create `src/jsonTools.js`: pure JSON extraction, ranking, recursive nested parsing, summary helpers, and formatting helpers.
- Create `src/background.js`: context menu setup and selected-text handoff to the formatter tab.
- Create `src/formatter.html`: independent formatter tab markup.
- Create `src/formatter.css`: dense utility UI styling.
- Create `src/formatter.js`: UI state, Chrome storage handoff, candidate selection, mode switching, and copy/clear actions.
- Create `tests/jsonTools.test.js`: parser and formatter tests using Node's built-in test runner.

## Task 1: Project And Test Harness

**Files:**
- Create: `package.json`
- Create: `src/jsonTools.js`
- Create: `tests/jsonTools.test.js`

- [ ] **Step 1: Write the failing smoke test**

Create `tests/jsonTools.test.js` with:

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  extractJsonCandidates,
  formatJson,
} from "../src/jsonTools.js";

test("extracts a JSON object from log text", () => {
  const input = 'INFO request payload={"name":"demo","count":2} done';
  const candidates = extractJsonCandidates(input);

  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].parsed, { name: "demo", count: 2 });
  assert.equal(formatJson(candidates[0].parsed), '{\n  "name": "demo",\n  "count": 2\n}');
});
```

- [ ] **Step 2: Add the test command**

Create `package.json` with:

```json
{
  "name": "json-formatter-extension",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `npm test`

Expected: FAIL because `src/jsonTools.js` does not exist or does not export `extractJsonCandidates`.

- [ ] **Step 4: Add minimal parser exports**

Create `src/jsonTools.js` with:

```js
export function extractJsonCandidates(input) {
  const text = String(input ?? "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end <= start) {
    return [];
  }

  const raw = text.slice(start, end + 1);

  try {
    const parsed = JSON.parse(raw);
    return [{
      id: "candidate-1",
      start,
      end: end + 1,
      type: "object",
      raw,
      parsed,
      score: raw.length,
      summary: "object",
    }];
  } catch {
    return [];
  }
}

export function formatJson(value) {
  return JSON.stringify(value, null, 2);
}
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `npm test`

Expected: PASS for the smoke test.

- [ ] **Step 6: Commit**

```bash
git add package.json src/jsonTools.js tests/jsonTools.test.js
git commit -m "test: add JSON parser harness"
```

## Task 2: Balanced JSON Candidate Extraction

**Files:**
- Modify: `src/jsonTools.js`
- Modify: `tests/jsonTools.test.js`

- [ ] **Step 1: Add failing extraction tests**

Append these tests to `tests/jsonTools.test.js`:

```js
test("extracts arrays and multiple JSON candidates", () => {
  const input = 'first {"ok":true} second [1,{"two":2}] tail';
  const candidates = extractJsonCandidates(input);

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].type, "array");
  assert.deepEqual(candidates[0].parsed, [1, { two: 2 }]);
  assert.equal(candidates[1].type, "object");
  assert.deepEqual(candidates[1].parsed, { ok: true });
});

test("ignores braces inside JSON strings", () => {
  const input = 'log {"message":"literal { brace } inside","level":"info"} done';
  const candidates = extractJsonCandidates(input);

  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].parsed, {
    message: "literal { brace } inside",
    level: "info",
  });
});

test("skips invalid fragments while keeping valid candidates", () => {
  const input = 'bad {not-json} good {"status":"ok"}';
  const candidates = extractJsonCandidates(input);

  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].parsed, { status: "ok" });
});
```

- [ ] **Step 2: Run tests and verify the new cases fail**

Run: `npm test`

Expected: FAIL because the minimal parser only finds one object range and does not support arrays or invalid-fragment recovery.

- [ ] **Step 3: Replace `src/jsonTools.js` with balanced scanning implementation**

Use this implementation:

```js
const OPEN_TO_CLOSE = {
  "{": "}",
  "[": "]",
};

const CLOSE_TO_OPEN = {
  "}": "{",
  "]": "[",
};

export function extractJsonCandidates(input) {
  const text = String(input ?? "");
  const ranges = findBalancedJsonRanges(text);

  return ranges
    .map((range, index) => parseCandidate(text, range, index))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.start - b.start)
    .map((candidate, index) => ({
      ...candidate,
      id: `candidate-${index + 1}`,
    }));
}

export function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function findBalancedJsonRanges(text) {
  const ranges = [];
  const stack = [];
  let inString = false;
  let escaped = false;
  let rangeStart = -1;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      if (stack.length === 0) {
        rangeStart = index;
      }
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      if (stack.length === 0 || stack[stack.length - 1] !== CLOSE_TO_OPEN[char]) {
        stack.length = 0;
        rangeStart = -1;
        continue;
      }

      stack.pop();

      if (stack.length === 0 && rangeStart !== -1) {
        ranges.push({ start: rangeStart, end: index + 1 });
        rangeStart = -1;
      }
    }
  }

  return ranges;
}

function parseCandidate(text, range, index) {
  const raw = text.slice(range.start, range.end);

  try {
    const parsed = JSON.parse(raw);
    const firstChar = raw.trimStart()[0];
    const type = firstChar === "[" ? "array" : "object";
    const depth = getDepth(parsed);
    const score = raw.length + depth * 25 + (type === "object" ? 10 : 20);

    return {
      id: `candidate-${index + 1}`,
      start: range.start,
      end: range.end,
      type,
      raw,
      parsed,
      score,
      summary: summarizeValue(parsed),
    };
  } catch {
    return null;
  }
}

function getDepth(value) {
  if (!value || typeof value !== "object") {
    return 0;
  }

  const children = Array.isArray(value) ? value : Object.values(value);

  if (children.length === 0) {
    return 1;
  }

  return 1 + Math.max(...children.map(getDepth));
}

function summarizeValue(value) {
  if (Array.isArray(value)) {
    return `array (${value.length} items)`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    return `object (${keys.length} keys${keys.length ? `: ${keys.slice(0, 3).join(", ")}` : ""})`;
  }

  return typeof value;
}
```

- [ ] **Step 4: Run tests and verify extraction passes**

Run: `npm test`

Expected: PASS for all extraction tests.

- [ ] **Step 5: Commit**

```bash
git add src/jsonTools.js tests/jsonTools.test.js
git commit -m "feat: extract JSON candidates from log text"
```

## Task 3: Recursive Nested JSON String Parsing

**Files:**
- Modify: `src/jsonTools.js`
- Modify: `tests/jsonTools.test.js`

- [ ] **Step 1: Add failing recursive parsing tests**

Update the import in `tests/jsonTools.test.js`:

```js
import {
  deepParseJsonStrings,
  extractJsonCandidates,
  formatJson,
} from "../src/jsonTools.js";
```

Append these tests:

```js
test("recursively expands escaped JSON object strings", () => {
  const input = '{"payload":"{\\"name\\":\\"demo\\",\\"items\\":[1,2]}"}';
  const [candidate] = extractJsonCandidates(input);
  const expanded = deepParseJsonStrings(candidate.parsed);

  assert.deepEqual(expanded, {
    payload: {
      name: "demo",
      items: [1, 2],
    },
  });
});

test("recursively expands escaped JSON array strings", () => {
  const input = '{"payload":"[{\\"id\\":1},{\\"id\\":2}]"}';
  const [candidate] = extractJsonCandidates(input);
  const expanded = deepParseJsonStrings(candidate.parsed);

  assert.deepEqual(expanded, {
    payload: [{ id: 1 }, { id: 2 }],
  });
});

test("keeps malformed nested JSON strings unchanged", () => {
  const input = '{"payload":"{\\"name\\":\\"demo\\"","status":"ok"}';
  const [candidate] = extractJsonCandidates(input);
  const expanded = deepParseJsonStrings(candidate.parsed);

  assert.deepEqual(expanded, {
    payload: '{"name":"demo"',
    status: "ok",
  });
});
```

- [ ] **Step 2: Run tests and verify the recursive cases fail**

Run: `npm test`

Expected: FAIL because `deepParseJsonStrings` is not exported.

- [ ] **Step 3: Add recursive parsing to `src/jsonTools.js`**

Insert this export after `formatJson`:

```js
export function deepParseJsonStrings(value) {
  if (Array.isArray(value)) {
    return value.map((item) => deepParseJsonStrings(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deepParseJsonStrings(item)]),
    );
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (!looksLikeJsonContainer(trimmed)) {
    return value;
  }

  try {
    return deepParseJsonStrings(JSON.parse(trimmed));
  } catch {
    return value;
  }
}

function looksLikeJsonContainer(value) {
  return (
    (value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]"))
  );
}
```

- [ ] **Step 4: Run tests and verify recursive parsing passes**

Run: `npm test`

Expected: PASS for all tests.

- [ ] **Step 5: Commit**

```bash
git add src/jsonTools.js tests/jsonTools.test.js
git commit -m "feat: expand nested JSON strings"
```

## Task 4: Chrome Extension Entrypoints

**Files:**
- Create: `manifest.json`
- Create: `src/background.js`

- [ ] **Step 1: Create `manifest.json`**

Use:

```json
{
  "manifest_version": 3,
  "name": "Log JSON Formatter",
  "description": "Extract and format JSON from logs, including nested JSON strings.",
  "version": "0.1.0",
  "action": {
    "default_title": "Open JSON Formatter"
  },
  "background": {
    "service_worker": "src/background.js",
    "type": "module"
  },
  "permissions": [
    "contextMenus",
    "storage",
    "tabs"
  ]
}
```

- [ ] **Step 2: Create `src/background.js`**

Use:

```js
const MENU_ID = "open-json-formatter-selection";
const HANDOFF_KEY = "selectedText";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Format selected JSON",
    contexts: ["selection"],
  });
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("src/formatter.html"),
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) {
    return;
  }

  const selectedText = info.selectionText || "";
  await chrome.storage.session.set({ [HANDOFF_KEY]: selectedText });

  chrome.tabs.create({
    url: chrome.runtime.getURL("src/formatter.html?source=selection"),
  });
});
```

- [ ] **Step 3: Run parser tests**

Run: `npm test`

Expected: PASS. This task adds extension entry files and should not affect parser tests.

- [ ] **Step 4: Commit**

```bash
git add manifest.json src/background.js
git commit -m "feat: add Chrome extension entrypoints"
```

## Task 5: Formatter Page UI

**Files:**
- Create: `src/formatter.html`
- Create: `src/formatter.css`
- Create: `src/formatter.js`
- Modify: `src/jsonTools.js`

- [ ] **Step 1: Add browser-safe text helper exports**

Append this function to `src/jsonTools.js`:

```js
export function getDisplayValue(parsed, mode) {
  return mode === "recursive" ? deepParseJsonStrings(parsed) : parsed;
}
```

- [ ] **Step 2: Create `src/formatter.html`**

Use:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Log JSON Formatter</title>
    <link rel="stylesheet" href="./formatter.css">
  </head>
  <body>
    <main class="app-shell">
      <header class="toolbar">
        <div>
          <h1>Log JSON Formatter</h1>
          <p id="statusText" class="status-text">Paste log text or JSON to begin.</p>
        </div>
        <div class="toolbar-actions">
          <div class="segmented" aria-label="Display mode">
            <button id="recursiveModeButton" class="active" type="button">Recursive</button>
            <button id="rawModeButton" type="button">Raw</button>
          </div>
          <button id="copyButton" type="button">Copy</button>
          <button id="clearButton" type="button">Clear</button>
        </div>
      </header>

      <section class="workspace" aria-label="JSON formatter workspace">
        <section class="pane input-pane">
          <label for="inputText">Input</label>
          <textarea id="inputText" spellcheck="false" placeholder="Paste logs or JSON here"></textarea>
        </section>

        <section class="pane output-pane">
          <div class="output-header">
            <span>Output</span>
            <span id="candidateCount" class="meta">0 candidates</span>
          </div>
          <pre id="outputText" tabindex="0"></pre>
        </section>
      </section>

      <aside class="candidate-panel" aria-label="Detected JSON candidates">
        <div class="candidate-panel-header">Candidates</div>
        <div id="candidateList" class="candidate-list"></div>
      </aside>
    </main>

    <script type="module" src="./formatter.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `src/formatter.css`**

Use:

```css
:root {
  color-scheme: light;
  --bg: #f6f7f9;
  --panel: #ffffff;
  --text: #172033;
  --muted: #647084;
  --line: #d8dee8;
  --accent: #1f6feb;
  --accent-weak: #e8f1ff;
  --danger: #b42318;
  --code-bg: #101828;
  --code-text: #e6edf7;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  color: var(--text);
  background: var(--bg);
  font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button,
textarea,
pre {
  font: inherit;
}

.app-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 12px;
  min-height: 100vh;
  padding: 16px;
}

.toolbar,
.workspace,
.candidate-panel {
  width: min(100%, 1440px);
  margin: 0 auto;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.status-text {
  margin: 2px 0 0;
  color: var(--muted);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

button {
  min-height: 34px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 6px 12px;
  color: var(--text);
  background: var(--panel);
  cursor: pointer;
}

button:hover {
  border-color: var(--accent);
}

.segmented {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 6px;
  overflow: hidden;
  background: var(--panel);
}

.segmented button {
  border: 0;
  border-radius: 0;
}

.segmented button.active {
  color: #ffffff;
  background: var(--accent);
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}

.pane,
.candidate-panel {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
}

.pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 480px;
}

.pane label,
.output-header,
.candidate-panel-header {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  font-weight: 650;
}

.output-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.meta {
  color: var(--muted);
  font-weight: 500;
}

textarea,
pre {
  width: 100%;
  min-width: 0;
  min-height: 0;
  margin: 0;
  border: 0;
  padding: 12px;
  resize: none;
  outline: none;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 13px;
}

textarea {
  color: var(--text);
  background: #ffffff;
}

pre {
  white-space: pre;
  color: var(--code-text);
  background: var(--code-bg);
}

.candidate-panel {
  min-height: 120px;
  overflow: hidden;
}

.candidate-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
  padding: 10px;
}

.candidate-card {
  display: grid;
  gap: 4px;
  min-height: 76px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 8px;
  text-align: left;
  background: #ffffff;
}

.candidate-card.active {
  border-color: var(--accent);
  background: var(--accent-weak);
}

.candidate-card strong {
  display: block;
}

.candidate-card span {
  color: var(--muted);
  font-size: 12px;
}

.error {
  color: var(--danger);
}

@media (max-width: 860px) {
  .toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .toolbar-actions {
    justify-content: flex-start;
  }

  .workspace {
    grid-template-columns: 1fr;
  }

  .pane {
    min-height: 320px;
  }
}
```

- [ ] **Step 4: Create `src/formatter.js`**

Use:

```js
import {
  extractJsonCandidates,
  formatJson,
  getDisplayValue,
} from "./jsonTools.js";

const HANDOFF_KEY = "selectedText";

const state = {
  candidates: [],
  selectedId: "",
  mode: "recursive",
};

const elements = {
  inputText: document.querySelector("#inputText"),
  outputText: document.querySelector("#outputText"),
  statusText: document.querySelector("#statusText"),
  candidateCount: document.querySelector("#candidateCount"),
  candidateList: document.querySelector("#candidateList"),
  recursiveModeButton: document.querySelector("#recursiveModeButton"),
  rawModeButton: document.querySelector("#rawModeButton"),
  copyButton: document.querySelector("#copyButton"),
  clearButton: document.querySelector("#clearButton"),
};

init();

async function init() {
  bindEvents();
  await loadSelectedTextHandoff();
  refreshFromInput();
}

function bindEvents() {
  elements.inputText.addEventListener("input", refreshFromInput);
  elements.recursiveModeButton.addEventListener("click", () => setMode("recursive"));
  elements.rawModeButton.addEventListener("click", () => setMode("raw"));
  elements.copyButton.addEventListener("click", copyOutput);
  elements.clearButton.addEventListener("click", clearAll);
}

async function loadSelectedTextHandoff() {
  if (!globalThis.chrome?.storage?.session) {
    return;
  }

  const params = new URLSearchParams(window.location.search);

  if (params.get("source") !== "selection") {
    return;
  }

  const result = await chrome.storage.session.get(HANDOFF_KEY);
  const selectedText = result[HANDOFF_KEY] || "";

  if (selectedText) {
    elements.inputText.value = selectedText;
    await chrome.storage.session.remove(HANDOFF_KEY);
  }
}

function refreshFromInput() {
  state.candidates = extractJsonCandidates(elements.inputText.value);
  state.selectedId = state.candidates[0]?.id || "";
  render();
}

function setMode(mode) {
  state.mode = mode;
  render();
}

function selectCandidate(candidateId) {
  state.selectedId = candidateId;
  render();
}

function render() {
  renderModeButtons();
  renderCandidates();
  renderOutput();
}

function renderModeButtons() {
  elements.recursiveModeButton.classList.toggle("active", state.mode === "recursive");
  elements.rawModeButton.classList.toggle("active", state.mode === "raw");
}

function renderCandidates() {
  elements.candidateCount.textContent = `${state.candidates.length} candidate${state.candidates.length === 1 ? "" : "s"}`;
  elements.candidateList.textContent = "";

  if (state.candidates.length === 0) {
    const empty = document.createElement("div");
    empty.className = "meta";
    empty.textContent = "No valid JSON candidates detected.";
    elements.candidateList.append(empty);
    return;
  }

  for (const candidate of state.candidates) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "candidate-card";
    button.classList.toggle("active", candidate.id === state.selectedId);
    button.addEventListener("click", () => selectCandidate(candidate.id));

    const title = document.createElement("strong");
    title.textContent = candidate.summary;

    const meta = document.createElement("span");
    meta.textContent = `${candidate.type} · chars ${candidate.start}-${candidate.end}`;

    button.append(title, meta);
    elements.candidateList.append(button);
  }
}

function renderOutput() {
  const selected = getSelectedCandidate();

  if (!elements.inputText.value.trim()) {
    elements.statusText.textContent = "Paste log text or JSON to begin.";
    elements.statusText.classList.remove("error");
    elements.outputText.textContent = "";
    return;
  }

  if (!selected) {
    elements.statusText.textContent = "No valid JSON candidate found.";
    elements.statusText.classList.add("error");
    elements.outputText.textContent = "";
    return;
  }

  try {
    const displayValue = getDisplayValue(selected.parsed, state.mode);
    elements.statusText.textContent = `Showing ${selected.summary} in ${state.mode} mode.`;
    elements.statusText.classList.remove("error");
    elements.outputText.textContent = formatJson(displayValue);
  } catch (error) {
    elements.statusText.textContent = error instanceof Error ? error.message : "Failed to render JSON.";
    elements.statusText.classList.add("error");
    elements.outputText.textContent = "";
  }
}

function getSelectedCandidate() {
  return state.candidates.find((candidate) => candidate.id === state.selectedId) || null;
}

async function copyOutput() {
  const text = elements.outputText.textContent;

  if (!text) {
    return;
  }

  await navigator.clipboard.writeText(text);
  elements.statusText.textContent = "Formatted JSON copied.";
  elements.statusText.classList.remove("error");
}

function clearAll() {
  elements.inputText.value = "";
  state.candidates = [];
  state.selectedId = "";
  render();
  elements.inputText.focus();
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: PASS for parser tests.

- [ ] **Step 6: Commit**

```bash
git add src/jsonTools.js src/formatter.html src/formatter.css src/formatter.js
git commit -m "feat: add formatter tab UI"
```

## Task 6: Final Verification

**Files:**
- Read: `manifest.json`
- Read: `src/background.js`
- Read: `src/formatter.html`
- Read: `src/formatter.js`
- Read: `src/jsonTools.js`

- [ ] **Step 1: Run automated tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Check extension files exist**

Run: `find . -maxdepth 3 -type f | sort`

Expected output includes:

```text
./manifest.json
./package.json
./src/background.js
./src/formatter.css
./src/formatter.html
./src/formatter.js
./src/jsonTools.js
./tests/jsonTools.test.js
```

- [ ] **Step 3: Manual Chrome verification**

Open Chrome and load `/Users/yikang1/Documents/json formatter` as an unpacked extension at `chrome://extensions`.

Check:

```text
1. Click the extension action and confirm the formatter tab opens.
2. Paste: INFO payload={"payload":"{\"name\":\"demo\",\"items\":[1,2]}"} done
3. Confirm Recursive mode expands payload into an object.
4. Switch to Raw mode and confirm payload is a string.
5. Paste: first {"ok":true} second [1,{"two":2}]
6. Confirm two candidates are shown and each can be selected.
7. Select JSON-like text on a web page.
8. Right-click and choose "Format selected JSON".
9. Confirm a formatter tab opens with the selected text populated.
```

- [ ] **Step 4: Commit verification adjustments if needed**

If manual verification requires code changes, make the smallest correction, run `npm test`, and commit with:

```bash
git add manifest.json src tests package.json
git commit -m "fix: polish formatter extension verification"
```

If no changes are needed after Task 5, skip this commit.
