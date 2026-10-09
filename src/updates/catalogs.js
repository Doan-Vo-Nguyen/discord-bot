import { clip, fetchJson, http, makeId, safeSource } from "./sources.js";

function moneyUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  if (n === 0) return "free";
  return n < 0.1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;
}

function moneyVnd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${Math.round(n).toLocaleString("vi-VN")}đ`;
}

function catalogItem(topic, { title, headers = [], rows = [], picks, source, picksLabel }) {
  const fingerprint = `${title}\n${rows.map((row) => row.join("|")).join("\n")}`;
  return {
    id: makeId(topic.key, fingerprint.slice(0, 180)),
    title,
    raw: rows.map((row) => row.join(" · ")).join("\n"),
    summary: clip((picks || []).join(" · ") || fingerprint, 280),
    category: "catalog",
    tags: ["catalog"],
    publishedAt: new Date(),
    source: source || "POCA",
    kind: "catalog",
    headers,
    rows,
    picks: picks || [],
    picksLabel: picksLabel || "Ghi nhớ",
  };
}

const AI_WATCH = [
  { id: "google/gemini-2.5-flash-lite", provider: "Google", note: "Rẻ, đủ việc hàng ngày" },
  { id: "google/gemini-2.5-flash", provider: "Google", note: "Cân bằng giá/chất" },
  { id: "google/gemini-2.5-pro", provider: "Google", note: "Khỏe, đắt hơn Flash" },
  { id: "openai/gpt-5-nano", provider: "OpenAI", note: "Rẻ nhất nhà OpenAI" },
  { id: "openai/gpt-4o-mini", provider: "OpenAI", note: "Ổn định, rẻ" },
  { id: "openai/gpt-5-mini", provider: "OpenAI", note: "Mini đời mới" },
  { id: "openai/gpt-4o", provider: "OpenAI", note: "Đắt, chỉ việc khó" },
  { id: "anthropic/claude-haiku-4.5", provider: "Anthropic", note: "Nhanh, rẻ hơn Sonnet" },
  { id: "anthropic/claude-sonnet-4", provider: "Anthropic", note: "Code/viết tốt, đắt" },
  { id: "deepseek/deepseek-v4-flash", provider: "DeepSeek", note: "Input cực rẻ" },
  { id: "deepseek/deepseek-chat", provider: "DeepSeek", note: "V3 ngon bổ rẻ" },
  { id: "qwen/qwen3.7-flash", provider: "Qwen", note: "Rẻ, local-friendly" },
];

function toPerMillion(pricing = {}) {
  return {
    input: Number(pricing.prompt || 0) * 1e6,
    output: Number(pricing.completion || 0) * 1e6,
  };
}

async function fetchOpenRouterModels() {
  const data = await fetchJson("https://openrouter.ai/api/v1/models");
  return data?.data || [];
}

function pickModel(models, id) {
  return models.find((item) => item.id === id) || null;
}

async function buildAiRows() {
  const models = await fetchOpenRouterModels();
  return AI_WATCH.map((watch) => {
    const found = pickModel(models, watch.id);
    if (!found) return null;
    const price = toPerMillion(found.pricing);
    return {
      provider: watch.provider,
      model: found.name.replace(/^[^:]+:\s*/, ""),
      input: price.input,
      output: price.output,
      note: watch.note,
      id: found.id,
    };
  }).filter(Boolean);
}

export async function fetchAiPriceCatalog(topic) {
  const rows = await buildAiRows();
  if (!rows.length) return [];
  const cheapest = [...rows].sort((a, b) => a.input + a.output - (b.input + b.output)).slice(0, 3);
  return [
    catalogItem(topic, {
      title: "Bảng giá AI models",
      headers: ["Provider", "Model", "In/1M", "Out/1M", "Ghi chú"],
      rows: rows.map((row) => [row.provider, row.model, moneyUsd(row.input), moneyUsd(row.output), row.note]),
      picks: cheapest.map(
        (row) => `• **${row.model}** — ${moneyUsd(row.input)}/${moneyUsd(row.output)} — ${row.note}`
      ),
      picksLabel: "Ngon bổ rẻ",
      source: "Giá AI",
    }),
  ];
}

export async function fetchAiTrendCatalog(topic) {
  return [
    catalogItem(topic, {
      title: "Xu hướng AI đáng theo",
      headers: ["Xu hướng", "Đang xảy ra", "Áp dụng"],
      rows: [
        ["Agentic", "Model + tool + vòng lặp", "Chia planner / worker, giới hạn bước"],
        ["RAG tài liệu", "Hỏi đúng file/PDF của mình", "NotebookLM hoặc embed giáo trình"],
        ["Model nhỏ", "Flash/Lite/Qwen đủ việc hằng ngày", "Việc khó mới lên Pro"],
        ["AI giáo dục", "Gia sư, không làm hộ", "Hỏi lại + rubric + tự giải"],
        ["Local khi cần", "Offline, dữ liệu nhạy", "Ollama nếu đã có GPU"],
      ],
      picks: [
        "• Việc học/soạn bài: RAG tài liệu > chat chung chung",
        "• Agent chỉ đáng dùng khi có tool thật (quiz, file, code)",
        "• Xu hướng thực dụng: model nhỏ + quy trình rõ, không cần model lớn mọi câu",
      ],
      picksLabel: "Nên làm",
      source: "Xu hướng",
    }),
  ];
}

export async function fetchLocalVsCloudCatalog(topic) {
  return [
    catalogItem(topic, {
      title: "Local vs Cloud · chọn cho đúng việc",
      headers: ["Nhu cầu", "Local", "Cloud", "Nên chọn"],
      rows: [
        ["Chat / soạn bài", "Qwen 7B · 8GB VRAM", "Gemini Flash / Lite", "Cloud nếu chưa có GPU"],
        ["Code hàng ngày", "Qwen 14B · 12-16GB", "DeepSeek / Mini", "Cloud cho máy văn phòng"],
        ["Dữ liệu riêng / offline", "Ollama + LM Studio", "Không đưa file lên", "Local"],
        ["Ảnh / video nhiều", "12GB+ Flux/SD", "API tạo ảnh", "Local nếu làm thường xuyên"],
        ["Học trên máy yếu", "Không ép model lớn", "AI Studio / NotebookLM", "Cloud"],
      ],
      picks: [
        "• Local đáng khi đã có GPU 12GB+ hoặc cần offline",
        "• Máy 8GB: chỉ Qwen 7B, đừng ép 14B/70B",
        "• Giáo dục / PDF: NotebookLM trên cloud tiện hơn tự host RAG",
      ],
      picksLabel: "Cách chọn",
      source: "Local vs Cloud",
    }),
  ];
}

export async function fetchAiHotCatalog(topic) {
  return [
    catalogItem(topic, {
      title: "Tool / model nổi bật",
      headers: ["Model / tool", "Giỏi việc gì", "Không hợp"],
      rows: [
        ["Gemini Flash / Lite", "Chat, dịch, soạn bài nhanh", "Luận văn dài, code khó"],
        ["Gemini Pro", "Lý luận, đề khó", "Hỏi linh tinh mỗi câu"],
        ["DeepSeek / Qwen", "Code, giải thích thuật toán", "Văn phong tiếng Việt cầu kỳ"],
        ["Claude Sonnet", "Viết dài, soạn giáo án chỉn", "Việc 1-2 câu"],
        ["NotebookLM", "Hỏi đúng giáo trình PDF", "Sáng tạo ngoài tài liệu"],
        ["Ollama local", "Offline, dữ liệu lớp nhạy", "Máy yếu, cần đa phương tiện"],
      ],
      picks: [
        "• Việc học: NotebookLM + Flash",
        "• Việc code: DeepSeek / Qwen",
        "• Việc viết dài: Claude hoặc Pro, không dùng Lite",
      ],
      picksLabel: "Chọn theo việc",
      source: "Nổi bật",
    }),
  ];
}

function mapTikiProduct(item) {
  if (!item?.name || !item.price) return null;
  return {
    name: item.name,
    price: item.price,
    original: item.original_price || item.price,
    discount: item.discount_rate || 0,
    rating: item.rating_average || 0,
    reviews: item.review_count || 0,
    url: item.url_path ? `https://tiki.vn/${item.url_path}` : `https://tiki.vn/p${item.id}.html`,
    brand: item.brand?.name || item.brand_name || "",
  };
}

