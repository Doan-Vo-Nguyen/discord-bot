import {
  Client,
  IntentsBitField,
  EmbedBuilder,
  GatewayIntentBits,
} from "discord.js";
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import logger from "./logger/logger.js";
import creds from "./gen-lang-client-0021678840-98face63970b.json" with { type: "json" };
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildVoiceStates,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Google Sheets Initialization
const SPREADSHEET_ID = process.env.SPREADSHEET_ID_GG;
const serviceAccountAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
await doc.loadInfo();

const MODEL_NAME = "gemini-pro";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const greetings = ["hello", "hi"];
const byeMessages = ["bye", "good bye"];
const prefix = "*call room ";
const welcomeMessages = [
  "Welcome to our server!",
  "Glad to have you here!",
  "Hello and welcome!",
];

const VALID_HANG_MUC = ["T", "C"];
const VALID_HU = ["NEC", "LTSS", "FFA", "EDU", "PLAYL", "GIVE"];

const handleGreetings = async (message, content) => {
  if (greetings.includes(content)) {
    logger.info(`Greeting detected: ${content}`);
    await message.reply("Hello");
  } else if (byeMessages.includes(content)) {
    logger.info(`Goodbye detected: ${content}`);
    await message.reply("Bye");
  }
};

const handleTaggedUser = async (message) => {
  if (message.mentions.has(client.user) && message.mentions.users.size > 1) {
    const taggedUser = message.mentions.users.find(
      (user) => user.id !== client.user.id
    );
    if (taggedUser) {
      logger.info(`Tagged user: ${taggedUser.username}`);
      await message.reply(`hello <@${taggedUser.id}>`);
    }
  }
};

const handleCallNow = async (message) => {
  const categoryName = "room";
  const category = message.guild.channels.cache.find(
    (channel) =>
      channel.type === 4 &&
      channel.name.toLowerCase() === categoryName.toLowerCase()
  );

  if (!category) {
    logger.warn(`Category "${categoryName}" not found.`);
    await message.reply(`Category "${categoryName}" not found.`);
    return;
  }

  const emptyChannel = message.guild.channels.cache.find(
    (channel) =>
      channel.parentId === category.id &&
      channel.type === 2 &&
      channel.members.size === 0
  );

  if (emptyChannel) {
    logger.info(`Empty channel found: ${emptyChannel.name}`);
    await message.reply(
      `Our meeting room in the "${categoryName}" section: <#${emptyChannel.id}>`
    );
  } else {
    logger.warn(`No empty voice channels in "${categoryName}" section.`);
    await message.reply(
      `Sorry, no empty voice channels are available in the "${categoryName}" section right now.`
    );
  }
};

const handleCallRoom = async (message, content) => {
  const channelName = content.slice(prefix.length).trim();
  const voiceChannel = message.guild.channels.cache.find(
    (channel) => channel.type === 2 && channel.name.toLowerCase() === channelName
  );

  if (voiceChannel) {
    logger.info(`Voice channel found: ${voiceChannel.name}`);
    await message.reply(`Our meeting room is <#${voiceChannel.id}>`);
  } else {
    logger.warn(`Voice channel "${channelName}" not found.`);
    await message.reply(
      `Sorry, no voice channel named "${channelName}" found in the server.`
    );
  }
};

const handleGenerativeAI = async (message, userMessage) => {
  try {
    logger.info(`Generating AI response for message: ${userMessage}`);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const generationConfig = {
      temperature: 0.9,
      topK: 1,
      topP: 1,
      maxOutputTokens: 2048,
    };

    const parts = [{ text: `input: ${userMessage}` }];
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig,
    });
    const reply = result.response.text();

    if (reply.length > 2000) {
      const replyArray = reply.match(/[\s\S]{1,2000}/g);
      for (const replyPart of replyArray) {
        await message.reply(replyPart);
      }
    } else {
      await message.reply(reply);
    }
  } catch (error) {
    logger.error(`Error in handleGenerativeAI: ${error.message}`);
    await message.reply("An error occurred while generating a response.");
  }
};

