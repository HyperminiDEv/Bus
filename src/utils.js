export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

export function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function cleanText(value) {
  if (!hasValue(value)) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

export function toFiniteNumber(value) {
  if (!hasValue(value)) return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function pickValue(source, keys, forcedKey = null) {
  if (!source || typeof source !== "object") return undefined;
  if (forcedKey && source[forcedKey] !== undefined) return source[forcedKey];
  const index = new Map(Object.keys(source).map(key => [key.toLowerCase(), key]));
  for (const key of keys) {
    const realKey = index.get(String(key).toLowerCase());
    if (realKey !== undefined) return source[realKey];
  }
  return undefined;
}

export function slugify(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function uniqueSorted(values) {
  return [...new Set(values.map(cleanText).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es-UY"));
}

export function parseApiDate(value) {
  if (!hasValue(value)) return null;
  const text = String(value).trim();
  if (text.startsWith("0001-01-01")) return null;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;
  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTime(value) {
  const directTime = cleanText(value);
  if (/^\d{1,2}:\d{2}$/.test(directTime)) return directTime;
  const date = parseApiDate(value);
  if (!date) return "";
  return date.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function firstText(source, keys) {
  for (const key of keys) {
    const value = pickValue(source, [key]);
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

export function firstTime(source, keys) {
  for (const key of keys) {
    const value = pickValue(source, [key]);
    const time = formatTime(value);
    if (time) return time;
  }
  return "";
}

export function firstDate(source, keys) {
  for (const key of keys) {
    const date = parseApiDate(pickValue(source, [key]));
    if (date) return date;
  }
  return null;
}

export function asBoolean(value) {
  if (value === true || value === 1) return true;
  if (typeof value === "string") return ["1", "true", "si", "sí", "yes"].includes(value.trim().toLowerCase());
  return false;
}
