const PATCH_RE =
  /\b(patch ?notes?|hotfix|changelog|update notes?|version update|client update|bug ?fix|release notes|counter-strike 2 update)\b/i;
const MAINT_RE = /\b(maintenance|server maintenance|bảo trì|downtime)\b/i;
const EVENT_RE = /\b(convene|banner|event|featured|gacha|festival|signin|check-?in)\b/i;
const TIER_RE = /\b(tier list|meta|t0|t0\.5)\b/i;
const ROSTER_RE = /\b(nhân vật mới|resonator mới|new character|new weapon|database)\b/i;

const KIND_LABELS = {
  patch: "Cập nhật",
  maintenance: "Bảo trì",
  event: "Sự kiện",
  notice: "Thông báo",
  tier: "Bảng xếp hạng",
  roster: "Dữ liệu game",
  leak: "Tin leak",
  news: "Tin tức",
};

export function classifyItem(item = {}) {
  if (item.kind && KIND_LABELS[item.kind]) return item.kind;

  const tags = (item.tags || []).map((tag) => String(tag).toLowerCase());
  const text = `${item.title || ""} ${item.raw || item.summary || ""} ${item.category || ""}`;

  if (tags.includes("patchnotes") || PATCH_RE.test(text)) return "patch";
  if (MAINT_RE.test(text)) return "maintenance";
  if (tags.includes("tier") || TIER_RE.test(text)) return "tier";
  if (tags.includes("roster") || ROSTER_RE.test(text)) return "roster";
  if (EVENT_RE.test(text)) return "event";
  if (item.category === "notice") return "notice";
  return "news";
}

export function kindLabel(kind) {
  return KIND_LABELS[kind] || KIND_LABELS.news;
}

export function isPriorityUpdate(item) {
  return item.kind === "patch" || item.kind === "maintenance";
}

export function isAutoPostUpdate(item) {
  return isPriorityUpdate(item) || item.kind === "tier" || item.kind === "roster";
}

export function filterItems(items, { patchOnly = false, autoOnly = false } = {}) {
  if (autoOnly) return items.filter(isAutoPostUpdate);
  if (!patchOnly) return items;
  return items.filter(isPriorityUpdate);
}

export function itemsFromLastHours(items, hours = 36) {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const recentDated = items.filter((item) => {
    if (!(item.publishedAt instanceof Date) || Number.isNaN(item.publishedAt.getTime())) return false;
    return item.publishedAt.getTime() >= cutoff;
  });
  if (recentDated.length) return recentDated.slice(0, 8);
  return items.slice(0, 6);
}