async function fetchTikiProductById(id) {
  const { data } = await http.get(`https://tiki.vn/api/v2/products/${id}`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    timeout: 8000,
  });
  return mapTikiProduct(data);
}

async function fetchTikiProducts(query) {
  const { data } = await http.get("https://tiki.vn/api/v2/products", {
    params: { limit: 20, q: query },
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
    timeout: 8000,
  });
  return (Array.isArray(data?.data) ? data.data : []).map(mapTikiProduct).filter(Boolean);
}

function valueScore(item) {
  return item.discount * 1.4 + item.rating * 8 + Math.min(item.reviews, 80) / 10 - item.price / 400000;
}

function pickValueProducts(items, count = 7) {
  return items
    .filter((item) => item.price > 50000 && item.price < 40000000)
    .sort((a, b) => valueScore(b) - valueScore(a))
    .slice(0, count);
}

async function fetchTikiCatalog(topic) {
  const lists = await Promise.all([
    ...(topic.productIds || []).map((id) =>
      safeSource(`tiki:${topic.key}:${id}`, async () => {
        const item = await fetchTikiProductById(id);
        return item ? [item] : [];
      })
    ),
    ...(topic.queries || [topic.query]).filter(Boolean).map((query) =>
      safeSource(`tiki:${topic.key}:${query}`, () => fetchTikiProducts(query))
    ),
  ]);
  const merged = [];
  const seen = new Set();
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item.url) || seen.has(item.name)) continue;
      seen.add(item.url);
      seen.add(item.name);
      merged.push(item);
    }
  }
  const picks = pickValueProducts(merged);
  if (!picks.length) return [];

  return [
    catalogItem(topic, {
      title: `Ngon bổ rẻ · ${topic.shortName}`,
      headers: ["Sản phẩm", "Giá", "Giảm", "Đánh giá"],
      rows: picks.map((item) => [
        item.brand ? `${item.brand} · ${item.name}` : item.name,
        moneyVnd(item.price),
        item.discount ? `-${item.discount}%` : "-",
        item.rating ? `${item.rating}★/${item.reviews}` : "-",
      ]),
      picks: picks.slice(0, 4).map((item) => `• [${moneyVnd(item.price)}] ${item.name}`),
      picksLabel: "Ngon bổ rẻ",
      source: "Giá Tiki",
    }),
  ];
}

