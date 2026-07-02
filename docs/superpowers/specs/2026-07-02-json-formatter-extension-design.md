# JSON Formatter Chrome Extension Design

## Goal

Build a lightweight Manifest V3 Chrome extension for formatting JSON copied from logs or selected from web pages. The extension should work offline, require no build step, and focus on reliable JSON extraction from noisy text plus readable formatting of nested JSON strings.

## User Workflows

### Independent formatter tab

The primary entry is a full-page extension tab. The user can paste log text or JSON-like text into an input pane. The extension scans the text, extracts JSON candidates, selects the most likely candidate by default, and renders a formatted result.

### Selected text handoff

When the user selects text on any web page, a context menu item opens the same formatter tab and passes the selected text into it. This supports logs in web consoles, internal platforms, documents, and email-like pages without requiring manual copy and paste.

## Functional Requirements

- Extract JSON objects and arrays from surrounding log text.
- Support multiple JSON candidates in the same input.
- Default to the highest-confidence candidate while showing all valid candidates.
- Parse JSON values that are themselves escaped JSON strings.
- Support two display modes:
  - Recursive mode: nested JSON strings are expanded into objects or arrays when valid.
  - Raw mode: original parsed JSON is preserved without recursively expanding string values.
- Keep malformed nested string values as plain strings instead of failing the whole parse.
- Show clear empty/error states when no valid JSON candidate can be found.
- Avoid network requests and avoid reading page contents except user-selected text delivered by the context menu.

## Non-Goals

- No server-side storage.
- No cloud sync.
- No dependency on npm or bundling for the first version.
- No full JSON editor or schema validator in the first version.
- No automatic extraction of page contents without user selection.

## Architecture

The extension uses plain HTML, CSS, and JavaScript:

- `manifest.json`: Manifest V3 metadata, permissions, action, background service worker, and context menu declaration.
- `background.js`: Creates the context menu and opens the formatter tab with selected text stored in extension storage.
- `formatter.html`: Full-page formatter UI.
- `formatter.css`: Layout and visual styling.
- `formatter.js`: UI state, input handling, candidate selection, and rendering.
- `jsonTools.js`: Pure parsing utilities for extraction, candidate ranking, recursive JSON string parsing, and stable formatting.
- `tests/jsonTools.test.js`: Local test coverage for parser behavior.

## Data Flow

For pasted text:

1. User enters text in the formatter tab.
2. UI calls `extractJsonCandidates(input)`.
3. Candidates are ranked by parse success, span size, structural depth, and whether the candidate starts as an object or array.
4. The best candidate is selected by default.
5. UI renders either raw parsed JSON or recursively expanded JSON depending on the current display mode.

For selected page text:

1. User selects text on a web page.
2. User chooses the context menu item.
3. Background service worker stores the selected text in `chrome.storage.session` under a short-lived handoff key.
4. Background service worker opens `formatter.html?source=selection`.
5. Formatter tab reads the handoff text, populates the input pane, and runs extraction automatically.

## JSON Extraction Strategy

The extractor scans the input character by character and records balanced `{...}` and `[...]` ranges. It tracks string state and escape characters so braces inside JSON strings do not break matching.

Each balanced range is parsed with `JSON.parse`. Invalid ranges are discarded. Valid ranges are returned with metadata:

- `id`
- `start`
- `end`
- `type`
- `raw`
- `parsed`
- `score`
- `summary`

The first version focuses on valid JSON syntax. It will not attempt to repair non-standard JSON with comments, single quotes, or unquoted keys.

## Nested JSON String Strategy

Recursive mode walks parsed objects and arrays. When it encounters a string, it trims it and attempts `JSON.parse` only if it appears to be a JSON object or array string. If parsing succeeds, the parsed value is recursively processed. If parsing fails, the original string is preserved.

The original candidate remains available so the user can switch back to raw mode without data loss.

## UI Design

The page uses a utilitarian two-pane layout:

- Left pane: input textarea and small action bar.
- Right pane: formatted output in a preformatted code viewer.
- Candidate list: compact list showing detected candidates with type, range, and short summary.
- Mode control: segmented control for Raw and Recursive.
- Utility actions: format, clear, copy output.

The UI should be dense and work-focused rather than decorative. It should handle long logs without layout shifting and keep controls usable on narrow screens.

## Error Handling

- No candidates: show a visible message and leave the output empty.
- Invalid selected candidate: this should not happen because invalid ranges are filtered, but the UI should show an error if rendering fails.
- Unparseable nested strings: preserve the original string.
- Oversized input: continue processing synchronously for the first version; if performance becomes an issue, parsing can later move to a Web Worker.

## Testing

Parser tests should cover:

- Plain JSON object.
- Plain JSON array.
- JSON surrounded by log text.
- Multiple JSON candidates in one input.
- Braces inside JSON strings.
- Escaped nested JSON object string.
- Escaped nested JSON array string.
- Invalid fragments skipped while valid candidates remain.
- Raw mode preserves string values.
- Recursive mode expands nested JSON strings.

Manual extension checks should cover:

- Loading the unpacked extension in Chrome.
- Opening the formatter from the extension icon.
- Selecting text on a page and opening the formatter via context menu.
- Copying formatted output.
