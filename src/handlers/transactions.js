import logger from "../logger/logger.js";

export function createTransactionHandler(doc, constants) {
  const { VALID_HANG_MUC, VALID_HU, sheetTitle = "FINANCE" } = constants;

  async function handleAddTransaction(message, entitiesOrDetails) {
    try {
      const sendReply = (text) => message.reply(text);

      // Backward compatibility: if string array provided (legacy *add), adapt it
      if (Array.isArray(entitiesOrDetails)) {
        const details = entitiesOrDetails;
        if (details.length === 1 && details[0].toLowerCase() === "help") {
          return sendReply(
            "📌 Hướng dẫn sử dụng lệnh *add:\n" +
              "👉 Định dạng: *add <Nội_dung> <Số tiền> <Hạng mục> [Hũ] [Tag]\n" +
              "👉 Ví dụ: *add Ăn_sáng 50k T NEC Ăn uống\n" +
              "👉 Hạng mục hợp lệ: " + VALID_HANG_MUC.join(", ") + "\n" +
              "👉 Hũ hợp lệ: " + VALID_HU.join(", ") + "\n" +
              "👉 Lưu ý: Hũ có thể để trống nếu không cần."
          );
        }
        if (details.length < 3) {
          return sendReply(
            "⚠️ Lệnh ghi giao dịch không hợp lệ! Sử dụng *add help để xem cách sử dụng."
          );
        }
        const [noiDung, soTien, hangMuc, huOrTag, ...tags] = details;
        const hu = VALID_HU.includes(huOrTag) ? huOrTag : "";
        const finalTags = hu ? tags : [huOrTag, ...tags].filter(Boolean);
        return addOrUpdate({ noiDung, soTien, hangMuc, hu, tags: finalTags });
      }

      // NLU path
      const {
        noi_dung: noiDung,
        so_tien: soTien,
        hang_muc: hangMuc,
        hu = "",
        tags = [],
      } = entitiesOrDetails || {};

      if (!noiDung || !soTien || !hangMuc) {
        return sendReply(
          "⚠️ Thiếu thông tin giao dịch. Cần: nội dung, số tiền, hạng mục (T|C)."
        );
      }
      const tagsArray = Array.isArray(tags) ? tags : String(tags).split(/[,\s]+/).filter(Boolean);
      return addOrUpdate({ noiDung, soTien, hangMuc, hu, tags: tagsArray });

      async function addOrUpdate({ noiDung, soTien, hangMuc, hu, tags }) {
        const amount = typeof soTien === "number" ? soTien : parseInt(String(soTien).replace("k", "000"), 10);
        if (isNaN(amount)) {
          return sendReply("⚠️ Số tiền phải là số hợp lệ! Ví dụ: 100k hoặc 50000.");
        }
        if (!VALID_HANG_MUC.includes(hangMuc)) {
          return sendReply("⚠️ Hạng mục không hợp lệ!");
        }
        if (hu && !VALID_HU.includes(hu)) {
          return sendReply("⚠️ Hũ không hợp lệ!");
        }

        const sheet = doc.sheetsByTitle[sheetTitle];
        if (!sheet) {
          return sendReply(`⚠️ Không tìm thấy sheet ${sheetTitle}!`);
        }

        await sheet.loadCells("H4:M100");
        const currentMonth = new Date().getMonth() + 1;
        let foundRow = null;

        for (let row = 4; row < 100; row++) {
          const monthCell = sheet.getCell(row, 7);
          const categoryCell = sheet.getCell(row, 10);
          const tagCell = sheet.getCell(row, 12);
          if (
            monthCell.value === currentMonth &&
            categoryCell.value === hangMuc &&
            tagCell.value === (tags || []).join(" ")
          ) {
            foundRow = row;
            break;
          }
        }

        if (foundRow !== null) {
          const amountCell = sheet.getCell(foundRow, 9);
          amountCell.value = (amountCell.value || 0) + amount;
        } else {
          let newRow = 4;
          while (sheet.getCell(newRow, 7).value) newRow++;
          sheet.getCell(newRow, 7).value = currentMonth;
          sheet.getCell(newRow, 8).value = noiDung;
          sheet.getCell(newRow, 9).value = amount;
          sheet.getCell(newRow, 10).value = hangMuc;
          sheet.getCell(newRow, 11).value = hu;
          sheet.getCell(newRow, 12).value = (tags || []).join(" ");
        }

        await sheet.saveUpdatedCells();
        return sendReply(
          `✅ Ghi nhận giao dịch: **${noiDung}** - **${amount.toLocaleString()} VND**` +
            (hu ? ` vào **${hu}**.` : ".")
        );
      }
    } catch (error) {
      logger.error(`Error in handleAddTransaction: ${error.message}`);
      return message.reply("⚠️ Lỗi hệ thống! Không thể ghi giao dịch vào Google Sheets.");
    }
  }

  return { handleAddTransaction };
}

export default createTransactionHandler;