async function fetchSteamDeals(topic) {
  const data = await fetchJson("https://store.steampowered.com/api/featuredcategories", {
    cc: "VN",
    l: "vietnamese",
  });
  const items = (data?.specials?.items || [])
    .filter((item) => item.discount_percent > 0)
    .sort((a, b) => b.discount_percent - a.discount_percent)
    .slice(0, 8);
  if (!items.length) return [];

  return [
    catalogItem(topic, {
      title: "Game đang giảm · Steam VN",
      headers: ["Game", "Giá VN", "Giảm", "Gốc"],
      rows: items.map((item) => [
        item.name,
        moneyVnd(item.final_price / 100),
        `-${item.discount_percent}%`,
        moneyVnd(item.original_price / 100),
      ]),
      picks: items.slice(0, 4).map((item) => `• **${item.name}** −${item.discount_percent}% · ${moneyVnd(item.final_price / 100)}`),
      picksLabel: "Ngon bổ rẻ",
      source: "Giá Steam",
    }),
  ];
}

export async function fetchAgenticCatalog(topic) {
  return [
    catalogItem(topic, {
      title: "Agentic · kiểu agent và cách chạy",
      headers: ["Kiểu agent", "Làm gì", "Cách chạy", "Lưu ý"],
      rows: [
        ["Tutor loop", "Ôn bài hỏi-chữa-hỏi lại", "AI hỏi → bạn trả lời → AI chữa", "Bạn phải trả lời trước"],
        ["Planner-Worker", "Việc nhiều bước", "1 model lên kế hoạch, 1 model làm từng bước", "Đừng 1 agent ôm hết"],
        ["RAG giáo trình", "Hỏi đúng tài liệu lớp", "NotebookLM hoặc PDF + trích dẫn", "Cấm trả lời ngoài tài liệu"],
        ["Quiz agent", "Ra đề + chấm", "Rubric trước, 5 câu/lượt", "Không viết hộ bài"],
        ["Code agent", "Bài lập trình", "Spec → code → test nhỏ", "Bắt giải thích từng bước"],
      ],
      picks: [
        "• Giáo dục: Tutor loop 5 câu/ngày, sai thì tự chữa rồi mới xem đáp án",
        "• Chia planner (ít lần) / worker (nhiều lần)",
        "• Có tool thật (file, quiz, terminal) mới gọi là agent — chat 1 phát không phải",
      ],
      picksLabel: "Quy tắc",
      source: "Agentic",
    }),
  ];
}

export async function fetchPromptCatalog(topic) {
  return [
    catalogItem(topic, {
      title: "Prompt theo việc",
      headers: ["Việc", "Khung prompt", "Output"],
      rows: [
        ["Giải thích bài", "Vai GV + đề + 3 bước + 1 câu hỏi ngược", "Lời giải ngắn + câu hỏi"],
        ["Giáo án", "Lớp + thời lượng + mục tiêu + hoạt động", "Bảng theo phút"],
        ["Chấm bài", "Dán rubric trước, chỉ chấm theo rubric", "Điểm + câu sai"],
        ["Flashcard", "Thuật ngữ → định nghĩa + gợi ý", "CSV 2-3 cột"],
        ["Dịch học thuật", "Giữ thuật ngữ, thêm ví dụ đời thường VN", "Bản dịch + chú thích"],
      ],
      picks: [
        "• Giải bài: `Bạn là GV. Đề: ... Giải 3 bước. Cuối cùng hỏi lại 1 câu để mình tự làm.`",
        "• Chấm: `Rubric: ... Chỉ chấm theo rubric. Trích câu sai. Không viết lại cả bài.`",
        "• Luôn chốt format: bảng / CSV / 5 gạch đầu dòng",
      ],
      picksLabel: "Mẫu copy",
      source: "Prompt",
    }),
  ];
}

