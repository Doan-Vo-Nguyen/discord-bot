import { EmbedBuilder } from "discord.js";
import logger from "../logger/logger.js";
import { DIGEST_HOUR, getTopic, listAllTopicKeys } from "./config.js";
import { fetchAllUpdates, fetchTopicUpdates } from "./fetchers.js";
import { itemsFromLastHours } from "./classify.js";
import { postItems } from "./poster.js";
import { loadStore, saveStore } from "./store.js";

export function vnDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

export function buildDigestEmbed(game, body, dateLabel) {
  return new EmbedBuilder()
    .setColor(game.color)
    .setAuthor({ name: game.shortName || game.name })
    .setTitle("Báo cáo trong ngày")
    .setDescription(body.slice(0, 4000))
    .setFooter({ text: `POCA · ${dateLabel}` });
}

export async function postDigestForGames(client, summarizer, keys = listAllTopicKeys(), channelId) {
  let posted = 0;
  const { date } = vnDateParts();

  for (const key of keys) {
    const game = getTopic(key);
    if (!game) continue;

    if (game.kind === "catalog") {
      const items = await fetchTopicUpdates(key);
      if (!items.length) continue;
      posted += await postItems(client, key, items.slice(0, 1), null, channelId);
      continue;
    }

    const items = itemsFromLastHours(await fetchTopicUpdates(key), 36);
    const fallback = items.length
      ? items.slice(0, 5).map((item) => `• ${item.title}`).join("\n")
      : `Hôm nay chưa có tin đáng chú ý cho ${game.shortName || game.name}.`;
    const body = !summarizer ? fallback : await summarizer.summarizeDigest(game, items);
    const targetId = channelId || game.channelId;
    const channel = await client.channels.fetch(targetId).catch(() => null);
    if (!channel) {
      logger.warn(`Không tìm thấy kênh báo cáo cho ${key}`);
      continue;
    }

    await channel.send({ embeds: [buildDigestEmbed(game, body, date)] });
    posted += 1;
  }

  return posted;
}

export async function maybePostDailyDigest(client, summarizer) {
  const { date, hour } = vnDateParts();
  const digestHour = DIGEST_HOUR;

  if (hour < digestHour) return false;

  const store = loadStore();
  if (store.lastDigestDate === date) return false;

  const all = await fetchAllUpdates();
  const hasAnything = Object.values(all).some((list) => list.length);
  if (!hasAnything) return false;

  await postDigestForGames(client, summarizer);
  store.lastDigestDate = date;
  saveStore(store);
  logger.info(`Posted daily digest for ${date}.`);
  return true;
}
