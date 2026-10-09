import logger from "../logger/logger.js";
import { formatFallbackBody, localizeTitle } from "../updates/display.js";
import { kindLabel } from "../updates/classify.js";
import { LIGHT_MODEL, lightConfig } from "./gemini.js";

function clip(text, max = 420) {
  const value = String(text || "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function needsTranslation(item) {
  const text = `${item.raw || ""} ${item.summary || ""}`;
  if (item.kind === "tier" || item.kind === "roster") return false;
  if (text.length < 80) return false;
  return /[A-Za-z]{4,}/.test(text) && !/[ăâđêôơưáàảãạ]/i.test(text);
}

export function createSummarizer(genAI, modelName = LIGHT_MODEL) {
  const model = genAI.getGenerativeModel({ model: modelName });

  async function generate(prompt, fallback) {
    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: lightConfig({ maxOutputTokens: 180 }),
      });
      const text = result.response.text()?.trim();
      return text || fallback;
    } catch (err) {
      logger.warn(`Gemini summarize failed: ${err.message}`);
      return fallback;
    }
  }

  async function summarizeItem(game, item) {
    const fallback = formatFallbackBody(item);
    if (!needsTranslation(item)) return fallback;

    const prompt = [
      "Dịch/tóm tắt sang tiếng Việt. 3 dòng, mỗi dòng bắt đầu bằng •",
      "Giữ tên riêng. Không thêm giải thích.",
      `${game.shortName || game.name}: ${localizeTitle(item)}`,
      clip(item.raw || item.summary, 420),
    ].join("\n");
    return generate(prompt, fallback);
  }

  async function summarizeDigest(game, items) {
    if (!items.length) {
      return `Hôm nay chưa có tin đáng chú ý cho ${game.shortName || game.name}.`;
    }

    const fallback = items
      .slice(0, 5)
      .map((item) => `• ${kindLabel(item.kind)}: ${localizeTitle(item)}`)
      .join("\n");

    const list = items
      .slice(0, 4)
      .map((item, index) => `${index + 1}. ${localizeTitle(item)} — ${clip(item.raw || item.summary, 120)}`)
      .join("\n");

    const prompt = [
      "Báo cáo ngày tiếng Việt. 4 dòng, mỗi dòng •",
      game.shortName || game.name,
      list,
    ].join("\n");

    return generate(prompt, fallback);
  }

  return { summarizeItem, summarizeDigest };
}

export default createSummarizer;