const handleMentionedUser = async (message) => {
  const mentionedUser = message.mentions.users.first();
  const mentionedMember = message.guild.members.cache.get(mentionedUser.id);

  if (!mentionedMember || mentionedMember.id === message.guild.ownerId) return;

  let hasResponded = false;

  const messageCollector = message.channel.createMessageCollector({
    time: 20000,
    filter: (m) => m.author.id === mentionedUser.id,
  });

  const reactionCollector = message.createReactionCollector({
    time: 20000,
    filter: (reaction, user) => user.id === mentionedUser.id,
  });

  messageCollector.on("collect", () => {
    hasResponded = true;
    messageCollector.stop();
    reactionCollector.stop();
  });

  reactionCollector.on("collect", () => {
    hasResponded = true;
    messageCollector.stop();
    reactionCollector.stop();
  });

  messageCollector.on("end", async () => {
    if (!hasResponded) {
      logger.info(
        `${mentionedUser.username} did not respond to ${message.author.username}.`
      );
      await message.reply(
        `${mentionedUser}, you haven't replied to ${message.author}'s message. Please pay 50k to ${message.author}.`
      );
    }
  });
};

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  logger.info(`Message received: ${content}`);
  await handleGreetings(message, content);
  await handleTaggedUser(message);

  if (content === "*call now") {
    await handleCallNow(message);
  } else if (content.startsWith(prefix)) {
    await handleCallRoom(message, content);
  } else if (message.mentions.has(client.user)) {
    const userMessage = message.content
      .replace(`<@!${client.user.id}>`, "")
      .trim();
    await handleGenerativeAI(message, userMessage);
  } else if (message.mentions.users.size > 0) {
    await handleMentionedUser(message);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  logger.info(`Interaction received: ${interaction.commandName}`);
  if (interaction.commandName === "hey") {
    await interaction.reply("hey");
  } else if (interaction.commandName === "ping") {
    await interaction.reply("pong");
  } else if (interaction.commandName === "in4") {
    const embed = new EmbedBuilder()
      .setTitle("Information")
      .setDescription("This is a user information")
      .setColor("Random")
      .addFields(
        { name: "Field 1", value: "This is field 1", inline: true },
        { name: "Field 2", value: "This is field 2", inline: true },
        { name: "Field 3", value: "This is field 3", inline: true }
      );
    await interaction.reply({ embeds: [embed] });
  } else if (interaction.isButton()) {
    await interaction.deferReply({ ephemeral: true });

    const role = interaction.guild.roles.cache.find(
      (role) => role.id === interaction.customId
    );
    if (!role) {
      logger.warn(`Role not found: ${interaction.customId}`);
      await interaction.reply({ content: "Role not found", ephemeral: true });
      return;
    }

    const hasRole = interaction.member.roles.cache.has(role.id);
    if (hasRole) {
      await interaction.member.roles.remove(role);
      await interaction.editReply(`${role} removed`);
    } else {
      await interaction.member.roles.add(role);
      await interaction.editReply(`${role} added`);
    }
  }
});

client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get("1113069128434077761");
  if (!channel) return;

  const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
  const welcomeMessage = welcomeMessages[randomIndex];

  logger.info(`New member joined: ${member.user.username}`);
  await channel.send(`${welcomeMessage} ${member}`);
  const sticker = "1279748620647661630";
  await channel.send({ stickers: [sticker] });
});


// TRANSACTION GOOGLE SHEETS HANDLER(FOR FINANCE MANAGEMENT)

const handleAddTransaction = async (message, details) => {
  try {
    // Helper function to send a reply
    const sendReply = (text) => message.reply(text);

    // Check if user requests help
    if (details.length === 1 && details[0].toLowerCase() === "help") {
      return sendReply(
        "📌 Hướng dẫn sử dụng lệnh *add:\n" +
        "👉 Định dạng: *add <Nội_dung> <Số tiền> <Hạng mục> <Hũ> [Tag]\n" +
        "👉 Ví dụ: *add Ăn_sáng 50k T NEC Ăn uống\n" +
        "👉 Hạng mục hợp lệ: " + VALID_HANG_MUC.join(", ") + "\n" +
        "👉 Hũ hợp lệ: " + VALID_HU.join(", ")
      );
    }

    // Validate command format
    if (details.length < 4) {
      return sendReply("⚠️ Lệnh ghi giao dịch không hợp lệ! Sử dụng *add help để xem cách sử dụng.");
    }

    const [noiDung, soTien, hangMuc, hu, ...tags] = details;

    // Validate amount
    const amount = parseInt(soTien.replace("k", "000"));
    if (isNaN(amount)) {
      return sendReply("⚠️ Số tiền phải là số hợp lệ! Ví dụ: 100k hoặc 50000.");
    }

    // Validate category and jar
    if (!VALID_HANG_MUC.includes(hangMuc) || !VALID_HU.includes(hu)) {
      return sendReply("⚠️ Hạng mục hoặc hũ không hợp lệ!");
    }

    // Load the sheet
    const sheet = doc.sheetsByTitle["BẢNG GHI"];
    if (!sheet) {
      return sendReply("⚠️ Không tìm thấy sheet BẢNG GHI!");
    }

    await sheet.loadCells("H4:M100");

    const currentMonth = new Date().getMonth() + 1; // Get current month (1-based index)
    let foundRow = null;

    // Search for an existing row
    for (let row = 4; row < 100; row++) {
      const monthCell = sheet.getCell(row, 7); // Column H (Month)
      const categoryCell = sheet.getCell(row, 10); // Column K (Category)
      const tagCell = sheet.getCell(row, 12); // Column M (Tags)

      if (
        monthCell.value === currentMonth &&
        categoryCell.value === hangMuc &&
        tagCell.value === tags.join(" ")
      ) {
        foundRow = row;
        break;
      }
    }

    if (foundRow !== null) {
      // Update existing row
      const amountCell = sheet.getCell(foundRow, 9); // Column J (Amount)
      amountCell.value = (amountCell.value || 0) + amount;
    } else {
      // Find a new row for insertion
      let newRow = 4;
      while (sheet.getCell(newRow, 7).value) newRow++; // Check Column H

      sheet.getCell(newRow, 7).value = currentMonth; // Column H (Month)
      sheet.getCell(newRow, 8).value = noiDung; // Column I (Description)
      sheet.getCell(newRow, 9).value = amount; // Column J (Amount)
      sheet.getCell(newRow, 10).value = hangMuc; // Column K (Category)
      sheet.getCell(newRow, 11).value = hu; // Column L (Jar)
      sheet.getCell(newRow, 12).value = tags.join(" "); // Column M (Tags)
    }

    await sheet.saveUpdatedCells(); // Save changes to Google Sheets

    return sendReply(`✅ Ghi nhận giao dịch: **${noiDung}** - **${amount.toLocaleString()} VND** vào **${hu}**.`);
  } catch (error) {
    logger.error(`Error in handleAddTransaction: ${error.message}`);
    return message.reply("⚠️ Lỗi hệ thống! Không thể ghi giao dịch vào Google Sheets.");
  }
};

