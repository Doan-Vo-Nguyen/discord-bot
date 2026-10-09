import "dotenv/config";
import { Client, ChannelType, IntentsBitField, PermissionFlagsBits } from "discord.js";

const GUILD_ID = process.env.DIS_GUILD_ID;
const PLAN = [
  {
    name: "GAME",
    channels: [
      { name: "cs2", topic: "Tin mới, patch notes, lịch thi đấu CS2", reuseEnv: "CS2_CHANNEL_ID" },
      { name: "wuthering-waves", topic: "Update, banner, tier list, leak WuWa", reuseEnv: "WUWA_CHANNEL_ID" },
      { name: "pgr", topic: "Patch notes và sự kiện Punishing: Gray Raven", reuseEnv: "PGR_CHANNEL_ID" },
      { name: "game-chung", topic: "Tin game khác, thảo luận chung" },
    ],
  },
  {
    name: "AI",
    channels: [
      { name: "xu-huong", topic: "Xu hướng AI, paper, sản phẩm mới" },
      { name: "local-vs-cloud", topic: "Chạy local, cloud, so sánh tool" },
      { name: "gia-ca", topic: "Giá API, subscription, token" },
      { name: "noi-bat", topic: "Model/tool nổi bật trong tuần" },
      { name: "agentic", topic: "Agent, tutor loop, planner-worker, RAG" },
      { name: "prompt", topic: "Khung prompt hiệu quả" },
      { name: "dung-ai", topic: "Cách dùng AI tiết token, đúng việc" },
      { name: "giao-duc", topic: "Kèo AI rẻ cho giáo dục và từng lĩnh vực" },
    ],
  },
  {
    name: "CONG-NGHE",
    channels: [
      { name: "ban-phim", topic: "Bàn phím, switch, layout" },
      { name: "chuot", topic: "Chuột, sensor, wireless" },
      { name: "man-hinh", topic: "Màn hình, panel, Hz" },
      { name: "ssd-ram", topic: "SSD, RAM, storage" },
      { name: "pc-build", topic: "Build máy, CPU, GPU, case" },
    ],
  },
  {
    name: "CA-NHAN",
    channels: [
      { name: "tai-chinh", topic: "Chi tiêu cá nhân, *add *stat", reuseId: "1435081282324533298" },
      { name: "bot-lenh", topic: "Gõ lệnh bot tại đây: *help *update *leak" },
    ],
  },
];

function printTree(guild) {
  const cats = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position);
  const rest = guild.channels.cache.filter((c) => c.type !== ChannelType.GuildCategory);
  console.log(`Server: ${guild.name} (${guild.id})`);
  for (const cat of cats.values()) {
    console.log(`# ${cat.name}  ${cat.id}`);
    rest
      .filter((c) => c.parentId === cat.id)
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .forEach((c) => console.log(`  - ${c.name}  ${c.id}  type=${c.type}`));
  }
  const orphans = rest.filter((c) => !c.parentId);
  if (orphans.size) {
    console.log("# (không category)");
    orphans.forEach((c) => console.log(`  - ${c.name}  ${c.id}  type=${c.type}`));
  }
}

async function ensureCategory(guild, name, position) {
  const existing = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) {
    await existing.setPosition(position).catch(() => {});
    return existing;
  }
  return guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    position,
    reason: "POCA reshape: tạo nhóm kênh",
  });
}

async function ensureText(guild, parent, spec) {
  const reuseId = spec.reuseId || process.env[spec.reuseEnv];
  if (reuseId) {
    const current = guild.channels.cache.get(reuseId);
    if (current) {
      await current.edit({
        name: spec.name,
        topic: spec.topic,
        parent: parent.id,
        reason: "POCA reshape: chuyển kênh cũ",
      });
      return current;
    }
  }

  const sameName = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name === spec.name
  );
  if (sameName) {
    await sameName.edit({
      topic: spec.topic,
      parent: parent.id,
      reason: "POCA reshape: gom kênh trùng tên",
    });
    return sameName;
  }

  return guild.channels.create({
    name: spec.name,
    type: ChannelType.GuildText,
    parent: parent.id,
    topic: spec.topic,
    reason: "POCA reshape: kênh mới",
  });
}

const client = new Client({
  intents: [IntentsBitField.Flags.Guilds],
});

client.once("ready", async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();
    const me = await guild.members.fetchMe();
    if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      console.error("Bot thiếu quyền Manage Channels. Cấp quyền rồi chạy lại.");
      process.exit(1);
    }

    console.log("=== TRƯỚC ===");
    printTree(guild);

    const created = {};
    for (const [index, group] of PLAN.entries()) {
      const category = await ensureCategory(guild, group.name, index);
      created[group.name] = { categoryId: category.id, channels: {} };
      for (const spec of group.channels) {
        const channel = await ensureText(guild, category, spec);
        created[group.name].channels[spec.name] = channel.id;
      }
    }

    console.log("\n=== SAU ===");
    await guild.channels.fetch();
    printTree(guild);

    console.log("\n=== ID ĐỂ CẬP NHẬT .env ===");
    console.log(`CS2_CHANNEL_ID=${created.GAME.channels.cs2}`);
    console.log(`WUWA_CHANNEL_ID=${created.GAME.channels["wuthering-waves"]}`);
    console.log(`PGR_CHANNEL_ID=${created.GAME.channels.pgr}`);
    console.log(`FINANCE_CHANNEL_ID=${created["CA-NHAN"].channels["tai-chinh"]}`);
    console.log(`BOT_COMMAND_CHANNEL_ID=${created["CA-NHAN"].channels["bot-lenh"]}`);
    console.log(JSON.stringify(created, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});

client.login(process.env.BOT_TOKEN);
