import test from "node:test";
import assert from "node:assert/strict";

import {
  deepParseJsonStrings,
  extractJsonCandidates,
  formatJson,
  parseNestedJsonString,
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

test("ignores unmatched quotes in surrounding log text", () => {
  const input = 'INFO unmatched quote " before {"ok":true}';
  const candidates = extractJsonCandidates(input);

  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].parsed, { ok: true });
});

test("recovers valid candidates after unbalanced invalid fragments", () => {
  const input = 'bad {noise good {"status":"ok"}';
  const candidates = extractJsonCandidates(input);

  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].parsed, { status: "ok" });
});

test("recovers valid candidates after invalid fragments with unmatched quotes", () => {
  const input = 'bad {noise " good {"status":"ok"}';
  const candidates = extractJsonCandidates(input);

  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].parsed, { status: "ok" });
});

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

test("formatJson preserves nested JSON strings in raw output", () => {
  const input = '{"payload":"{\\"name\\":\\"demo\\"}"}';
  const [candidate] = extractJsonCandidates(input);

  assert.equal(formatJson(candidate.parsed), '{\n  "payload": "{\\"name\\":\\"demo\\"}"\n}');
});

test("detects nested JSON strings for field-level expansion", () => {
  assert.deepEqual(parseNestedJsonString('{"a":"1"}'), { a: "1" });
  assert.deepEqual(parseNestedJsonString("[1,2]"), [1, 2]);
  assert.equal(parseNestedJsonString("plain text"), null);
  assert.equal(parseNestedJsonString('{"broken"'), null);
});

test("prefers the outer array when it contains nested objects and JSON strings", () => {
  const input = `[
    {
      "datasource_id": "10750",
      "datasource_index": "1",
      "datasource_extra": {
        "dSourceType": "dataset",
        "dSourceTitle": "零售标准口径数据资产"
      },
      "type": "dataset",
      "content": "零售标准口径数据资产",
      "dataset_id": "{\\"a\\":\\"1\\"}"
    }
  ]`;
  const [candidate] = extractJsonCandidates(input);

  assert.equal(candidate.type, "array");
  assert.equal(candidate.parsed[0].dataset_id, '{"a":"1"}');
  assert.deepEqual(parseNestedJsonString(candidate.parsed[0].dataset_id), { a: "1" });
});
