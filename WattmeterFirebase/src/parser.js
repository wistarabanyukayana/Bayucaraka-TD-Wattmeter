import { PRIMARY_FIELDS, VALUE_FIELDS } from "./config.js";
import { createEmptyReading } from "./state.js";

export function parseDataLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("DATA,")) {
    return null;
  }

  const next = createEmptyReading();
  const parts = trimmed.slice(5).split(",");

  for (const part of parts) {
    const separator = part.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    if (!PRIMARY_FIELDS.includes(key) && key !== "DROP" && key !== "ACTIVE" && key !== "STALE") {
      continue;
    }

    if (key === "ACTIVE") {
      next.ACTIVE = rawValue.toLowerCase() === "none"
        ? []
        : rawValue.split("|").filter((field) => VALUE_FIELDS.includes(field));
      continue;
    }

    if (key === "STALE") {
      next.STALE = rawValue === "1" || rawValue.toLowerCase() === "true";
      continue;
    }

    if (rawValue.toLowerCase() === "nan" || rawValue === "") {
      next[key] = null;
      continue;
    }

    const numericValue = Number(rawValue);
    if (Number.isFinite(numericValue)) {
      next[key] = numericValue;
    }
  }

  next.receivedAt = Date.now();
  return next;
}