const handleStatistic = async (message) => {
  try {
    const sheet = doc.sheetsByTitle["BẢNG GHI"];
    if (!sheet) {
      return message.reply("⚠️ Không tìm thấy sheet BẢNG GHI!");
    }

    await sheet.loadCells("H4:M100"); // Tải vùng dữ liệu cần thiết

    const currentMonth = new Date().toLocaleDateString("en-US", { month: "2-digit" }).replace(/^0/, "");
    const numericMonth = parseInt(currentMonth, 10);

    let categoryStats = {}; // Thống kê chi tiêu C
    let incomeStats = {};   // Thống kê thu nhập T

    let totalChiTieu = 0;
    let totalThuNhap = 0;

    for (let row = 4; row < 100; row++) {
      const monthCell = sheet.getCell(row, 7); // Cột H (Tháng)
      const amountCell = sheet.getCell(row, 9); // Cột J (Số tiền)
      const categoryCell = sheet.getCell(row, 10); // Cột K (Hạng mục)
      const tagCell = sheet.getCell(row, 12); // Cột M (Tag#)

      if (monthCell.value === numericMonth) {
        const category = categoryCell.value || "Khác";
        const tag = tagCell.value || "Không có tag";
        const amount = parseInt(amountCell.value) || 0;

        if (category.startsWith("C")) { // Chi tiêu
          if (!categoryStats[category]) categoryStats[category] = {};
          if (!categoryStats[category][tag]) categoryStats[category][tag] = 0;
          categoryStats[category][tag] += amount;
          totalChiTieu += amount;
        } else if (category.startsWith("T")) { // Thu nhập
          if (!incomeStats[category]) incomeStats[category] = {};
          if (!incomeStats[category][tag]) incomeStats[category][tag] = 0;
          incomeStats[category][tag] += amount;
          totalThuNhap += amount;
        }
      }
    }

    if (totalChiTieu === 0 && totalThuNhap === 0) {
      return message.reply(`📊 Không có dữ liệu giao dịch cho tháng ${numericMonth}.`);
    }

    let report = `📊 **Thống kê tháng ${numericMonth}**\n\n`;

    // 📌 Hiển thị chi tiêu C
    if (totalChiTieu > 0) {
      report += `💰 **Tổng chi tiêu: ${totalChiTieu.toLocaleString()} VND**\n`;
      for (const [category, tags] of Object.entries(categoryStats)) {
        report += `🔸 **${category}**\n`;
        for (const [tag, amount] of Object.entries(tags)) {
          report += `   📍 ${tag}: ${amount.toLocaleString()} VND\n`;
        }
      }
      report += "\n";
    }

    // 📌 Hiển thị thu nhập T
    if (totalThuNhap > 0) {
      report += `💵 **Tổng thu nhập: ${totalThuNhap.toLocaleString()} VND**\n`;
      for (const [category, tags] of Object.entries(incomeStats)) {
        report += `🔹 **${category}**\n`;
        for (const [tag, amount] of Object.entries(tags)) {
          report += `   📍 ${tag}: ${amount.toLocaleString()} VND\n`;
        }
      }
    }

    return message.reply(report);
  } catch (error) {
    logger.error(`Error in handleStatistic: ${error.message}`);
    return message.reply("⚠️ Lỗi hệ thống! Không thể lấy dữ liệu thống kê.");
  }
};





client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content.startsWith("*add")) {
    const details = message.content.slice(4).trim().split(" ");
    await handleAddTransaction(message, details);
  }
  if (message.content === "*stat") {
    await handleStatistic(message);
  }
});

client.login(process.env.BOT_TOKEN);
