import {
  buildMixedOutputSegments,
  extractJsonCandidates,
  formatMixedOutput,
  formatJson,
  parseNestedJsonString,
  shouldMarkRawTextLine,
} from "./jsonTools.js";

const HANDOFF_KEY = "selectedText";
const THEME_STORAGE_KEY = "jsonInspectorTheme";
const THEMES = new Set(["classic", "light", "dark"]);

const state = {
  candidates: [],
  expandedPaths: new Set(),
  collapsedPaths: new Set(),
  wrapLines: true,
  compactOutput: false,
  theme: "classic",
  copyResetTimer: 0,
  gutterTooltip: null,
};

const elements = {
  inputText: document.querySelector("#inputText"),
  inputMeta: document.querySelector("#inputMeta"),
  outputText: document.querySelector("#outputText"),
  statusText: document.querySelector("#statusText"),
  candidateCount: document.querySelector("#candidateCount"),
  minifyButton: document.querySelector("#minifyButton"),
  wrapButton: document.querySelector("#wrapButton"),
  copyButton: document.querySelector("#copyButton"),
  clearButton: document.querySelector("#clearButton"),
  themeSelect: document.querySelector("#themeSelect"),
};

init();

async function init() {
  loadThemePreference();
  bindEvents();
  await loadSelectedTextHandoff();
  refreshFromInput();
  updateButtonStates();
  elements.inputText.focus();
}

function bindEvents() {
  elements.inputText.addEventListener("input", refreshFromInput);
  elements.themeSelect.addEventListener("change", () => updateTheme(elements.themeSelect.value));
  elements.minifyButton.addEventListener("click", toggleCompactOutput);
  elements.wrapButton.addEventListener("click", toggleWrapLines);
  elements.copyButton.addEventListener("click", copyOutput);
  elements.clearButton.addEventListener("click", clearAll);
  elements.outputText.addEventListener("scroll", hideGutterTooltip);
  window.addEventListener("resize", hideGutterTooltip);
}

function loadThemePreference() {
  let savedTheme = "classic";

  try {
    savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "classic";
  } catch {
    savedTheme = "classic";
  }

  applyTheme(savedTheme);

  if (savedTheme !== state.theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, state.theme);
    } catch {
      // Ignore storage failures; the normalized theme is already applied.
    }
  }
}

function updateTheme(theme) {
  applyTheme(theme);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, state.theme);
  } catch {
    // Theme choice still applies for the current page even when storage is unavailable.
  }
}

function applyTheme(theme) {
  const nextTheme = THEMES.has(theme) ? theme : "classic";
  state.theme = nextTheme;
  document.documentElement.dataset.theme = nextTheme;

  if (elements.themeSelect) {
    elements.themeSelect.value = nextTheme;
  }
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
  state.expandedPaths.clear();
  state.collapsedPaths.clear();
  render();
}

function render() {
  renderInputMeta();
  renderOutputMeta();
  renderOutput();
  updateButtonStates();
}

function renderInputMeta() {
  const count = elements.inputText.value.length;
  elements.inputMeta.textContent = `${count.toLocaleString()} char${count === 1 ? "" : "s"}`;
}

function renderOutputMeta() {
  elements.candidateCount.textContent = `${state.candidates.length} JSON`;
}

function renderOutput() {
  hideGutterTooltip();
  const input = elements.inputText.value;

  if (!input.trim()) {
    setStatus("Ready", "ready");
    elements.outputText.replaceChildren();
    return;
  }

  try {
    const jsonCount = state.candidates.length;
    setStatus(jsonCount ? `${jsonCount} JSON segment${jsonCount === 1 ? "" : "s"}` : "No valid JSON", jsonCount ? "success" : "warning");
    elements.outputText.classList.toggle("wrap-lines", state.wrapLines);
    elements.outputText.classList.toggle("no-wrap-lines", !state.wrapLines);
    elements.outputText.replaceChildren(renderMixedOutputViewer(input));
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Render failed", "error");
    elements.outputText.replaceChildren();
  }
}

function setStatus(message, tone) {
  elements.statusText.textContent = message;
  elements.statusText.classList.remove("ready", "success", "warning", "error");
  elements.statusText.classList.add(tone);
}

