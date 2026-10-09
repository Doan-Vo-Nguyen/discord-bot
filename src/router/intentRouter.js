import logger from "../logger/logger.js";

export function createIntentRouter(handlers, context) {
  const {
    greetHandler,
    roomHandler,
    transactionHandler,
    statisticHandler,
    financeHandler,
    chatHandler,
  } = handlers;

  async function route(message, nluResult) {
    const { intent, entities, confidence } = nluResult;
    try {
      switch (intent) {
        case "greet":
          return greetHandler.handleGreet(message);
        case "goodbye":
          return greetHandler.handleGoodbye(message);
        case "get_empty_room":
          return roomHandler.handleCallNow(message);
        case "find_room_by_name":
          return roomHandler.handleCallRoom(message, entities.room_name || "");
        case "add_transaction":
          return transactionHandler.handleAddTransaction(message, entities);
        case "show_statistics":
          return statisticHandler.handleStatistic(message);
        case "finance_last_spend": {
          if (financeHandler.ensureChannel && !financeHandler.ensureChannel(message)) {
            return message.reply("🔒 Vui lòng dùng lệnh này trong kênh tài chính được chỉ định.");
          }
          return financeHandler.getLastSpending(message);
        }
        case "finance_balance": {
          if (financeHandler.ensureChannel && !financeHandler.ensureChannel(message)) {
            return message.reply("🔒 Vui lòng dùng lệnh này trong kênh tài chính được chỉ định.");
          }
          return financeHandler.getBalance(message);
        }
        case "chat":
        default:
          // Confidence gate: if very low, avoid spamming model
          if (confidence < 0.35) {
            return;
          }
          return chatHandler.handleGenerativeAI(message, message.content);
      }
    } catch (err) {
      logger.error(`Intent route error (${intent}): ${err.message}`);
      return message.reply("⚠️ Đã xảy ra lỗi khi xử lý yêu cầu.");
    }
  }

  return { route };
}

export default createIntentRouter;


