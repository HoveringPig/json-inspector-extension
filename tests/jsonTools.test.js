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
