# JSON Inspector Chrome Extension Implementation Plan

> This plan has been updated to reflect the current as-built implementation. Earlier drafts used the temporary name `Log JSON Formatter` and described Raw/Recursive display modes; those have been superseded by the final `JSON Inspector` behavior.

## Goal

Deliver a no-build Manifest V3 Chrome extension that extracts JSON from noisy log text, renders source-order mixed output, and lets users inspect nested JSON strings without changing the original JSON structure.

## Current Status

- [x] Manifest V3 Chrome extension scaffolded.
- [x] Extension renamed to `JSON Inspector`.
- [x] Context menu handoff implemented.
- [x] Log text JSON extraction implemented.
- [x] Multiple JSON segment extraction and ranking implemented.
- [x] Contained candidate filtering implemented.
- [x] Mixed output rendering implemented: raw text is preserved and JSON segments are formatted inline.
- [x] Raw non-JSON text markers implemented.
- [x] Nested JSON string detection implemented.
- [x] Main output preserves original JSON string values.
- [x] Field-level nested JSON preview expansion implemented.
- [x] Line-numbered output implemented.
- [x] Object/array folding implemented.
- [x] Node-level copy implemented.
- [x] Full-output copy implemented.
- [x] Wrap/no-wrap toggle implemented.
- [x] Minify/pretty output toggle implemented.
- [x] Classic, Light, and Dark themes implemented.
- [x] Theme persistence implemented.
- [x] Clear action moved into the Input header.
- [x] Fixed full-page layout implemented.
- [x] Independent scrolling for Input and Output implemented.
- [x] README created with screenshots.
- [x] Screenshot demo input added.
- [x] GitHub repository created and made public.

## File Structure

- `package.json`: npm metadata and `npm test`.
- `manifest.json`: Chrome extension metadata, action title, permissions, and service worker registration.
- `README.md`: public-facing plugin introduction, screenshots, usage, install steps, and privacy note.
- `src/jsonTools.js`: pure JSON extraction, ranking, formatting, and nested JSON string detection utilities.
- `src/background.js`: context menu setup and selected-text handoff.
- `src/formatter.html`: full-page inspector markup.
- `src/formatter.css`: responsive fixed-height layout, theme variables, and UI styling.
- `src/formatter.js`: UI state, mixed output rendering, folding, wrapping, minify/pretty display, theme persistence, nested preview expansion, copy actions, and selected-text handoff loading.
- `tests/jsonTools.test.js`: parser and formatter tests using Node's built-in test runner.
- `examples/screenshot-demo-input.txt`: demo input for README screenshots and manual checks.
- `docs/images/`: README screenshot assets.
- `docs/superpowers/specs/2026-07-02-json-formatter-extension-design.md`: as-built design spec.

## Implementation Phases

### Phase 1: Parser And Test Harness

- [x] Add `package.json` with `node --test`.
- [x] Add parser smoke tests.
- [x] Implement `extractJsonCandidates`.
- [x] Implement `formatJson`.
- [x] Add balanced scanner for objects and arrays.
- [x] Recover valid candidates after invalid fragments.
- [x] Ignore braces inside JSON strings.
- [x] Add nested JSON string parser.
- [x] Preserve malformed nested JSON strings.
- [x] Filter candidates contained in larger valid candidates.

### Phase 2: Chrome Extension Shell

- [x] Add Manifest V3 `manifest.json`.
- [x] Add extension action.
- [x] Add background service worker.
- [x] Add context menu item: `Open selection in JSON Inspector`.
- [x] Store selected text in `chrome.storage.session`.
- [x] Open `src/formatter.html?source=selection`.
- [x] Load and clear handoff text in the formatter tab.

### Phase 3: Formatter UI

- [x] Add full-page formatter markup.
- [x] Add app header with brand, status, and Clear action.
- [x] Add left column for Input.
- [x] Add right column for Output.
- [x] Use approximately 4:6 left/right ratio.
- [x] Remove wide-screen max-width so the page uses full viewport width.
- [x] Keep page fixed-height with no body scrolling.
- [x] Give Input and Output their own scroll areas.
- [x] Move Clear action into the Input header.
- [x] Add Classic, Light, and Dark theme selector.
- [x] Remember selected theme locally.

### Phase 4: Output Tree Interactions

- [x] Render output with line numbers.
- [x] Add sticky output gutter.
- [x] Add copy icons in the gutter for visible nodes.
- [x] Add fold controls in the gutter for arrays and objects.
- [x] Add nested JSON string expand controls in the gutter.
- [x] Keep nested expansion out of the main text content so drag-copy is not interrupted.
- [x] Render nested previews with distinct background and left marker.
- [x] Add wrap/no-wrap output toggle, defaulting to wrap.
- [x] Add minify/pretty output toggle.
- [x] Preserve raw text in output with visible markers.
- [x] Add body-level fixed tooltip for gutter controls so hover text is not clipped.

### Phase 5: Documentation

- [x] Rename project documentation to `JSON Inspector`.
- [x] Add `README.md`.
- [x] Add screenshots to `docs/images/`.
- [x] Add screenshot/demo input to `examples/screenshot-demo-input.txt`.
- [x] Document nested JSON behavior clearly: expansion is an inspectable preview, not a structural rewrite.
- [x] Document local Chrome extension installation.
- [x] Document privacy behavior.

### Phase 6: GitHub Publication

- [x] Create GitHub repository: `skyward-lab/json-inspector-extension`.
- [x] Push branch: `codex/json-formatter-extension`.
- [x] Set repository visibility to public.
- [x] Push README screenshots and demo input.

## Verification Commands

Run these before publishing code changes:

```bash
node --check src/background.js
node --check src/formatter.js
node --check src/jsonTools.js
npm test
```

Expected result:

```text
17 tests pass
0 tests fail
```

## Manual Verification Checklist

- [ ] Load the project as an unpacked Chrome extension from `chrome://extensions`.
- [ ] Click the extension action and confirm the inspector opens.
- [ ] Paste `examples/screenshot-demo-input.txt`.
- [ ] Confirm raw log text and formatted JSON segments appear together in output.
- [ ] Confirm non-empty raw text lines have a `TXT` marker.
- [ ] Expand `nested_object` and confirm the preview is visually marked.
- [ ] Expand `nested_array` and confirm preview nodes are copyable.
- [ ] Fold an object or array from the line-number gutter.
- [ ] Toggle Wrap / No wrap.
- [ ] Toggle Minify / Pretty.
- [ ] Copy the full output.
- [ ] Copy an individual node from the gutter.
- [ ] Switch Classic, Light, and Dark themes.
- [ ] Reload and confirm the selected theme is remembered.
- [ ] Select text on a web page and open it through `Open selection in JSON Inspector`.

## Known Scope Boundaries

- JSON Inspector only supports valid JSON syntax.
- It does not repair single quotes, comments, trailing commas, or unquoted keys.
- It does not send content to a server.
- It does not scrape page content automatically.
- Nested JSON strings are previewed on demand and are not substituted into the main output.

## Next Useful Improvements

- Add extension icons for multiple Chrome sizes.
- Add a small keyboard shortcut map for common actions.
- Add optional copy mode for "copy rendered preview" versus "copy original node".
- Add larger input performance safeguards if logs become very large.
- Add Playwright or browser-level UI smoke checks if the project later adopts a build/test runner.