async function copyOutput() {
  const text = elements.inputText.value ? formatMixedOutput(elements.inputText.value, { compact: state.compactOutput }) : "";

  if (!text) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied", "success");
    flashCopyButton();
  } catch {
    setStatus("Copy failed", "error");
  }
}

function clearAll() {
  elements.inputText.value = "";
  state.candidates = [];
  state.expandedPaths.clear();
  state.collapsedPaths.clear();
  render();
  elements.inputText.focus();
}

function toggleWrapLines() {
  state.wrapLines = !state.wrapLines;
  renderOutput();
  updateButtonStates();
}

function toggleCompactOutput() {
  state.compactOutput = !state.compactOutput;
  state.expandedPaths.clear();
  state.collapsedPaths.clear();
  renderOutput();
  updateButtonStates();
}

function renderJsonViewer(value) {
  const viewer = document.createElement("div");
  viewer.className = "json-lines";
  const lineState = { number: 1 };
  const appendLine = createLineAppender(viewer, lineState);

  renderValueLines(value, 0, "$", "", "", appendLine);
  return viewer;
}

function renderMixedOutputViewer(input) {
  const viewer = document.createElement("div");
  viewer.className = "json-lines mixed-output-lines";
  const lineState = { number: 1 };
  const appendLine = createLineAppender(viewer, lineState);

  buildMixedOutputSegments(input).forEach((segment, index) => {
    if (segment.type === "json") {
      if (state.compactOutput) {
        renderCompactJsonSegment(segment.candidate, index, appendLine);
      } else {
        renderValueLines(segment.candidate.parsed, 0, `$segment${index}`, "", "", appendLine);
      }
      return;
    }

    renderTextSegment(segment.text, appendLine);
  });

  return viewer;
}

function renderCompactJsonSegment(candidate, index, appendLine) {
  const line = document.createDocumentFragment();
  line.append(token(formatJson(candidate.parsed, { compact: true }), "token-string"));
  appendLine(0, line, "node-line compact-json-line", {
    fold: spacer("fold-spacer"),
    copyValue: candidate.parsed,
  });
}

function createLineAppender(viewer, lineState) {
  return (depth, content, className = "", controls = {}) => {
    const row = document.createElement("div");
    row.className = `code-line${className ? ` ${className}` : ""}`;

    const gutter = document.createElement("span");
    gutter.className = "line-number";

    gutter.append(controls.fold || spacer("fold-spacer"));
    gutter.append(controls.expand || spacer("expand-spacer"));
    gutter.append(controls.copyValue === undefined ? spacer("copy-spacer") : gutterCopyButton(controls.copyValue));

    const number = document.createElement("span");
    number.className = "line-number-text";
    number.textContent = String(lineState.number);
    gutter.append(number);
    lineState.number += 1;

    const line = document.createElement("span");
    line.className = "line-content";
    line.style.setProperty("--depth", depth);
    line.append(content);

    row.append(gutter, line);
    viewer.append(row);
  };
}

function renderTextSegment(text, appendLine) {
  const lines = text.split("\n");

  lines.forEach((lineText, index) => {
    if (index === lines.length - 1 && lineText === "") {
      return;
    }

    const line = document.createDocumentFragment();
    line.append(lineText);
    const marked = shouldMarkRawTextLine(lineText);
    appendLine(0, line, marked ? "plain-text-line" : "blank-text-line", {
      fold: marked ? rawTextBadge() : undefined,
      copyValue: lineText,
    });
  });
}

function rawTextBadge() {
  const badge = document.createElement("span");
  badge.className = "raw-text-badge";
  badge.textContent = "TXT";
  badge.title = "Raw text";
  badge.setAttribute("aria-label", "Raw text");
  return badge;
}

function renderValueLines(value, depth, path, prefix, suffix, appendLine) {
  if (Array.isArray(value)) {
    renderContainerLines(value, depth, path, prefix, suffix, appendLine, "[", "]");
    return;
  }

  if (value && typeof value === "object") {
    renderContainerLines(value, depth, path, prefix, suffix, appendLine, "{", "}");
    return;
  }

  renderPrimitiveLine(value, depth, path, prefix, suffix, appendLine);
}

