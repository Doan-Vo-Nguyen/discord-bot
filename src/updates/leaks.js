import { clip, fetchJson, fetchMarkdown, makeId, safeSource } from "./sources.js";
import { GAMES } from "./config.js";

const LEAK_RE =
  /\b(3\.[89]|4\.\d|4\.x|lily|tune break|fractus|unison|banner|resonator|phiên bản|版本)\b/i;
const SKIP_RE = /cicf|agf|views|subscribers|download telegram|media is too big/i;

function cleanLeakLine(line) {
  return String(line)
    .replace(/[_*`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toViLeak(line) {
  if (/tune break/i.test(line) && /4\.0/.test(line)) {
    return "4.0 vẫn còn cơ chế chiến đấu mới kiểu Tune Break.";
  }
  if (/fractus|残星会/i.test(line)) {
    return "Cốt truyện 4.x có thể xoay quanh tàn tinh hội (Fractus).";
  }
  if (/^wuthering wave 3\.8$/i.test(line)) {
    return "Seele đang đăng cụm tin liên quan bản 3.8.";
  }
  if (/鸿蒙|hdr|光追/i.test(line)) {
    return "3.7 bản HarmonyOS: sau này sẽ thêm ray tracing và HDR.";
  }
  return line;
}

function extractSeeleLeaks(markdown) {
  const lines = String(markdown || "")
    .split(/\n+/)
    .map(cleanLeakLine)
    .filter((line) => line.length > 24 && line.length < 280)
    .filter((line) => LEAK_RE.test(line) && !SKIP_RE.test(line))
    .map(toViLeak);

  const unique = [];
  for (const line of lines) {
    if (unique.some((seen) => seen.slice(0, 40) === line.slice(0, 40))) continue;
    unique.push(line);
    if (unique.length >= 6) break;
  }
  return unique;
}

async function fetchSeele() {
  const markdown = await fetchMarkdown("https://t.me/s/Seele_WW_Leak");
  const points = extractSeeleLeaks(markdown);
  if (!points.length) return [];
  return [
    {
      id: makeId("wuwa", "leak", "seele", points[0]),
      title: "Leak Seele · phiên bản tới",
      url: "https://t.me/s/Seele_WW_Leak",
      raw: points.join("\n"),
      summary: points.map((line) => `• ${line}`).join("\n"),
      category: "leak",
      tags: ["leak"],
      publishedAt: new Date(),
      source: "Seele Leaks",
      kind: "leak",
    },
  ];
}

async function fetchCommunityRecap() {
  const markdown = await fetchMarkdown(
    "https://www.mone.gg/blog/wuthering-waves/3-8-banner.html"
  );
  const lily = /Lily/i.test(markdown);
  if (!lily) return [];

  const raw = [
    "Tổng hợp cộng đồng về 3.8: Lily (Spectro, súng lục, 5 sao) được nhắc là nhân vật mới phase 1.",
    "Có tin nam resonator phase 2, rerun Sigrika/Hiyuki chưa chắc.",
    "3.8 dự kiến khoảng giữa tháng 11/2026. Kuro chưa xác nhận.",
  ].join(" ");

  return [
    {
      id: makeId("wuwa", "leak", "3.8", "lily"),
      title: "Tổng hợp leak 3.8 · Lily",
      url: "https://www.mone.gg/blog/wuthering-waves/3-8-banner.html",
      raw,
      summary: [
        "• 3.8: Lily — Spectro, súng lục, có thể hỗ trợ Unison.",
        "• Phase 2: nam resonator mới, thông tin còn mỏng.",
        "• Rerun và ngày ra mắt chỉ là dự đoán, chưa chính thức.",
      ].join("\n"),
      category: "leak",
      tags: ["leak"],
      publishedAt: new Date(),
      source: "Tổng hợp cộng đồng",
      kind: "leak",
    },
  ];
}

async function fetchNanokaCnHint(game) {
  const manifest = await fetchJson(game.nanokaManifestUrl);
  const entry = manifest?.[game.nanokaGameKey] || {};
  const live = entry.live || entry.latest;
  const latest = entry.latest;
  const cn = entry.cn;
  const ahead = [cn, latest].filter((ver) => ver && ver !== live);
  if (!ahead.length) return [];

  const raw = `Nanoka đang có data ${ahead.join(", ")}, bản live là ${live}. Có thể là datamine/CN sớm hơn.`;
  return [
    {
      id: makeId("wuwa", "leak", "nanoka", ahead.join(",")),
      title: `Nanoka · data sớm ${ahead.join(", ")}`,
      url: game.nanokaHomeUrl,
      raw,
      summary: `• ${raw}`,
      category: "leak",
      tags: ["leak"],
      publishedAt: null,
      source: "nanoka.cc",
      kind: "leak",
    },
  ];
}

export async function fetchWuwaLeaks() {
  const game = GAMES.wuwa;
  const lists = await Promise.all([
    safeSource("leak:seele", fetchSeele),
    safeSource("leak:recap", fetchCommunityRecap),
    safeSource("leak:nanoka", () => fetchNanokaCnHint(game)),
  ]);
  return lists.flat().map((item) => ({
    ...item,
    viSummary: [
      "Tin leak / datamine, chưa phải thông báo chính thức của Kuro.",
      item.summary || clip(item.raw, 500),
    ].join("\n\n"),
  }));
}
