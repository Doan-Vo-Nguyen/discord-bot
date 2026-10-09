import "dotenv/config";
import { Client, ChannelType, IntentsBitField } from "discord.js";

const client = new Client({ intents: [IntentsBitField.Flags.Guilds] });

client.once("ready", async () => {
  const guild = await client.guilds.fetch(process.env.DIS_GUILD_ID);
  await guild.channels.fetch();

  const emptyUpdates = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === "UPDATES" && !guild.channels.cache.some((ch) => ch.parentId === c.id)
  );
  if (emptyUpdates) {
    await emptyUpdates.delete("POCA reshape: xóa nhóm UPDATES trống");
    console.log("Đã xóa UPDATES trống");
  }

  const order = ["GAME", "AI", "CONG-NGHE", "CA-NHAN"];
  for (const [index, name] of order.entries()) {
    const cat = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === name
    );
    if (cat) await cat.setPosition(index);
  }
  console.log("Đã xếp GAME / AI / CONG-NGHE / CA-NHAN lên đầu.");
  process.exit(0);
});

client.login(process.env.BOT_TOKEN);
