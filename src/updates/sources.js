import axios from "axios";
import logger from "../logger/logger.js";

const http = axios.create({
  timeout: 8000,
  headers: { "User-Agent": "POCA-Discord-Bot/1.0" },
});

const cache = new Map();
const CACHE_MS = 10 * 60 * 1000;

export async function cached(key, fn, ttl = CACHE_MS) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const MONTHS = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

export function stripHtml(text = "") {
  return String(text)
    .replace(/<[^>]+>/g, " ")
    .replace(/\\[ntr]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function clip(text, max = 400) {
  if (!text) return "Không có tóm tắt.";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function makeId(...parts) {
  return parts.filter(Boolean).join("::");
}

export function parseFlexibleDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const raw = String(value).trim();
  const iso = Date.parse(raw);
  if (!Number.isNaN(iso)) return new Date(iso);

  const dayMonthYear = raw.match(/^(\d{1,2})\/([A-Za-z]+)\/(\d{4})$/);
  if (dayMonthYear) {
    const month = MONTHS[dayMonthYear[2].toLowerCase()];
    if (month != null) return new Date(Date.UTC(Number(dayMonthYear[3]), month, Number(dayMonthYear[1])));
  }

  const monthDayYear = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (monthDayYear) {
    const month = MONTHS[monthDayYear[1].toLowerCase()];
    if (month != null) return new Date(Date.UTC(Number(monthDayYear[3]), month, Number(monthDayYear[2])));
  }

  return null;
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export async function fetchMarkdown(url) {
  return cached(`md:${url}`, async () => {
    const { data } = await http.get(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
      timeout: 8000,
    });
    return String(data || "");
  });
}

export async function fetchJson(url, params) {
  const key = `json:${url}:${JSON.stringify(params || {})}`;
  return cached(key, async () => {
    const { data } = await http.get(url, { params, timeout: 8000 });
    return data;
  });
}

export async function safeSource(label, fn) {
  try {
    const items = await fn();
    return Array.isArray(items) ? items : [];
  } catch (err) {
    logger.warn(`Source ${label} failed: ${err.message}`);
    return [];
  }
}

export { http };