function renderContainerLines(value, depth, path, prefix, suffix, appendLine, openToken, closeToken) {
  const entries = Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value);
  const collapsed = state.collapsedPaths.has(path);

  if (entries.length === 0) {
    const line = document.createDocumentFragment();
    appendPrefix(line, prefix);
    line.append(`${openToken}${closeToken}`);
    line.append(suffix);
    appendLine(depth, line, "node-line", { copyValue: value });
    return;
  }

  if (collapsed) {
    const line = document.createDocumentFragment();
    appendPrefix(line, prefix);
    line.append(`${openToken}...${closeToken}`);
    line.append(suffix);
    appendLine(depth, line, "node-line", { fold: foldButton(path, true), copyValue: value });
    return;
  }

  const openLine = document.createDocumentFragment();
  appendPrefix(openLine, prefix);
  openLine.append(openToken);
  appendLine(depth, openLine, "node-line", { fold: foldButton(path, false), copyValue: value });

  entries.forEach(([key, item], index) => {
    const childPath = Array.isArray(value) ? `${path}[${key}]` : `${path}.${escapePathSegment(key)}`;
    const childPrefix = Array.isArray(value) ? "" : `${JSON.stringify(key)}: `;
    const childSuffix = index < entries.length - 1 ? "," : "";
    renderValueLines(item, depth + 1, childPath, childPrefix, childSuffix, appendLine);
    appendNestedLines(item, depth + 2, childPath, appendLine);
  });

  const closeLine = document.createDocumentFragment();
  closeLine.append(closeToken, suffix);
  appendLine(depth, closeLine);
}

function renderPrimitiveLine(value, depth, path, prefix, suffix, appendLine) {
  const line = document.createDocumentFragment();
  appendPrefix(line, prefix);
  line.append(renderPrimitiveToken(value));
  line.append(suffix);
  const controls = { copyValue: value };
  if (typeof value === "string" && parseNestedJsonString(value) !== null) {
    controls.expand = expandButton(path, state.expandedPaths.has(path));
  }
  appendLine(depth, line, "node-line", controls);
}

function appendPrefix(fragment, prefix) {
  if (!prefix) {
    return;
  }

  const match = prefix.match(/^("[^"]+": )(.*)$/);

  if (!match) {
    fragment.append(prefix);
    return;
  }

  fragment.append(token(match[1].slice(0, -2), "token-key"), ": ", match[2]);
}

function renderPrimitiveToken(value) {
  if (typeof value === "string") {
    return token(JSON.stringify(value), "token-string");
  }

  if (typeof value === "number") {
    return token(JSON.stringify(value), "token-number");
  }

  if (typeof value === "boolean") {
    return token(JSON.stringify(value), "token-boolean");
  }

  if (value === null) {
    return token("null", "token-null");
  }

  return document.createTextNode(JSON.stringify(value));
}

function appendNestedLines(value, depth, path, appendLine) {
  if (typeof value !== "string" || !state.expandedPaths.has(path)) {
    return;
  }

  const nested = parseNestedJsonString(value);

  if (nested === null) {
    return;
  }

  const appendNestedLine = (nestedDepth, content, className = "", controls = {}) => {
    appendLine(nestedDepth, content, `nested-expanded-line${className ? ` ${className}` : ""}`, controls);
  };

  renderValueLines(nested, depth, `${path}#nested`, "↳ ", "", appendNestedLine);
}

function foldButton(path, collapsed) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fold-button";
  button.textContent = collapsed ? "+" : "-";
  button.title = collapsed ? "Expand node" : "Collapse node";
  button.setAttribute("aria-label", button.title);
  bindGutterTooltip(button);
  button.addEventListener("click", () => toggleCollapsedPath(path));
  return button;
}

function expandButton(path, expanded) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "gutter-expand-button";
  button.textContent = expanded ? "-" : "+";
  button.title = expanded ? "Hide parsed string" : "Expand parsed string";
  button.setAttribute("aria-label", button.title);
  bindGutterTooltip(button);
  button.addEventListener("click", () => toggleExpandedPath(path));
  return button;
}

function gutterCopyButton(value) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "gutter-copy-button";
  button.title = "Copy this node";
  button.setAttribute("aria-label", "Copy this node");
  setCopyIcon(button, false);
  bindGutterTooltip(button);
  button.addEventListener("click", () => copyNode(value, button));
  return button;
}

function setCopyIcon(button, copied) {
  button.replaceChildren();
  button.append(svgIcon(copied ? "check" : "copy"));
  button.classList.toggle("copied", copied);
  button.title = copied ? "Copied" : "Copy this node";
  button.setAttribute("aria-label", button.title);
}

