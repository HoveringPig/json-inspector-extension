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
