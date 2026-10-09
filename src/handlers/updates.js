import logger from "../logger/logger.js";
import { getGameByChannelId, getGameByKey, listGameKeys } from "../updates/config.js";
import { fetchGameUpdates, fetchTopicUpdates } from "../updates/fetchers.js";
import { fetchWuwaLeaks } from "../updates/leaks.js";
import { filterItems } from "../updates/classify.js";
import { loadStore, markSeen, saveStore } from "../updates/store.js";
import { postItems } from "../updates/poster.js";
import { postDigestForGames, vnDateParts } from "../updates/digest.js";

function usage() {
  return [
    "Cú pháp:",
    "`*update [patch] [cs2|wuwa|pgr|xu-huong|...]` — gửi tin mới",
    "`*digest [cs2|wuwa|pgr|xu-huong|...]` — gửi báo cáo trong ngày ngay",
    "`*tier [wuwa]` — gửi bảng xếp hạng Prydwen và dữ liệu Nanoka",
    "`*leak [wuwa]` — tin leak/datamine phiên bản tới (chưa chính thức)",
  ].join("\n");
}

function resolveKeys(arg, channelId) {
  if (getGameByKey(arg)) return [arg];
  const fromChannel = getGameByChannelId(channelId);
  if (!arg && fromChannel) return [fromChannel.key];
  if (!arg) return listGameKeys();
  if (fromChannel) return [fromChannel.key];
  return null;
}

async function withReply(message, work) {
  try {
    return await work();
  } catch (err) {
    logger.error(`Lệnh cập nhật lỗi: ${err.message}`);
    return message.reply("Không lấy được tin lúc này, thử lại giúp mình.");
  }
}

export function createUpdateHandler(summarizer) {
  async function handleUpdateCommand(message, raw = "") {
    return withReply(message, async () => {
    const parts = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const patchOnly = parts[0] === "patch";
    if (patchOnly) parts.shift();

    const keys = resolveKeys(parts[0] || "", message.channel.id);
    if (parts[0] && !keys) return message.reply(usage());

    await message.reply(`Đang lấy ${patchOnly ? "bản cập nhật" : "tin"} cho **${keys.join(", ")}**...`);

    const store = loadStore();
    const lines = [];

    for (const key of keys) {
      const items = filterItems(await fetchTopicUpdates(key), { patchOnly });
      if (!items.length) {
        lines.push(`• **${key}**: không có tin phù hợp.`);
        continue;
      }

      const newest = items.slice(0, 2).reverse();
      const posted = await postItems(message.client, key, newest, summarizer, message.channel.id);
      markSeen(store, key, newest.map((item) => item.id));
      lines.push(`• **${key}**: đã gửi ${posted} tin vào kênh cập nhật.`);
    }

    saveStore(store);
    logger.info(`Manual update by ${message.author.username}: ${keys.join(",")}`);
    return message.reply(lines.join("\n"));
    });
  }

  async function handleDigestCommand(message, raw = "") {
    return withReply(message, async () => {
    const arg = raw.trim().toLowerCase();
    const keys = resolveKeys(arg, message.channel.id);
    if (arg && !keys) return message.reply(usage());

    await message.reply(`Đang soạn báo cáo trong ngày cho **${keys.join(", ")}**...`);
    const posted = await postDigestForGames(message.client, summarizer, keys, message.channel.id);

    const store = loadStore();
    store.lastDigestDate = vnDateParts().date;
    saveStore(store);

    logger.info(`Manual digest by ${message.author.username}: ${keys.join(",")}`);
    return message.reply(`Đã gửi ${posted} báo cáo trong ngày.`);
    });
  }

  async function handleTierCommand(message, raw = "") {
    return withReply(message, async () => {
    const arg = raw.trim().toLowerCase() || "wuwa";
    const keys = resolveKeys(arg, message.channel.id);
    if (!keys) return message.reply(usage());

    await message.reply(`Đang lấy bảng xếp hạng / dữ liệu cho **${keys.join(", ")}**...`);
    const store = loadStore();
    const lines = [];

    for (const key of keys) {
      const items = await Promise.race([
        fetchGameUpdates(key, { sources: ["prydwen", "nanoka"] }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Hết thời gian chờ nguồn dữ liệu")), 12000)
        ),
      ]);
      if (!items.length) {
        lines.push(`• **${key}**: chưa lấy được bảng xếp hạng.`);
        continue;
      }
      const posted = await postItems(
        message.client,
        key,
        items.slice(0, 2),
        null,
        message.channel.id
      );
      markSeen(store, key, items.map((item) => item.id));
      lines.push(`• **${key}**: đã gửi ${posted} tin.`);
    }

    saveStore(store);
    logger.info(`Manual tier by ${message.author.username}: ${keys.join(",")}`);
    return message.reply(lines.join("\n"));
    });
  }

  async function handleLeakCommand(message, raw = "") {
    return withReply(message, async () => {
      const arg = raw.trim().toLowerCase() || "wuwa";
      if (arg && arg !== "wuwa") {
        return message.reply("Hiện mới hỗ trợ `*leak wuwa`.");
      }

      await message.reply("Đang lấy tin leak từ Seele và các nguồn datamine...");
      const items = await Promise.race([
        fetchWuwaLeaks(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Hết thời gian chờ nguồn leak")), 12000)
        ),
      ]);

      if (!items.length) {
        return message.reply("Chưa lấy được tin leak mới, thử lại sau.");
      }

      const posted = await postItems(message.client, "wuwa", items.slice(0, 3), null, message.channel.id);
      logger.info(`Manual leak by ${message.author.username}`);
      return message.reply(`Đã gửi ${posted} tin leak. Đây không phải thông báo chính thức.`);
    });
  }

  return { handleUpdateCommand, handleDigestCommand, handleTierCommand, handleLeakCommand };
}

export default createUpdateHandler;
