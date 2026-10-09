export const GAMES = {
  cs2: {
    key: "cs2",
    name: "Counter-Strike 2",
    shortName: "CS2",
    channelId: process.env.CS2_CHANNEL_ID || "1345200697154469928",
    color: 0xde9b35,
    steamAppId: 730,
    officialUpdatesUrl: "https://www.counter-strike.net/news/updates",
    sources: ["cs2-official", "steam"],
  },
  wuwa: {
    key: "wuwa",
    name: "Wuthering Waves",
    shortName: "Wuthering Waves",
    channelId: process.env.WUWA_CHANNEL_ID || "1345200728976658462",
    color: 0x4cc9f0,
    steamAppId: 3513350,
    launcherUrl:
      "https://prod-alicdn-gamestarter.kurogame.com/launcher/50004_obOHXFrFanqsaIEOmuKroCcbZkQRBC7c/G153/information/en.json",
    officialNewsUrl: "https://wutheringwaves.kurogames.com/en/main/news",
    prydwenTierUrl: "https://www.prydwen.gg/wuthering-waves/tier-list",
    prydwenTeamUrl: "https://www.prydwen.gg/wuthering-waves/team-tier-list",
    nanokaHomeUrl: "https://ww.nanoka.cc/",
    nanokaManifestUrl: "https://static.nanoka.cc/manifest.json",
    nanokaGameKey: "ww",
    sources: ["wuwa-launcher", "prydwen", "nanoka", "steam"],
  },
  pgr: {
    key: "pgr",
    name: "Punishing: Gray Raven",
    shortName: "PGR",
    channelId: process.env.PGR_CHANNEL_ID || "1556510251866394634",
    color: 0xc41e3a,
    steamAppId: 4125930,
    officialNewsUrl: "https://pgr.kurogame.net/news",
    sources: ["pgr-official", "steam"],
  },
};

export const FEEDS = {
  "game-chung": {
    key: "game-chung",
    name: "Game chung",
    shortName: "Game",
    channelId: process.env.GAME_CHUNG_CHANNEL_ID || "1556560071771684874",
    color: 0x57f287,
    kind: "catalog",
    catalog: "steam",
  },
  "xu-huong": {
    key: "xu-huong",
    name: "Xu hướng AI",
    shortName: "AI",
    channelId: process.env.AI_TREND_CHANNEL_ID || "1556560075441709097",
    color: 0x5865f2,
    kind: "catalog",
    catalog: "ai-trend",
  },
  "local-vs-cloud": {
    key: "local-vs-cloud",
    name: "Local vs Cloud",
    shortName: "AI Local",
    channelId: process.env.AI_LOCAL_CHANNEL_ID || "1556560077677138010",
    color: 0x57f287,
    kind: "catalog",
    catalog: "ai-local",
  },
  "gia-ca": {
    key: "gia-ca",
    name: "Giá AI",
    shortName: "AI Giá",
    channelId: process.env.AI_PRICE_CHANNEL_ID || "1556560079828947054",
    color: 0xfee75c,
    kind: "catalog",
    catalog: "ai-price",
  },
  "noi-bat": {
    key: "noi-bat",
    name: "AI nổi bật",
    shortName: "AI Hot",
    channelId: process.env.AI_HOT_CHANNEL_ID || "1556560081561329794",
    color: 0xeb459e,
    kind: "catalog",
    catalog: "ai-hot",
  },
  agentic: {
    key: "agentic",
    name: "Agentic",
    shortName: "Agent",
    channelId: process.env.AI_AGENTIC_CHANNEL_ID || "1556562928746889348",
    color: 0x9b59b6,
    kind: "catalog",
    catalog: "agentic",
  },
  prompt: {
    key: "prompt",
    name: "Prompt",
    shortName: "Prompt",
    channelId: process.env.AI_PROMPT_CHANNEL_ID || "1556562930827268176",
    color: 0x1abc9c,
    kind: "catalog",
    catalog: "prompt",
  },
  "dung-ai": {
    key: "dung-ai",
    name: "Dùng AI",
    shortName: "Dùng AI",
    channelId: process.env.AI_USE_CHANNEL_ID || "1556562932689797172",
    color: 0x2ecc71,
    kind: "catalog",
    catalog: "dung-ai",
  },
  "giao-duc": {
    key: "giao-duc",
    name: "Giáo dục",
    shortName: "Giáo dục",
    channelId: process.env.AI_EDU_CHANNEL_ID || "1556562934572785664",
    color: 0xe67e22,
    kind: "catalog",
    catalog: "giao-duc",
  },
  "ban-phim": {
    key: "ban-phim",
    name: "Bàn phím",
    shortName: "Bàn phím",
    channelId: process.env.KB_CHANNEL_ID || "1556560084895539230",
    color: 0x95a5a6,
    kind: "catalog",
    catalog: "tiki",
    productIds: [74907707, 77121735, 3014007, 50330205],
  },
  chuot: {
    key: "chuot",
    name: "Chuột",
    shortName: "Chuột",
    channelId: process.env.MOUSE_CHANNEL_ID || "1556560087106199614",
    color: 0x3498db,
    kind: "catalog",
    catalog: "tiki",
    productIds: [56196502, 202793622, 201308561],
  },
  "man-hinh": {
    key: "man-hinh",
    name: "Màn hình",
    shortName: "Màn hình",
    channelId: process.env.MONITOR_CHANNEL_ID || "1556560092667580416",
    color: 0x9b59b6,
    kind: "catalog",
    catalog: "tiki",
    productIds: [279396456, 279396460, 250479259],
  },
  "ssd-ram": {
    key: "ssd-ram",
    name: "SSD & RAM",
    shortName: "SSD/RAM",
    channelId: process.env.SSD_RAM_CHANNEL_ID || "1556560094517534810",
    color: 0xe67e22,
    kind: "catalog",
    catalog: "tiki",
    productIds: [258752641, 84190080],
  },
  "pc-build": {
    key: "pc-build",
    name: "PC build",
    shortName: "PC",
    channelId: process.env.PC_BUILD_CHANNEL_ID || "1556560096463556668",
    color: 0xe74c3c,
    kind: "catalog",
    catalog: "tiki",
    productIds: [275599171, 270958775, 275599112],
  },
};

export const UPDATE_POLL_MS = Number(process.env.UPDATE_POLL_MS || 15 * 60 * 1000);
export const DIGEST_HOUR = Number(process.env.DIGEST_HOUR || 20);
export const STORE_PATH = process.env.UPDATE_STORE_PATH || "data/game-updates.json";

export function getTopic(key) {
  const id = String(key || "").toLowerCase();
  return GAMES[id] || FEEDS[id] || null;
}

export function getGameByKey(key) {
  return getTopic(key);
}

export function getGameByChannelId(channelId) {
  return [...Object.values(GAMES), ...Object.values(FEEDS)].find((item) => item.channelId === channelId) || null;
}

export function listGameKeys() {
  return Object.keys(GAMES);
}

export function listFeedKeys() {
  return Object.keys(FEEDS);
}

export function listAllTopicKeys() {
  return [...listGameKeys(), ...listFeedKeys()];
}
