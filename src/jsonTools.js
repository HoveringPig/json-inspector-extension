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
