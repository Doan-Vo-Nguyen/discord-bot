import logger from "../logger/logger.js";
import { LIGHT_MODEL, lightConfig } from "../ai/gemini.js";

export function createChatHandler(genAI, modelName = LIGHT_MODEL) {
  const model = genAI.getGenerativeModel({ model: modelName });

  async function handleGenerativeAI(message, userMessage) {
    try {
      logger.info(`Generating AI response for message: ${userMessage}`);

      const generationConfig = lightConfig({ maxOutputTokens: 256, temperature: 0.6 });

      const parts = [{ text: `Trả lời tiếng Việt, tối đa 4 câu.\n${userMessage}` }];
      const result = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig,
      });
      const reply = result.response.text();

      if (reply.length > 2000) {
        const replyArray = reply.match(/[\s\S]{1,2000}/g);
        for (const replyPart of replyArray) {
          // eslint-disable-next-line no-await-in-loop
          await message.reply(replyPart);
        }
      } else {
        await message.reply(reply);
      }
    } catch (error) {
      logger.error(`Error in handleGenerativeAI: ${error.message}`);
      await message.reply("Không trả lời được lúc này, thử lại sau.");
    }
  }

  return { handleGenerativeAI };
}

export default createChatHandler;


