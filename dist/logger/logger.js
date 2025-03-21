// logger.js
import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Đảm bảo thư mục logs tồn tại
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Định dạng thời gian
const timezoned = () => {
  return new Date().toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh'
  });
};

// Tạo định dạng cho logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: timezoned }),
  winston.format.printf(info => {
    return `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`;
  })
);

// Khởi tạo logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    // Ghi tất cả logs từ mức error trở lên vào file error.log
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    // Ghi tất cả logs vào file combined.log
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log')
    }),
    // Hiển thị logs ra console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ],
  // Xử lý exceptions không bắt được
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'exceptions.log')
    })
  ],
  exitOnError: false
});

export default logger;