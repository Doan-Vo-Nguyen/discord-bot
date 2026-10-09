import "dotenv/config";
import { Client, ChannelType, IntentsBitField } from "discord.js";

const CHANNELS = [
  { name: "agentic", topic: "Agent, tutor loop, planner-worker, RAG rẻ" },
  { name: "prompt", topic: "Khung prompt hiệu quả" },
  { name: "dung-ai", topic: "Cách dùng AI tiết token, đúng việc" },
  { name: "giao-duc", topic: "Kèo AI rẻ cho giáo dục và từng lĩnh vực" },
];

const client = new Client({ intents: [IntentsBitField.Flags.Guilds] });

client.once("ready", async () => {
  const guild = await client.guilds.fetch(process.env.DIS_GUILD_ID);
  await guild.channels.fetch();
  const parent = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toUpperCase() === "AI"
  );
  if (!parent) {
    console.error("Không thấy category AI");
    process.exit(1);
  }

  const created = {};
  for (const spec of CHANNELS) {
    const existing = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name === spec.name
    );
    const channel =
      existing ||
      (await guild.channels.create({
        name: spec.name,
        type: ChannelType.GuildText,
        parent: parent.id,
        topic: spec.topic,
        reason: "POCA: playbook AI",
      }));
    if (existing) await existing.setParent(parent.id).catch(() => {});
    created[spec.name] = channel.id;
    console.log(`${spec.name}=${channel.id}`);
  }
  console.log(JSON.stringify(created));
  process.exit(0);
});

client.login(process.env.BOT_TOKEN);
