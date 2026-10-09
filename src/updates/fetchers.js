import logger from "../logger/logger.js";
import { FEEDS, GAMES } from "./config.js";
import { fetchCatalogTopic } from "./catalogs.js";
import { classifyItem } from "./classify.js";
import {
  clip,
  fetchJson,
  fetchMarkdown,
  makeId,
  parseFlexibleDate,
  safeSource,
  stripHtml,
  unique,
} from "./sources.js";

function decorate(item) {
  return { ...item, kind: classifyItem(item) };
}

function normalizeTitle(title = "") {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mergeItems(lists) {
  const seenIds = new Set();
  const seenTitles = new Set();
  const merged = [];

  for (const list of lists) {
    for (const item of list) {
      if (seenIds.has(item.id)) continue;
      const titleKey = `${normalizeTitle(item.title)}::${item.publishedAt instanceof Date ? item.publishedAt.toISOString().slice(0, 10) : ""}`;
      if (item.title && seenTitles.has(titleKey)) continue;
      seenIds.add(item.id);
      if (item.title) seenTitles.add(titleKey);
      merged.push(item);
    }
  }
  return merged;
}

async function fetchSteamNews(game, appId = game.steamAppId) {
  const data = await fetchJson("https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/", {
    appid: appId,
    count: 10,
    maxlength: 1600,
  });

  return (data?.appnews?.newsitems || []).map((item) => {
    const raw = stripHtml(item.contents);
    return decorate({
      id: makeId(game.key, "steam", item.gid || item.url || item.title),
      title: item.title || "Untitled update",
      url: item.url,
      raw,
      summary: clip(raw),
      category: item.tags?.[0] || item.feedlabel || "news",
      tags: item.tags || [],
      publishedAt: item.date ? new Date(item.date * 1000) : null,
      source: "Steam",
    });
  });
}

async function fetchWuwaLauncher(game) {
  const data = await fetchJson(game.launcherUrl);
  const guidance = data?.guidance || {};
  const image = data?.slideshow?.[0]?.url || null;
  const sections = [
    ["news", guidance.news?.contents],
    ["notice", guidance.notice?.contents],
  ];

  const items = [];
  for (const [category, contents] of sections) {
    for (const entry of contents || []) {
      const title = entry.content || "Wuthering Waves update";
      const url = entry.jumpUrl || game.officialNewsUrl;
      items.push(
        decorate({
          id: makeId(game.key, "official", category, title, url),
          title,
          url,
          raw: `${title}. ${category} ${entry.time || ""}`.trim(),
          summary: clip(`${category === "notice" ? "Notice" : "News"} • ${entry.time || ""}`.trim()),
          category,
          tags: [category],
          publishedAt: parseFlexibleDate(entry.time),
          image,
          source: "Official Launcher",
        })
      );
    }
  }
  return items;
}

async function fetchCs2Official(game) {
  const markdown = await fetchMarkdown(game.officialUpdatesUrl);
  const month =
    "(January|February|March|April|May|June|July|August|September|October|November|December)";
  const header = new RegExp(`^${month}\\s+\\d{1,2},\\s+\\d{4}$`, "i");
  const lines = markdown.split(/\r?\n/);
  const items = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (header.test(trimmed)) {
      if (current) items.push(current);
      current = { date: trimmed, body: [] };
      continue;
    }
    if (current && trimmed) current.body.push(trimmed);
  }
  if (current) items.push(current);

  return items.slice(0, 6).map((entry) => {
    const publishedAt = parseFlexibleDate(entry.date);
    const raw = stripHtml(entry.body.join("\n"));
    return decorate({
      id: makeId(game.key, "official", entry.date),
      title: `Counter-Strike 2 Update • ${entry.date}`,
      url: game.officialUpdatesUrl,
      raw,
      summary: clip(raw, 500),
      category: "patch",
      tags: ["patchnotes"],
      publishedAt,
      source: "counter-strike.net",
      kind: "patch",
    });
  });
}

async function fetchPgrOfficial(game) {
  const markdown = await fetchMarkdown(game.officialNewsUrl);
  const matches = [
    ...markdown.matchAll(
      /\[([^\]]+?)\]\((https:\/\/pgr\.kurogame\.net\/news\/\d+)\)/g
    ),
  ];

  return matches.slice(0, 8).map((match) => {
    const label = stripHtml(match[1]);
    const dateMatch = label.match(/(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?)/);
    const title = dateMatch ? label.replace(dateMatch[0], "").trim() : label;
    const publishedAt = parseFlexibleDate(dateMatch?.[1]);
    return decorate({
      id: makeId(game.key, "official", match[2]),
      title,
      url: match[2],
      raw: label,
      summary: clip(label, 280),
      category: /update note/i.test(title) ? "patch" : "news",
      tags: /update note/i.test(title) ? ["patchnotes"] : ["news"],
      publishedAt,
      source: "pgr.kurogame.net",
    });
  });
}

