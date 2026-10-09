import logger from "../logger/logger.js";

export function createStatisticHandler(doc, options = {}) {
  const { sheetTitle = "FINANCE" } = options;

  async function handleStatistic(message) {
    try {
      const sheet = doc.sheetsByTitle[sheetTitle];
      if (!sheet) {
        return message.reply(`⚠️ Không tìm thấy sheet ${sheetTitle}!`);
      }

      await sheet.loadCells("H4:M100");

      const currentMonth = new Date().getMonth() + 1;
      const categoryStats = {};
      const incomeStats = {};
      let totalChiTieu = 0;
      let totalThuNhap = 0;
      let totalChiTieuAll = 0;
      let totalThuNhapAll = 0;

      for (let row = 4; row < 100; row++) {
        const monthCell = sheet.getCell(row, 7);
        const amountCell = sheet.getCell(row, 9);
        const categoryCell = sheet.getCell(row, 10);
        const tagCell = sheet.getCell(row, 12);

        const month = parseInt(monthCell.value);
        if (!month || isNaN(month)) continue;

        const category = categoryCell.value || "Khác";
        const tag = tagCell.value || "Không có tag";
        const amount = parseInt(amountCell.value) || 0;

        if (category.startsWith("T")) {
          totalThuNhapAll += amount;
        } else if (category.startsWith("C")) {
          totalChiTieuAll += amount;
        }

        if (month === currentMonth) {
          if (category.startsWith("C")) {
            if (!categoryStats[category]) categoryStats[category] = {};
            if (!categoryStats[category][tag]) categoryStats[category][tag] = 0;
            categoryStats[category][tag] += amount;
            totalChiTieu += amount;
          } else if (category.startsWith("T")) {
            if (!incomeStats[category]) incomeStats[category] = {};
            if (!incomeStats[category][tag]) incomeStats[category][tag] = 0;
            incomeStats[category][tag] += amount;
            totalThuNhap += amount;
          }
        }
      }

      if (totalChiTieu === 0 && totalThuNhap === 0) {
        return message.reply(`📊 Không có dữ liệu giao dịch cho tháng ${currentMonth}.`);
      }

      const remainingFromLastMonths = totalThuNhapAll - totalChiTieuAll;
      let report = `📊 **Thống kê tháng ${currentMonth}**\n\n`;

      if (totalChiTieu > 0) {
        report += `💰 **Tổng chi tiêu: ${totalChiTieu.toLocaleString()} VND**\n`;
        for (const [category, tags] of Object.entries(categoryStats)) {
          report += `🔸 **${category}**\n`;
          for (const [tag, amount] of Object.entries(tags)) {
            report += `   📍 ${tag}: ${amount.toLocaleString()} VND\n`;
          }
        }
        report += "\n";
      }

      if (totalThuNhap > 0) {
        report += `💵 **Tổng thu nhập: ${totalThuNhap.toLocaleString()} VND**\n`;
        for (const [category, tags] of Object.entries(incomeStats)) {
          report += `🔹 **${category}**\n`;
          for (const [tag, amount] of Object.entries(tags)) {
            report += `   📍 ${tag}: ${amount.toLocaleString()} VND\n`;
          }
        }
      }

      report += `\n📦 **Tiền còn lại từ các tháng trước: ${remainingFromLastMonths.toLocaleString()} VND**\n`;
      return message.reply(report);
    } catch (error) {
      logger.error(`Error in handleStatistic: ${error.message}`);
      return message.reply("⚠️ Lỗi hệ thống! Không thể lấy dữ liệu thống kê.");
    }
  }

  return { handleStatistic };
}

export default createStatisticHandler;


