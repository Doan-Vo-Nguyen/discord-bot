import logger from "../logger/logger.js";

const DEFAULT_CATEGORY = "room";

export async function handleCallNow(message, categoryName = DEFAULT_CATEGORY) {
  const category = message.guild.channels.cache.find(
    (channel) => channel.type === 4 && channel.name.toLowerCase() === categoryName.toLowerCase()
  );

  if (!category) {
    logger.warn(`Category "${categoryName}" not found.`);
    await message.reply(`Category "${categoryName}" not found.`);
    return;
  }

  const emptyChannel = message.guild.channels.cache.find(
    (channel) => channel.parentId === category.id && channel.type === 2 && channel.members.size === 0
  );

  if (emptyChannel) {
    logger.info(`Empty channel found: ${emptyChannel.name}`);
    await message.reply(`Our meeting room in the "${categoryName}" section: <#${emptyChannel.id}>`);
  } else {
    logger.warn(`No empty voice channels in "${categoryName}" section.`);
    await message.reply(`Sorry, no empty voice channels are available in the "${categoryName}" section right now.`);
  }
}

export async function handleCallRoom(message, channelName) {
  const name = String(channelName || "").toLowerCase().trim();
  if (!name) {
    return message.reply("⚠️ Vui lòng cung cấp tên kênh thoại.");
  }
  const voiceChannel = message.guild.channels.cache.find(
    (channel) => channel.type === 2 && channel.name.toLowerCase() === name
  );

  if (voiceChannel) {
    logger.info(`Voice channel found: ${voiceChannel.name}`);
    await message.reply(`Our meeting room is <#${voiceChannel.id}>`);
  } else {
    logger.warn(`Voice channel "${channelName}" not found.`);
    await message.reply(`Sorry, no voice channel named "${channelName}" found in the server.`);
  }
}

export default { handleCallNow, handleCallRoom };


