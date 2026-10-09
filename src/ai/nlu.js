import logger from "../logger/logger.js";
import { LIGHT_MODEL, lightConfig } from "./gemini.js";

// Lightweight JSON extractor: trims code fences and fixes minor trailing commas
function safeJsonParse(text) {
  try {
    const cleaned = text
      .trim()
      .replace(/^```(json)?/i, "")
      .replace(/```$/i, "")
      .replace(/[\u0000-\u001F]+/g, "");
    return JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
}

// Normalize entities for downstream handlers
function normalizeEntities(entities) {
  if (!entities) return {};
  const result = { ...entities };
  if (typeof result.so_tien === "string") {
    result.so_tien = Number.parseInt(result.so_tien.replace(/k/i, "000"), 10);
  }
  if (typeof result.tags === "string") {
    result.tags = result.tags.split(/[,\s]+/).filter(Boolean);
  }
  return result;
}

export function createNlu(genAI, modelName = LIGHT_MODEL) {
  const model = genAI.getGenerativeModel({ model: modelName });

  // Supported intents:
  // - greet, goodbye
  // - get_empty_room
  // - find_room_by_name(room_name)
  // - add_transaction(noi_dung, so_tien, hang_muc, hu?, tags[]?)
  // - show_statistics
  // - chat (fallback small talk/Q&A)
  // - finance_last_spend, finance_balance
  const systemInstruction = [
    "Bạn là bộ hiểu ý định (NLU) tiếng Việt cho bot Discord.",
    "Hãy đọc câu người dùng và TRẢ VỀ JSON DUY NHẤT, không thêm lời giải thích.",
    "Cấu trúc JSON: { intent: string, entities: object, confidence: number }",
    "intent một trong: greet, goodbye, get_empty_room, find_room_by_name, add_transaction, show_statistics, finance_last_spend, finance_balance, chat",
    "entities theo intent:",
    "- find_room_by_name: { room_name: string }",
    "- add_transaction: { noi_dung: string, so_tien: string|number, hang_muc: 'T'|'C', hu?: string, tags?: string|string[] }",
    "Các ví dụ: \n",
    "'*call now' => { intent: 'get_empty_room', entities: {}, confidence: 0.95 }",
    "'*call room Phong Hop 1' => { intent: 'find_room_by_name', entities: { room_name: 'Phong Hop 1' }, confidence: 0.95 }",
    "'Thêm giao dịch Ăn_sáng 50k C NEC Ăn_uống' => { intent: 'add_transaction', entities: { noi_dung: 'Ăn_sáng', so_tien: '50k', hang_muc: 'C', hu: 'NEC', tags: 'Ăn_uống' }, confidence: 0.9 }",
    "'Thống kê tháng này' => { intent: 'show_statistics', entities: {}, confidence: 0.9 }",
    "'lần cuối tôi chi tiền khi nào' => { intent: 'finance_last_spend', entities: {}, confidence: 0.9 }",
    "'còn lại bao nhiêu tiền' => { intent: 'finance_balance', entities: {}, confidence: 0.85 }",
    "'chào bạn' => { intent: 'greet', entities: {}, confidence: 0.9 }",
    "Nếu không rõ, dùng intent 'chat' với confidence thấp hơn."
  ].join("\n");

  async function extractIntent(userText) {
    try {
      const prompt = [
        systemInstruction,
        "\nChỉ trả về JSON hợp lệ duy nhất.",
        `Người dùng: ${userText}`
      ].join("\n\n");

      const generationConfig = lightConfig({ maxOutputTokens: 120 });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      });
      const text = result.response.text();
      let json = safeJsonParse(text);

      if (!json || typeof json.intent !== "string") {
        // Retry with stronger formatting instruction
        const retry = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: `${prompt}\n\nCHỈ IN RA JSON: {"intent":...,"entities":...,"confidence":...}` }] }],
          generationConfig,
        });
        json = safeJsonParse(retry.response.text());
      }

      if (!json || typeof json.intent !== "string") {
        return { intent: "chat", entities: {}, confidence: 0.3 };
      }

      return {
        intent: String(json.intent),
        entities: normalizeEntities(json.entities || {}),
        confidence: typeof json.confidence === "number" ? json.confidence : 0.7,
      };
    } catch (err) {
      logger.error(`NLU extractIntent error: ${err.message}`);
      return { intent: "chat", entities: {}, confidence: 0.2 };
    }
  }

  return { extractIntent };
}

export default createNlu;


