import "dotenv/config";
import { Client, ChannelType, IntentsBitField } from "discord.js";

const client = new Client({ intents: [IntentsBitField.Flags.Guilds] });

client.once("ready", async () => {
  const guild = await client.guilds.fetch(process.env.DIS_GUILD_ID);
  await guild.channels.fetch();
  const room = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === "room"
  );
  if (!room) {
    console.log("Không thấy category Room.");
    process.exit(0);
  }

  const children = guild.channels.cache.filter((c) => c.parentId === room.id);
  for (const channel of children.values()) {
    await channel.delete("POCA: tạm thời không cần Room");
    console.log(`Đã xóa ${channel.name}`);
  }
  await room.delete("POCA: tạm thời không cần Room");
  console.log("Đã xóa category Room.");
  process.exit(0);
});

client.login(process.env.BOT_TOKEN);
