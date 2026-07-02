# JSON Inspector Chrome Extension Design

## Goal

Build a lightweight Manifest V3 Chrome extension for extracting, formatting, and inspecting JSON copied from logs or selected from web pages.

JSON Inspector should work locally with no backend and no build step. Its core value is reliable JSON extraction from noisy text, readable source-order output, and safe inspection of nested JSON strings without changing the original JSON structure.

## Current Product Name

- Extension name: `JSON Inspector`
- Package name: `json-inspector-extension`
- GitHub repository: `skyward-lab/json-inspector-extension`

## User Workflows

### Independent Inspector Tab

The primary entry is a full-page extension tab. The user pastes log text, JSON-like text, API payloads, or console output into the input pane. JSON Inspector scans the input and renders the full source-order stream in the output pane: raw text remains visible with `TXT` markers, while valid JSON objects and arrays are formatted inline.

### Selected Text Handoff

When the user selects text on a web page, the context menu item opens the same inspector tab and passes the selected text into it.

The context menu label is:

```text
Open selection in JSON Inspector
```

This supports logs in web consoles, internal tools, documents, and email-like pages without requiring manual copy and paste.

### Screenshot And Demo Flow

The project includes a demo input at:

```text
examples/screenshot-demo-input.txt
```

It covers log extraction, multiple JSON segments, raw text preservation, arrays, nested JSON strings, wrapping, minify/pretty output, folding, node copy, and theme switching. README screenshots are stored under `docs/images/`.

## Functional Requirements

- Extract valid JSON objects and arrays from surrounding log text.
- Support multiple JSON segments in one input.
- Preserve non-JSON text in the output with visible `TXT` markers.
- Filter contained candidates so nested objects inside a larger valid JSON segment do not create duplicate output.
- Preserve the original JSON structure in the main output.
- Detect string values that contain escaped JSON objects or arrays.
- Provide per-value expansion for nested JSON strings in the output gutter.
- Render nested JSON previews with a distinct visual marker.
- Keep malformed nested string values as plain strings.
- Render output with line numbers.
- Support node-level copy for every visible node, including nested preview nodes.
- Support object/array folding from the line-number gutter.
- Support output wrapping and no-wrap display modes, defaulting to wrap.
- Support minify/pretty output display and full-output copy in the active display mode.
- Support Classic, Light, and Dark themes with local preference persistence.
- Keep the full page fixed-height; input and output scroll independently.
- Show clear empty/warning states when no valid JSON segment can be found.
- Avoid network requests and avoid reading page contents except user-selected text delivered through the context menu.

## Non-Goals

- No server-side storage.
- No cloud sync.
- No automatic page scraping.
- No full JSON editor.
- No schema validation.
- No attempt to repair non-standard JSON with comments, single quotes, or unquoted keys.
- No automatic conversion of nested JSON strings into objects in the main output.

## Architecture

The extension uses plain HTML, CSS, and JavaScript:

- `manifest.json`: Manifest V3 metadata, permissions, action title, and background service worker.
- `src/background.js`: Creates the context menu and opens the inspector tab with selected text stored in `chrome.storage.session`.
- `src/formatter.html`: Full-page inspector markup.
- `src/formatter.css`: Fixed-height two-column layout, compact controls, theme variables, output tree styling, nested preview styling, raw text markers, and tooltip styling.
- `src/formatter.js`: UI state, handoff loading, mixed output rendering, folding, wrapping, minify/pretty display, theme persistence, nested preview expansion, and copy actions.
- `src/jsonTools.js`: Pure parsing utilities for extraction, ranking, formatting, and nested JSON string detection.
- `tests/jsonTools.test.js`: Local parser behavior tests using Node's built-in test runner.
- `examples/screenshot-demo-input.txt`: Demo input for documentation screenshots.
- `docs/images/`: README screenshot assets.

## Data Flow

For pasted text:

