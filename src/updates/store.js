import fs from "fs";
import path from "path";
import logger from "../logger/logger.js";
import { STORE_PATH, listAllTopicKeys } from "./config.js";

const MAX_IDS = 160;

function emptyState() {
  const state = { lastDigestDate: null };
  for (const key of listAllTopicKeys()) state[key] = [];
  return state;
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return emptyState();
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    return { ...emptyState(), ...parsed };
  } catch (err) {
    logger.warn(`Could not read update store: ${err.message}`);
    return emptyState();
  }
}

export function saveStore(state) {
  ensureDir(STORE_PATH);
  fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2));
}

export function hasSeen(state, gameKey, id) {
  return (state[gameKey] || []).includes(id);
}

export function markSeen(state, gameKey, ids) {
  const current = state[gameKey] || [];
  const next = [...ids.filter(Boolean), ...current.filter((id) => !ids.includes(id))];
  state[gameKey] = next.slice(0, MAX_IDS);
  return state;
}
