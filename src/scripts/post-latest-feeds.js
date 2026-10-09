import "dotenv/config";
import { Client, IntentsBitField } from "discord.js";
import { listFeedKeys } from "../updates/config.js";
import { fetchTopicUpdates } from "../updates/fetchers.js";
import { postItems } from "../updates/poster.js";
import { loadStore, markSeen, saveStore } from "../updates/store.js";

const client = new Client({ intents: [IntentsBitField.Flags.Guilds] });

client.once("ready", async () => {
  const keys = process.argv.slice(2).length ? process.argv.slice(2) : listFeedKeys();
  const store = loadStore();
  const lines = [];

  for (const key of keys) {
    const items = await fetchTopicUpdates(key);
    if (!items.length) {
      lines.push(`${key}: chưa lấy được tin`);
      continue;
    }
    const newest = items.slice(0, 2);
    const posted = await postItems(client, key, newest, null);
    markSeen(store, key, items.map((item) => item.id));
    lines.push(`${key}: gửi ${posted} bảng giá`);
  }

  saveStore(store);
  console.log(lines.join("\n"));
  process.exit(0);
});

client.login(process.env.BOT_TOKEN);