function titleCaseSlug(slug) {
  return String(slug)
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function fetchPrydwenWuwa(game) {
  const tierMd = await fetchMarkdown(game.prydwenTierUrl);

  const updated =
    tierMd.match(/Last updated:\s*\*{0,2}([0-9]{1,2}\/[A-Za-z]+\/[0-9]{4})/i)?.[1] ||
    null;
  const patch =
    tierMd.match(/Tier List\s*\(([^)]+Patch)\)/i)?.[1] ||
    "current patch";

  const metaBlock = tierMd.split(/##### Current Meta/i)[1] || "";
  const t0Block = metaBlock.split(/T0\.5|##### Off-Meta/i)[0] || "";
  const t0Names = unique(
    [...t0Block.matchAll(/wuthering-waves\/characters\/([a-z0-9-]+)/gi)].map((match) =>
      titleCaseSlug(match[1])
    )
  ).slice(0, 12);

  const raw = [
    `Prydwen ${patch}, cập nhật ${updated || "gần đây"}.`,
    t0Names.length ? `T0 TOA: ${t0Names.join(", ")}.` : "Chưa đọc được danh sách T0.",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    decorate({
      id: makeId(game.key, "prydwen", updated || patch, t0Names.join("|")),
      title: `Prydwen Tier List • ${patch}`,
      url: game.prydwenTierUrl,
      raw,
      summary: clip(raw, 500),
      category: "tier",
      tags: ["tier"],
      publishedAt: parseFlexibleDate(updated),
      source: "Prydwen.gg",
      kind: "tier",
    }),
  ];
}

async function fetchNanokaWuwa(game) {
  const manifest = await fetchJson(game.nanokaManifestUrl);
  const entry = manifest?.[game.nanokaGameKey] || {};
  const version = entry.latest || entry.live;
  if (!version) return [];

  const newCharIds = entry.new?.character || [];
  const newWeaponIds = entry.new?.weapon || [];
  const [characters, weapons] = await Promise.all([
    fetchJson(`https://static.nanoka.cc/${game.nanokaGameKey}/${version}/character.json`),
    fetchJson(`https://static.nanoka.cc/${game.nanokaGameKey}/${version}/weapon.json`).catch(
      () => ({})
    ),
  ]);

  const charNames = newCharIds
    .map((id) => characters?.[id]?.en || characters?.[String(id)]?.en || `#${id}`)
    .filter(Boolean);
  const weaponNames = newWeaponIds
    .map((id) => weapons?.[id]?.en || weapons?.[String(id)]?.en || `#${id}`)
    .filter(Boolean);

  const raw = [
    `Nanoka database WuWa ${version}.`,
    charNames.length ? `Resonator mới: ${charNames.join(", ")}.` : "",
    weaponNames.length ? `Weapon mới: ${weaponNames.join(", ")}.` : "",
    `Nguồn: ${game.nanokaHomeUrl}`,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    decorate({
      id: makeId(
        game.key,
        "nanoka",
        version,
        newCharIds.join(","),
        newWeaponIds.join(",")
      ),
      title: `Nanoka DB • WuWa ${version}`,
      url: game.nanokaHomeUrl,
      raw,
      summary: clip(raw, 500),
      category: "roster",
      tags: ["roster"],
      publishedAt: null,
      source: "nanoka.cc",
      kind: "roster",
    }),
  ];
}

const SOURCE_FETCHERS = {
  steam: (game) => fetchSteamNews(game),
  "wuwa-launcher": (game) => fetchWuwaLauncher(game),
  "cs2-official": (game) => fetchCs2Official(game),
  "pgr-official": (game) => fetchPgrOfficial(game),
  prydwen: (game) => fetchPrydwenWuwa(game),
  nanoka: (game) => fetchNanokaWuwa(game),
};

export async function fetchGameUpdates(gameKey, { sources } = {}) {
  const game = GAMES[gameKey];
  if (!game) return [];

  const sourceKeys = sources || game.sources || [];
  const lists = await Promise.all(
    sourceKeys.map((source) => {
      const fetcher = SOURCE_FETCHERS[source];
      if (!fetcher) return [];
      return safeSource(`${gameKey}:${source}`, () => fetcher(game));
    })
  );

  const merged = mergeItems(lists);
  if (!merged.length) logger.warn(`No updates fetched for ${gameKey}`);
  return merged;
}

export async function fetchTopicUpdates(topicKey) {
  if (GAMES[topicKey]) return fetchGameUpdates(topicKey);
  if (FEEDS[topicKey]) return fetchCatalogTopic(FEEDS[topicKey]);
  return [];
}

export async function fetchAllUpdates() {
  const keys = [...Object.keys(GAMES), ...Object.keys(FEEDS)];
  const results = {};
  await Promise.all(
    keys.map(async (key) => {
      results[key] = await fetchTopicUpdates(key);
    })
  );
  return results;
}
