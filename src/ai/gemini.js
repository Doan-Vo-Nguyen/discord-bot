export const LIGHT_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

export function lightConfig({ maxOutputTokens = 180, temperature = 0.2 } = {}) {
  return {
    temperature,
    topK: 1,
    topP: 0.8,
    maxOutputTokens,
    thinkingConfig: { thinkingBudget: 0 },
  };
}
