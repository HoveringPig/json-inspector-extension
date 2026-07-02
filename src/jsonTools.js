export function extractJsonCandidates(input) {
  const text = String(input ?? "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end <= start) {
    return [];
  }

  const raw = text.slice(start, end + 1);

  try {
    const parsed = JSON.parse(raw);
    return [{
      id: "candidate-1",
      start,
      end: end + 1,
      type: "object",
      raw,
      parsed,
      score: raw.length,
      summary: "object",
    }];
  } catch {
    return [];
  }
}

export function formatJson(value) {
  return JSON.stringify(value, null, 2);
}
