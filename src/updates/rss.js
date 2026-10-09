import { clip, fetchMarkdown, http, makeId, parseFlexibleDate, safeSource, stripHtml } from "./sources.js";

function decodeXml(text = "") {
  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function parseFeed(xml) {
  const chunks = String(xml).split(/<(?:item|entry)[\s>]/i).slice(1);
  return chunks.slice(0, 12).map((chunk) => {
    const title = stripHtml(tagValue(chunk, "title"));
    const url =
      chunk.match(/<link[^>]+href="([^"]+)"/i)?.[1] ||
      tagValue(chunk, "link") ||
      tagValue(chunk, "guid");
    const raw = stripHtml(tagValue(chunk, "description") || tagValue(chunk, "summary") || title);
    const publishedAt = parseFlexibleDate(
      tagValue(chunk, "pubDate") || tagValue(chunk, "updated") || tagValue(chunk, "published")
    );
    const source = stripHtml(tagValue(chunk, "source")) || "RSS";
    return { title, url, raw, publishedAt, source };
  }).filter((item) => item.title);
}

async function fetchFeedXml(url) {
  try {
    const { data } = await http.get(url, { timeout: 8000 });
    return String(data || "");
  } catch {
    return fetchMarkdown(url);
  }
}

export async function fetchRssTopic(topic) {
  const lists = await Promise.all(
    (topic.feeds || []).map((url) =>
      safeSource(`rss:${topic.key}`, async () => {
        const items = parseFeed(await fetchFeedXml(url));
        return items.map((item) => ({
          id: makeId(topic.key, item.url || item.title),
          title: item.title,
          url: item.url,
          raw: item.raw,
          summary: clip(item.raw, 280),
          category: "news",
          tags: ["news"],
          publishedAt: item.publishedAt,
          source: item.source || topic.shortName,
          kind: topic.kind || "news",
        }));
      })
    )
  );

  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item.id) || seen.has(item.title)) continue;
      seen.add(item.id);
      seen.add(item.title);
      merged.push(item);
    }
  }
  return merged.slice(0, 8);
}
