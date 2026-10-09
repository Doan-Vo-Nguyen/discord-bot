import logger from "../logger/logger.js";

export const greetings = ["hello", "hi", "xin chào", "chào", "chao"];
export const byeMessages = ["bye", "good bye", "tạm biệt", "tam biet"];

export async function handleGreet(message) {
  logger.info("Greeting intent");
  return message.reply("Hello");
}

export async function handleGoodbye(message) {
  logger.info("Goodbye intent");
  return message.reply("Bye");
}

export default { handleGreet, handleGoodbye };


