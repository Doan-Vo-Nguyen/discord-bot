import { kindLabel } from "./classify.js";
import { parseFlexibleDate } from "./sources.js";

const SOURCE_LABELS = {
  Steam: "Steam",
  "Official Launcher": "Launcher chính thức",
  "counter-strike.net": "Trang chính thức",
  "Prydwen.gg": "Prydwen",
  "nanoka.cc": "Nanoka",
  "pgr.kurogame.net": "Trang chính thức",
  "Seele Leaks": "Seele Leaks",
  "Tổng hợp cộng đồng": "Tổng hợp cộng đồng",
};

const SECTION_LABELS = {
  misc: "Khác",
  gameplay: "Lối chơi",
  rush: "Chế độ Rush",
  maps: "Bản đồ",
  weapons: "Vũ khí",
  ui: "Giao diện",
  crosshair: "Tâm ngắm",
  audio: "Âm thanh",
};

const TITLE_RULES = [
  [
    /counter-strike 2 update\s*[•·-]?\s*(.*)/i,
    (item, date) => {
      const parsed = parseFlexibleDate(date) || item.publishedAt;
      const label = formatDateVi(parsed);
      return `Cập nhật CS2${label ? ` · ${label}` : ""}`;
    },
  ],
  [/version\s+"([^"]+)"\s+update note/i, (_, name) => `Ghi chú cập nhật · ${name}`],
  [/^v(\d+\.\d+)\b/i, (_, ver) => `Cập nhật phiên bản ${ver}`],
  [/prydwen tier list\s*[•·]?\s*(.*)/i, (_, patch) => `Bảng xếp hạng Prydwen${patch ? ` · ${viPatch(patch)}` : ""}`],
  [/nanoka db\s*[•·]?\s*(.*)/i, (_, rest) => `Dữ liệu Nanoka${rest ? ` · ${viPatch(rest)}` : ""}`],
  [/leak seele/i, () => "Tin leak Seele · phiên bản tới"],
  [/tổng hợp leak/i, () => "Tổng hợp leak 3.8"],
  [/profile reveal/i, () => "Hé lộ hồ sơ nhân vật"],
  [/featured resonator\/weapon convene/i, () => "Banner nhân vật và vũ khí"],
  [/featured resonator convene/i, () => "Banner nhân vật"],
  [/upcoming client update/i, () => "Sắp có bản cập nhật client"],
  [/^about\s+(.+)/i, (_, rest) => `Thông báo: ${rest}`],
];

function viPatch(text = "") {
  const cleaned = String(text)
    .replace(/wuwa\s*/i, "")
    .replace(/patch/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^\d/.test(cleaned)) return `Bản ${cleaned}`;
  return cleaned;
}

export function formatDateVi(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function sourceLabel(source) {
  return SOURCE_LABELS[source] || source || "Chính thức";
}

export function gameLabel(game) {
  return game.shortName || game.name;
}

export function localizeTitle(item) {
  const title = String(item.title || "Cập nhật").trim();
  for (const [pattern, build] of TITLE_RULES) {
    const match = title.match(pattern);
    if (!match) continue;
    const next = build(item, ...match.slice(1));
    if (next) return next.slice(0, 256);
  }

  if (/^\[[^\]]+\]/.test(title)) {
    return title.replace(/^\[([^\]]+)\]\s*/, "").slice(0, 256);
  }

  return title.slice(0, 256);
}

function looksVietnamese(text) {
  return /[ăâđêôơưáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵ]/i.test(text);
}

function cleanLine(line) {
  return String(line)
    .replace(/^[-*•]+\s*/, "")
    .replace(/^\[([^\]]+)\]\s*/, (_, tag) => {
      const mapped = SECTION_LABELS[tag.toLowerCase()];
      return mapped ? `${mapped}: ` : "";
    })
    .replace(/^Fixed\b/i, "Sửa")
    .replace(/^Added\b/i, "Thêm")
    .replace(/^Updated\b/i, "Cập nhật")
    .replace(/^Improved\b/i, "Cải thiện")
    .replace(/^Enabled\b/i, "Bật")
    .replace(/^Allowed\b/i, "Cho phép")
    .replace(/^Changed\b/i, "Điều chỉnh")
    .replace(/^Removed\b/i, "Gỡ")
    .replace(/\bNanoka database WuWa\b/i, "Dữ liệu Nanoka")
    .replace(/\bResonator mới\b/i, "Nhân vật mới")
    .replace(/\bWeapon mới\b/i, "Vũ khí mới")
    .replace(/\bTeam T0\b/i, "Đội hình T0")
    .replace(/\bServer maintenance\b/i, "Bảo trì máy chủ")
    .replace(/\bCompensation\b/i, "Đền bù")
    .replace(/\s+/g, " ")
    .trim();
}

function toBullets(text, max = 5) {
  const lines = String(text || "")
    .split(/\n|(?<=\.)\s+(?=[A-Z\[])/)
    .map(cleanLine)
    .filter((line) => line.length > 8 && !/^https?:/i.test(line));

  const unique = [];
  for (const line of lines) {
    if (unique.some((seen) => seen.slice(0, 40) === line.slice(0, 40))) continue;
    unique.push(line.length > 140 ? `${line.slice(0, 139)}…` : line);
    if (unique.length >= max) break;
  }
  return unique;
}

export function formatFallbackBody(item) {
  const points = toBullets(item.raw || item.summary || item.title);
  if (!points.length) {
    return `Chưa có tóm tắt cho tin này.`;
  }
  return points.map((line) => `• ${line}`).join("\n");
}

export function pickDisplayBody(item) {
  const generated = String(item.viSummary || "").trim();
  if (generated && looksVietnamese(generated)) {
    return generated
      .replace(/^#+\s*/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .slice(0, 1200);
  }
  return formatFallbackBody(item);
}

export function formatMetaLine(item) {
  const parts = [kindLabel(item.kind), sourceLabel(item.source), formatDateVi(item.publishedAt)].filter(
    Boolean
  );
  return parts.join(" · ");
}

export function clipText(text, max = 3500) {
  const value = String(text || "").trim();
  if (!value) return "Chưa có nội dung.";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