export async function fetchEffectiveAiCatalog(topic) {
  return [
    catalogItem(topic, {
      title: "Dùng AI hiệu quả",
      headers: ["Nguyên tắc", "Làm", "Tránh"],
      rows: [
        ["Đúng model", "Lite/Flash cho việc thường, Pro khi kẹt", "Model lớn mọi câu"],
        ["Spec rõ", "Mục tiêu + format + 1 ví dụ", "Hỏi chung chung"],
        ["1 việc/lần", "Tách soạn / chấm / dịch", "10 việc trong 1 prompt"],
        ["Tự verify", "Bắt AI hỏi lại / tự giải lại", "Nộp nguyên output"],
        ["Ngữ cảnh gọn", "Đề + đáp án mẫu ngắn", "Dán cả giáo trình"],
      ],
      picks: [
        "• AI là gia sư / trợ lý, không phải người làm hộ",
        "• Xong 1 việc mới sang việc 2",
        "• Nếu output dài mà mơ hồ: thu hẹp format, đừng đổi sang model đắt ngay",
      ],
      picksLabel: "Giữ thói quen",
      source: "Dùng AI",
    }),
  ];
}

export async function fetchEducationDealsCatalog(topic) {
  const edu = catalogItem(topic, {
    title: "AI cho giáo dục",
    headers: ["Việc", "Dùng gì", "Cách dùng"],
    rows: [
      ["Hỏi bài / ELI5", "Gemini AI Studio", "Bắt học sinh trả lời trước, AI chữa"],
      ["Học theo giáo trình", "NotebookLM", "Upload PDF, chỉ hỏi có trích dẫn"],
      ["Soạn giáo án / đề", "Gemini Flash", "Chốt lớp + phút + bảng hoạt động"],
      ["Flashcard / Anki", "Flash / Lite", "Xuất CSV: thuật ngữ | nghĩa | gợi ý"],
      ["Chấm nhanh", "Model vừa + rubric", "Chấm theo rubic, không viết hộ"],
      ["Học lập trình", "DeepSeek / Qwen", "Spec → code → giải thích từng dòng"],
    ],
    picks: [
      "• Cặp nền tảng lớp học: **AI Studio** + **NotebookLM**",
      "• Agent ôn thi: 5 câu/ngày, sai thì tự chữa rồi mới xem đáp án",
      "• AI không nộp bài hộ — chỉ hỏi, chữa, ra đề",
    ],
    picksLabel: "Quy tắc lớp học",
    source: "Giáo dục",
  });

  const fields = catalogItem(topic, {
    title: "AI theo lĩnh vực",
    headers: ["Lĩnh vực", "Dùng gì", "Cách dùng"],
    rows: [
      ["Giáo dục", "NotebookLM + Flash", "Tài liệu trước, chat sau"],
      ["Viết / dịch", "Flash / Claude", "Chia đoạn, giữ giọng, 1 tone"],
      ["Code", "DeepSeek / Qwen", "Có test nhỏ, bắt giải thích"],
      ["Data / Excel", "Flash / Lite", "Nhờ công thức, tự chạy lại"],
      ["Ảnh minh họa bài", "Gemini / Ideogram", "Cover slide, không in ấn"],
      ["Nghiên cứu nhanh", "Flash + nguồn", "Bắt dẫn link, đối chiếu"],
    ],
    picks: [
      "• Học/soạn bài: NotebookLM + Flash",
      "• Code: DeepSeek / Qwen",
      "• Viết dài/chỉn chu: Claude hoặc Pro",
    ],
    picksLabel: "Chọn theo việc",
    source: "Theo lĩnh vực",
  });

  return [edu, fields];
}

const CATALOG_FETCHERS = {
  "ai-price": fetchAiPriceCatalog,
  "ai-trend": fetchAiTrendCatalog,
  "ai-local": fetchLocalVsCloudCatalog,
  "ai-hot": fetchAiHotCatalog,
  agentic: fetchAgenticCatalog,
  prompt: fetchPromptCatalog,
  "dung-ai": fetchEffectiveAiCatalog,
  "giao-duc": fetchEducationDealsCatalog,
  tiki: fetchTikiCatalog,
  steam: fetchSteamDeals,
};

export async function fetchCatalogTopic(topic) {
  const fetcher = CATALOG_FETCHERS[topic.catalog];
  if (!fetcher) return [];
  return safeSource(`catalog:${topic.key}`, () => fetcher(topic));
}
