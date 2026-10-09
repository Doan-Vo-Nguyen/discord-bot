import logger from "../logger/logger.js";

export const FINANCE_CHANNEL_ID =
  process.env.FINANCE_CHANNEL_ID || "1435081282324533298";

function toNumberLoose(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const s = String(value).replace(/[.,\s]/g, "").replace(/vnd|đ|d/gi, "");
  const sign = /-/.test(String(value)) ? -1 : 1;
  const digits = parseInt(s.replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(digits)) return 0;
  return sign * digits;
}

function pickHeaderIndex(headerValues, candidates) {
  const lower = (headerValues || []).map((h) => String(h || "").trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate.toLowerCase());
    if (idx !== -1) return idx;
  }
  // fuzzy contains
  for (let i = 0; i < lower.length; i++) {
    for (const candidate of candidates) {
      if (lower[i].includes(candidate.toLowerCase())) return i;
    }
  }
  return -1;
}

export function createFinanceHandler(doc) {
  const sheet = () => doc.sheetsByTitle["FINANCE"];

  async function ensureSheet() {
    const ws = sheet();
    if (!ws) throw new Error("Không tìm thấy sheet FINANCE");
    return ws;
  }

  function ensureChannel(message) {
    if (!message?.channel?.id) return true;
    return message.channel.id === FINANCE_CHANNEL_ID;
  }

  async function getLastSpending(message) {
    const ws = await ensureSheet();
    const rows = await ws.getRows();
    if (!rows || rows.length === 0) {
      return message.reply("📭 FINANCE chưa có dữ liệu.");
    }

    // header-based detection
    const headers = ws.headerValues || [];
    const idxDate = pickHeaderIndex(headers, ["date", "ngày", "ngay", "time", "thời gian"]);
    const idxDesc = pickHeaderIndex(headers, ["description", "noi_dung", "nội dung", "mô tả", "mo_ta"]);
    const idxAmount = pickHeaderIndex(headers, ["amount", "số tiền", "so_tien", "tiền", "gia_tri"]);
    const idxType = pickHeaderIndex(headers, ["type", "loai", "hạng mục", "hang_muc", "category"]);

    let last = null;
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      const raw = r._rawData || [];
      const amount = toNumberLoose(idxAmount >= 0 ? raw[idxAmount] : r.amount || r["số tiền"] || r.so_tien);
      const typeVal = String(idxType >= 0 ? raw[idxType] : r.type || r.loai || r["hạng mục"] || r.hang_muc || "").toUpperCase();
      const isExpense = amount < 0 || typeVal.startsWith("C") || /chi|expense/i.test(typeVal);
      if (isExpense && amount !== 0) {
        const dateVal = idxDate >= 0 ? raw[idxDate] : r.date || r["ngày"] || r.ngay || r.time;
        const descVal = idxDesc >= 0 ? raw[idxDesc] : r.description || r["nội dung"] || r.noi_dung || r["mô tả"];
        last = {
          date: dateVal || "(không rõ ngày)",
          desc: descVal || "(không rõ nội dung)",
          amount,
        };
        break;
      }
    }

    if (!last) {
      return message.reply("🙈 Không tìm được giao dịch chi tiêu gần nhất.");
    }

    return message.reply(
      `🕒 Lần chi gần nhất: ${last.date}\n📝 Nội dung: ${last.desc}\n💸 Số tiền: ${last.amount.toLocaleString()} VND`
    );
  }

  async function getBalance(message) {
    const ws = await ensureSheet();
    const rows = await ws.getRows();
    if (!rows || rows.length === 0) {
      return message.reply("📭 FINANCE chưa có dữ liệu.");
    }

    const headers = ws.headerValues || [];
    const idxBalance = pickHeaderIndex(headers, ["balance", "còn lại", "con_lai", "remaining", "so_du"]);
    const idxAmount = pickHeaderIndex(headers, ["amount", "số tiền", "so_tien", "tiền", "gia_tri"]);

    let balance = null;
    if (idxBalance >= 0) {
      const lastRow = rows[rows.length - 1];
      const raw = lastRow._rawData || [];
      balance = toNumberLoose(raw[idxBalance]);
    } else {
      // derive from sum if no explicit balance
      let sum = 0;
      for (const r of rows) {
        const raw = r._rawData || [];
        const amount = toNumberLoose(idxAmount >= 0 ? raw[idxAmount] : r.amount || r["số tiền"] || r.so_tien);
        sum += amount;
      }
      balance = sum;
    }

    return message.reply(`🏦 Số dư hiện tại ước tính: ${balance.toLocaleString()} VND`);
  }

  return {
    ensureChannel,
    getLastSpending,
    getBalance,
  };
}

export default createFinanceHandler;


