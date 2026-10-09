import { EmbedBuilder } from "discord.js";
import logger from "../logger/logger.js";
import { getTopic } from "./config.js";
import {
  clipText,
  formatMetaLine,
  gameLabel,
  localizeTitle,
  pickDisplayBody,
  sourceLabel,
} from "./display.js";

function renderCatalogRows(headers = [], rows = []) {
  const pairTitle = headers[0] === "Provider" && headers[1] === "Model";
  return rows
    .map((row) => {
      const title = pairTitle ? `${row[0]} · ${row[1]}` : row[0];
      const start = pairTitle ? 2 : 1;
      const lines = [`**${title}**`];
      for (let i = start; i < row.length; i += 1) {
        const cell = String(row[i] || "").trim();
        if (!cell || cell === "-") continue;
        const label = headers[i];
        lines.push(label ? `*${label}* · ${cell}` : cell);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

export function buildCatalogEmbed(game, item) {
  const sourceLine = item.source ? `*${sourceLabel(item.source)}*` : "";
  const body =
    item.rows?.length
      ? renderCatalogRows(item.headers, item.rows)
      : item.table
        ? `\`\`\`\n${item.table.slice(0, 3000)}\n\`\`\``
        : pickDisplayBody(item);
  const picks = item.picks?.length
    ? `\n\n**${item.picksLabel || "Ghi nhớ"}**\n${item.picks.join("\n")}`
    : "";
  const embed = new EmbedBuilder()
    .setColor(game.color)
    .setAuthor({ name: gameLabel(game) })
    .setTitle(item.title || "Báo cáo")
    .setDescription(clipText([sourceLine, body].filter(Boolean).join("\n\n") + picks, 4000))
    .setFooter({ text: "POCA" });

  if (item.publishedAt instanceof Date && !Number.isNaN(item.publishedAt.getTime())) {
    embed.setTimestamp(item.publishedAt);
  }
  return embed;
}

export function buildUpdateEmbed(game, item) {
  if (item.kind === "catalog") return buildCatalogEmbed(game, item);

  const title = localizeTitle(item);
  const body = pickDisplayBody(item);
  const description = clipText(`${formatMetaLine(item)}\n\n${body}`, 3500);

  const embed = new EmbedBuilder()
    .setColor(game.color)
    .setAuthor({ name: gameLabel(game) })
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: `${sourceLabel(item.source)} · POCA` });

  if (item.url) embed.setURL(item.url);
  if (item.image) embed.setThumbnail(item.image);
  if (item.publishedAt instanceof Date && !Number.isNaN(item.publishedAt.getTime())) {
    embed.setTimestamp(item.publishedAt);
  }

  return embed;
}

export async function enrichItems(game, items, summarizer) {
  if (!summarizer) return items;
  const enriched = [];
  for (const item of items) {
    if (item.kind === "catalog") {
      enriched.push(item);
      continue;
    }
    const viSummary = await summarizer.summarizeItem(game, item);
    enriched.push({ ...item, viSummary });
  }
  return enriched;
}

export async function postItems(client, gameKey, items, summarizer, channelId) {
  const game = getTopic(gameKey);
  if (!game || !items.length) return 0;

  const targetId = channelId || game.channelId;
  const channel = await client.channels.fetch(targetId).catch(() => null);
  if (!channel) {
    logger.warn(`Không tìm thấy kênh cập nhật cho ${gameKey}: ${targetId}`);
    return 0;
  }

  const ready = await enrichItems(game, items, summarizer);
  let posted = 0;
  for (const item of ready) {
    await channel.send({ embeds: [buildUpdateEmbed(game, item)] });
    posted += 1;
  }
  return posted;
}