1. User enters text in the inspector tab.
2. UI calls `extractJsonCandidates(input)`.
3. Parser scans balanced `{...}` and `[...]` ranges, parses valid ranges, filters contained ranges, scores candidates, and returns ranked candidates.
4. UI builds mixed output segments from raw text and ranked JSON ranges.
5. UI renders raw text lines with `TXT` markers and renders valid JSON segments as formatted JSON while preserving string values.
6. If a string value contains parseable JSON, the output gutter shows a per-line expand control.
7. Expanding the value renders a marked nested preview below the original line without altering copy output for the main JSON.

For selected page text:

1. User selects text on a web page.
2. User chooses `Open selection in JSON Inspector`.
3. Background service worker stores the selected text in `chrome.storage.session` under `selectedText`.
4. Background service worker opens `src/formatter.html?source=selection`.
5. Formatter tab reads the handoff text, clears it from session storage, populates the input pane, and runs extraction automatically.

## JSON Extraction Strategy

The extractor scans the input character by character and starts an active scan at every `{` or `[`. Each active scan tracks:

- start offset
- stack of expected container boundaries
- string state
- escape state

This lets the extractor recover valid candidates after invalid fragments and avoid treating braces inside strings as structural braces.

Each valid candidate includes:

- `id`
- `start`
- `end`
- `type`
- `raw`
- `parsed`
- `score`
- `summary`

Candidates contained entirely inside a larger valid candidate are filtered out before ranking and mixed output rendering.

## Nested JSON String Strategy

The main output always preserves parsed JSON values as they are. If a value is a string, JSON Inspector checks whether the trimmed string looks like a JSON object or array. If it parses successfully, that line receives an expand control in the gutter.

Expanded nested previews are rendered as additional marked lines. They are inspectable and copyable, but they do not replace the original string value.

This prevents the main output from changing semantic shape and keeps full-output copy predictable.

## UI Design

The page uses a dense, work-focused two-column layout:

- Header: brand mark, `JSON Inspector`, status pill, and theme selector.
- Left column: Input pane with Clear action in the pane header.
- Right column: Output pane.
- Layout ratio: approximately 4:6 between left and right.
- Output: source-order mixed viewer with line numbers, sticky gutter, raw text markers, fold controls, nested expand controls, copy icons, minify/pretty toggle, wrap toggle, and full-output copy.
- Themes: Classic is the default, with Light and Dark alternatives remembered in local storage.
- Tooltips: gutter button descriptions are rendered as fixed body-level overlays so they are not clipped by the output scroll container.
- Page scrolling: disabled at the body level; input and output scroll independently.

## Error Handling

- Empty input: status is `Ready`, output is empty.
- No valid JSON: status is `No valid JSON`, output shows raw text with `TXT` markers.
- Render failure: status shows the error message when available.
- Copy failure: status shows `Copy failed`.
- Unparseable nested strings: leave the original string unchanged and do not show an expand control.

## Testing

Automated parser tests cover:

- JSON object extraction from log text.
- Array extraction and multiple candidates.
- Braces inside JSON strings.
- Invalid fragments skipped while valid candidates remain.
- Recovery after unbalanced invalid fragments.
- Recovery after invalid fragments with unmatched quotes.
- Escaped nested JSON object string parsing.
- Escaped nested JSON array string parsing.
- Malformed nested JSON strings preserved.
- Main formatting preserving nested JSON strings.
- Nested JSON string detection for field-level expansion.
- Preference for an outer array when it contains nested objects and JSON strings.
- Mixed output rendering in source order.
- Compact mixed output formatting.
- Raw text markers only on visible non-empty text lines.

Manual extension checks should cover:

- Loading the unpacked extension in Chrome.
- Opening the inspector from the extension icon.
- Opening selected page text through the context menu.
- Pasting `examples/screenshot-demo-input.txt`.
- Confirming raw text and JSON segments appear together in output.
- Expanding nested JSON previews.
- Folding object/array nodes.
- Copying full output.
- Copying individual nodes.
- Toggling wrap/no-wrap mode.
- Toggling minify/pretty mode.
- Switching Classic, Light, and Dark themes and confirming the selected theme is remembered after reload.
