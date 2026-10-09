import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client, IntentsBitField } from "discord.js";
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import logger from "./logger/logger.js";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import express from "express";
import createNlu from "./ai/nlu.js";
import { createIntentRouter } from "./router/intentRouter.js";
import * as greetingsHandler from "./handlers/greetings.js";
import * as roomHandler from "./handlers/room.js";
import createTransactionHandler from "./handlers/transactions.js";
import createStatisticHandler from "./handlers/statistics.js";
import createChatHandler from "./handlers/chat.js";
import createFinanceHandler, { FINANCE_CHANNEL_ID } from "./handlers/finance.js";
import createUpdateHandler from "./handlers/updates.js";
import { startUpdateScheduler } from "./updates/scheduler.js";
import createSummarizer from "./ai/summarizer.js";
import { LIGHT_MODEL } from "./ai/gemini.js";

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildVoiceStates,
  ],
});

const app = express();
const PORT = Number(process.env.PORT) || 10000;
app.get(["/", "/health"], (_req, res) => {
  res.status(200).type("text/plain").send("ok");
});
const server = app.listen(PORT, "0.0.0.0", () => {
  logger.info(`Server is listening on 0.0.0.0:${PORT}`);
});
server.on("error", (err) => {
  logger.error(`HTTP server error: ${err.message}`);
});

function loadGoogleCreds() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const fileName = fs.readdirSync(dir).find((name) => /^gen-lang-client-.*\.json$/.test(name));
  if (fileName) {
    return JSON.parse(fs.readFileSync(path.join(dir, fileName), "utf8"));
  }
  return null;
}

async function openSpreadsheet() {
  const creds = loadGoogleCreds();
  if (!process.env.SPREADSHEET_ID_GG || !creds?.client_email || !creds?.private_key) {
    return null;
  }
  const serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID_GG, serviceAccountAuth);
  await doc.loadInfo();
  return doc;
}

function sheetDisabledHandlers() {
  const reply = (message) =>
    message.reply("Lệnh tài chính đang tắt vì server chưa gắn Google Sheet.");
  return {
    transactionHandler: { handleAddTransaction: reply },
    statisticHandler: { handleStatistic: reply },
    financeHandler: {
      ensureChannel: () => true,
      getLastSpending: reply,
      getBalance: reply,
    },
  };
}

const discordToken = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;

try {
if (!discordToken) throw new Error("Thiếu DISCORD_TOKEN hoặc BOT_TOKEN");
if (!process.env.GEMINI_API_KEY) throw new Error("Thiếu GEMINI_API_KEY");

let doc = null;
try {
  doc = await openSpreadsheet();
} catch (err) {
  logger.error(`Không mở được Google Sheet: ${err.message}`);
}
if (!doc) {
  logger.warn("Không có Google Sheet. Chat và tin cập nhật vẫn chạy, lệnh tài chính thì tắt.");
}

const MODEL_NAME = LIGHT_MODEL;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const VALID_HANG_MUC = ["T", "C"];
const VALID_HU = ["NEC", "LTSS", "FFA", "EDU", "PLAYL", "GIVE"];
const SHEET_FINANCE_TITLE = process.env.GSHEET_FINANCE_TITLE || "FINANCE";

const disabledSheets = doc ? null : sheetDisabledHandlers();
const transactionHandler = disabledSheets
  ? disabledSheets.transactionHandler
  : createTransactionHandler(doc, {
      VALID_HANG_MUC,
      VALID_HU,
      sheetTitle: SHEET_FINANCE_TITLE,
    });
const statisticHandler = disabledSheets
  ? disabledSheets.statisticHandler
  : createStatisticHandler(doc, { sheetTitle: SHEET_FINANCE_TITLE });
const chatHandler = createChatHandler(genAI, MODEL_NAME);
const financeHandler = disabledSheets ? disabledSheets.financeHandler : createFinanceHandler(doc);
const nlu = createNlu(genAI, MODEL_NAME);
const summarizer = createSummarizer(genAI, MODEL_NAME);
const updateHandler = createUpdateHandler(summarizer);

const router = createIntentRouter(
  {
    greetHandler: greetingsHandler,
    roomHandler,
    transactionHandler,
    statisticHandler,
    financeHandler,
    chatHandler,
  },
  { doc }
);

function parseStarCommand(raw = "") {
  const text = String(raw)
    .trim()
    .replace(/^[＊*]+/, "*")
    .replace(/^[!/]/, "*")
    .toLowerCase();
  const match = text.match(/^\*(update|digest|tier|leak|help|add|stat|call)(?:\s+(.+))?$/);
  if (!match) return null;
  return { name: match[1], args: match[2] || "" };
}

function shouldUseNlu(message) {
  if (message.mentions.has(client.user)) return true;
  return message.channel.id === FINANCE_CHANNEL_ID;
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase().trim();
  logger.info(`Message received: ${content}`);

  try {
    const command = parseStarCommand(message.content);

    if (command?.name === "help") {
      await message.reply(
        [
          "Lệnh:",
          "`*update [cs2|wuwa|pgr]` — tin mới",
          "`*digest [cs2|wuwa|pgr]` — báo cáo ngày",
          "`*tier wuwa` — bảng xếp hạng",
          "`*leak wuwa` — tin leak",
          "`*add` / `*stat` — tài chính",
        ].join("\n")
      );
      return;
    }
    if (command?.name === "update") {
      await updateHandler.handleUpdateCommand(message, command.args);
      return;
    }
    if (command?.name === "digest") {
      await updateHandler.handleDigestCommand(message, command.args);
      return;
    }
    if (command?.name === "tier") {
      await updateHandler.handleTierCommand(message, command.args);
      return;
    }
    if (command?.name === "leak") {
      await updateHandler.handleLeakCommand(message, command.args);
      return;
    }
    if (command?.name === "add") {
      await transactionHandler.handleAddTransaction(message, command.args.split(/\s+/));
      return;
    }
    if (command?.name === "stat") {
      await statisticHandler.handleStatistic(message);
      return;
    }
    if (command?.name === "call" && command.args === "now") {
      await roomHandler.handleCallNow(message);
      return;
    }
    if (content.startsWith("*call room ")) {
      await roomHandler.handleCallRoom(message, content.slice("*call room ".length));
      return;
    }
    if (content.startsWith("*")) return;

    if (shouldUseNlu(message)) {
      const userMessage = message.content.replace(`<@${client.user.id}>`, "").replace(`<@!${client.user.id}>`, "").trim();
      const nluResult = await nlu.extractIntent(userMessage || message.content);
      await router.route(message, nluResult);
    }
  } catch (err) {
    logger.error(`Lỗi xử lý tin nhắn: ${err.message}`);
    await message.reply("Lệnh gặp lỗi, thử lại giúp mình.").catch(() => {});
  }
});

startUpdateScheduler(client, summarizer);
client.login(discordToken).catch((err) => {
  logger.error(`Không đăng nhập Discord được: ${err.message}`);
});
} catch (err) {
  logger.error(`Không khởi động bot được: ${err.message}`);
}
