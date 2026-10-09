import logger from "../logger/logger.js";
import { UPDATE_POLL_MS, listAllTopicKeys } from "./config.js";
import { fetchAllUpdates } from "./fetchers.js";
import { filterItems } from "./classify.js";
import { hasSeen, loadStore, markSeen, saveStore } from "./store.js";
import { postItems } from "./poster.js";
import { maybePostDailyDigest } from "./digest.js";

function pickNewItems(state, gameKey, items) {
  return items.filter((item) => !hasSeen(state, gameKey, item.id)).slice(0, 3).reverse();
}

export function startUpdateScheduler(client, summarizer) {
  let seeded = false;
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const store = loadStore();
      const all = await fetchAllUpdates();

      for (const gameKey of listAllTopicKeys()) {
        const items = all[gameKey] || [];
        if (!items.length) continue;

        if (!seeded && (store[gameKey] || []).length === 0) {
          const first = items.slice(0, 1);
          const postedFirst = await postItems(client, gameKey, first, null);
          markSeen(store, gameKey, items.map((item) => item.id));
          if (postedFirst) logger.info(`Đăng tin mới nhất lần đầu cho ${gameKey}.`);
          continue;
        }

        const autoOnly = ["cs2", "wuwa", "pgr"].includes(gameKey);
        const toPost = pickNewItems(store, gameKey, filterItems(items, { autoOnly, patchOnly: false }));
        if (!toPost.length) continue;

        const posted = await postItems(client, gameKey, toPost, summarizer);
        if (posted) {
          markSeen(store, gameKey, toPost.map((item) => item.id));
          logger.info(`Posted ${posted} new ${gameKey} patch/maintenance update(s).`);
        }
      }

      seeded = true;
      saveStore(store);
      await maybePostDailyDigest(client, summarizer);
    } finally {
      running = false;
    }
  };

  client.once("ready", () => {
    logger.info(`Logged in as ${client.user.tag}`);
    logger.info(`Game update scheduler started (every ${UPDATE_POLL_MS / 60000} min).`);
    setTimeout(() => {
      tick().catch((err) => logger.error(`Update scheduler tick failed: ${err.message}`));
    }, 8000);
    setInterval(() => {
      tick().catch((err) => logger.error(`Update scheduler tick failed: ${err.message}`));
    }, UPDATE_POLL_MS);
  });
}
