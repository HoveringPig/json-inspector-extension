# JSON Inspector

JSON Inspector is a lightweight Chrome extension for extracting, formatting, and inspecting JSON copied from logs or selected from web pages.

It is designed for messy engineering workflows: paste a log line, response payload, copied console text, or selected page text, and the extension will find valid JSON candidates, render the selected candidate, and help inspect nested JSON strings without changing the original JSON structure.

## Features

- Extract valid JSON objects and arrays from surrounding log text.
- Detect multiple JSON candidates in one input and let you switch between them.
- Format the selected JSON with line numbers, folding, wrapping controls, and node-level copy.
- Preserve the original JSON shape by default.
- Detect string values that contain escaped JSON and provide an inline expand control for separate inspection.
- Copy any rendered node, including nodes inside expanded nested JSON previews.
- Open selected text from a web page through the Chrome context menu.
- Runs locally with plain HTML, CSS, and JavaScript. No backend and no build step.

## Nested JSON Behavior

JSON Inspector does not automatically rewrite JSON string values into objects or arrays.

For example, this value remains a string in the main output:

```json
{
  "dataset_id": "{\"a\":\"1\"}"
}
```

When a string value is recognized as JSON, the output gutter shows an expand control. Expanding it renders a marked preview below the original line, while the original output remains unchanged. This keeps copy results predictable and avoids changing the semantic structure of the source JSON.

## Usage

### Open the formatter

Click the extension icon to open the JSON Inspector tab.

Paste logs or JSON into the input pane. JSON Inspector will scan the text, list detected candidates, and render the selected candidate in the output pane.

### Open selected text

Select text on any web page, right-click, and choose:

```text
Open selection in JSON Inspector
```

The selected text is passed into the formatter tab automatically.

### Inspect output

- Use the Candidates panel to switch between extracted JSON fragments.
- Use line-number gutter controls to fold, expand nested JSON string previews, or copy a node.
- Use the output header controls to switch line wrapping or copy the full formatted output.

## Install Locally

1. Open Chrome and go to `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project folder.

## Development

Run the parser tests:

```bash
npm test
```

Main files:

- `manifest.json`: Chrome extension manifest.
- `src/background.js`: extension icon and context-menu behavior.
- `src/formatter.html`: formatter page markup.
- `src/formatter.css`: layout and visual styles.
- `src/formatter.js`: UI state, rendering, copy, fold, and expand interactions.
- `src/jsonTools.js`: JSON extraction, parsing, formatting, and nested JSON detection.
- `tests/jsonTools.test.js`: parser behavior tests.

## Privacy

JSON Inspector processes text locally in the browser. It does not send pasted or selected content to a server.
