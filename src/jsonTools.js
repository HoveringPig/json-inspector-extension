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
    .filter((candidate, _index, candidates) => !isContainedInAnotherCandidate(candidate, candidates))
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
  let activeScans = [];

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextScans = [];

    for (const scan of activeScans) {
      if (!advanceScan(scan, char)) {
        continue;
      }

      if (scan.stack.length === 0) {
        ranges.push({ start: scan.start, end: index + 1 });
      } else {
        nextScans.push(scan);
      }
    }

    if (char === "{" || char === "[") {
      nextScans.push({
        start: index,
        stack: [char],
        inString: false,
        escaped: false,
      });
    }

    activeScans = nextScans;
  }

  return ranges;
}

function advanceScan(scan, char) {
  if (scan.inString) {
    if (scan.escaped) {
      scan.escaped = false;
    } else if (char === "\\") {
      scan.escaped = true;
    } else if (char === '"') {
      scan.inString = false;
    }
    return true;
  }

  if (char === '"') {
    scan.inString = true;
    return true;
  }

  if (char === "{" || char === "[") {
    scan.stack.push(char);
    return true;
  }

  if (char === "}" || char === "]") {
    if (scan.stack[scan.stack.length - 1] !== CLOSE_TO_OPEN[char]) {
      return false;
    }

    scan.stack.pop();
  }

  return true;
}

function isContainedInAnotherCandidate(candidate, candidates) {
  return candidates.some((other) => (
    other !== candidate
    && other.start <= candidate.start
    && candidate.end <= other.end
  ));
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