function svgIcon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const paths = name === "check"
    ? ["M20 6 9 17l-5-5"]
    : ["M8 8h10v12H8z", "M6 16H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"];

  paths.forEach((d) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  });

  return svg;
}

function spacer(className) {
  const element = document.createElement("span");
  element.className = className;
  return element;
}

function bindGutterTooltip(button) {
  button.addEventListener("pointerenter", () => showGutterTooltip(button));
  button.addEventListener("pointermove", () => positionGutterTooltip(button));
  button.addEventListener("pointerleave", hideGutterTooltip);
  button.addEventListener("mouseenter", () => showGutterTooltip(button));
  button.addEventListener("mousemove", () => positionGutterTooltip(button));
  button.addEventListener("mouseleave", hideGutterTooltip);
  button.addEventListener("focus", () => showGutterTooltip(button));
  button.addEventListener("blur", hideGutterTooltip);
}

function getGutterTooltip() {
  if (!state.gutterTooltip) {
    const tooltip = document.createElement("div");
    tooltip.className = "gutter-tooltip";
    tooltip.hidden = true;
    document.body.append(tooltip);
    state.gutterTooltip = tooltip;
  }

  return state.gutterTooltip;
}

function showGutterTooltip(button) {
  const label = button.getAttribute("aria-label") || button.title;

  if (!label) {
    return;
  }

  const tooltip = getGutterTooltip();
  tooltip.textContent = label;
  tooltip.hidden = false;
  positionGutterTooltip(button);
}

function positionGutterTooltip(button) {
  if (!state.gutterTooltip || state.gutterTooltip.hidden) {
    return;
  }

  const tooltip = state.gutterTooltip;
  const buttonRect = button.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const margin = 8;
  const centeredLeft = buttonRect.left + (buttonRect.width - tooltipRect.width) / 2;
  const left = Math.min(Math.max(centeredLeft, margin), window.innerWidth - tooltipRect.width - margin);
  const bottomTop = buttonRect.bottom + margin;
  const top = bottomTop + tooltipRect.height > window.innerHeight - margin
    ? buttonRect.top - tooltipRect.height - margin
    : bottomTop;

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${Math.max(top, margin)}px`;
}

function hideGutterTooltip() {
  if (state.gutterTooltip) {
    state.gutterTooltip.hidden = true;
  }
}

function toggleExpandedPath(path) {
  if (state.expandedPaths.has(path)) {
    state.expandedPaths.delete(path);
  } else {
    state.expandedPaths.add(path);
  }

  renderOutput();
}

function toggleCollapsedPath(path) {
  if (state.collapsedPaths.has(path)) {
    state.collapsedPaths.delete(path);
  } else {
    state.collapsedPaths.add(path);
  }

  renderOutput();
}

async function copyNode(value, button) {
  try {
    await navigator.clipboard.writeText(formatNodeForCopy(value));
    flashInlineCopyButton(button);
    setStatus("Node copied", "success");
  } catch {
    setStatus("Copy failed", "error");
  }
}

function formatNodeForCopy(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "object") {
    return formatJson(value);
  }

  return String(value);
}

function escapePathSegment(segment) {
  return String(segment).replaceAll("\\", "\\\\").replaceAll(".", "\\.");
}

function token(text, className) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function updateButtonStates() {
  const hasInput = Boolean(elements.inputText.value);
  elements.copyButton.disabled = !hasInput;
  elements.clearButton.disabled = !hasInput;
  elements.wrapButton.disabled = !hasInput;
  elements.minifyButton.disabled = !hasInput;
  elements.minifyButton.textContent = state.compactOutput ? "Pretty" : "Minify";
  elements.minifyButton.classList.toggle("active", state.compactOutput);
  elements.wrapButton.textContent = state.wrapLines ? "Wrap" : "No wrap";
  elements.wrapButton.classList.toggle("active", state.wrapLines);
}

function flashCopyButton() {
  elements.copyButton.textContent = "Copied";
  clearTimeout(state.copyResetTimer);
  state.copyResetTimer = setTimeout(() => {
    elements.copyButton.textContent = "Copy";
  }, 1200);
}

function flashInlineCopyButton(button) {
  setCopyIcon(button, true);
  setTimeout(() => {
    setCopyIcon(button, false);
  }, 900);
}
