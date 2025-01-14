require("dotenv").config();
const { google } = require("googleapis");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

// Kiểm tra biến môi trường cần thiết
if (!process.env.CREDENTIALS || !process.env.TELEGRAM_BOT_TOKEN || !process.env.SPREADSHEET_ID) {
  console.error("Lỗi: Biến môi trường thiếu hoặc không đúng định dạng!");
  process.exit(1);
}

// Đường dẫn file credentials.json
const credentialsPath = "./credentials.json";

// Tạo file credentials.json từ biến môi trường
if (!fs.existsSync(credentialsPath)) {
  try {
    const credentials = JSON.parse(process.env.CREDENTIALS.replace(/\\\\n/g, "\n"));
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    console.log("File credentials.json đã được tạo thành công!");
  } catch (error) {
    console.error("Lỗi khi tạo file credentials.json:", error.message);
    process.exit(1);
  }
} else {
  console.log("File credentials.json đã tồn tại.");
}

// Khởi tạo bot Telegram
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Sử dụng Google Auth với file credentials.json
const auth = new google.auth.GoogleAuth({
  keyFile: credentialsPath,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// Hàm lấy toàn bộ dữ liệu từ Google Sheet
async function getSheetData(sheetName) {
  try {
    const range = `${sheetName}!A2:C`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: range,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return "Không có dữ liệu.";

    return rows.map(row => `ID: ${row[0]}, Name: ${row[1]}, Count: ${row[2] || 0}`).join("\n");
  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu Sheet:", error.message);
    return "Lỗi khi lấy dữ liệu.";
  }
}

// Hàm cập nhật dữ liệu trong Google Sheet
async function updateSheet(sheetName, id, newValue) {
  try {
    const range = `${sheetName}!A2:C`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: range,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === id.toString());

    if (rowIndex === -1) return "Không tìm thấy ID.";

    const updateRange = `${sheetName}!C${rowIndex + 2}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: updateRange,
      valueInputOption: "RAW",
      resource: { values: [[newValue]] },
    });

    return "Cập nhật thành công!";
  } catch (error) {
    console.error("Lỗi khi cập nhật Sheet:", error.message);
    return "Lỗi khi cập nhật dữ liệu.";
  }
}

// Xử lý lệnh Telegram
bot.onText(/\/update (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || "No Username";

  const userSheets = {
    1564584883: "Tuấn",
    6430635029: "Duyên",
  };

  const sheetName = userSheets[userId];
  if (!sheetName) {
    return bot.sendMessage(chatId, `@${username}, bạn không có quyền sử dụng lệnh này.`);
  }

  const [id, value] = match[1].split(",").map(item => item.trim());
  if (!id || isNaN(parseInt(value))) {
    return bot.sendMessage(chatId, `@${username}, vui lòng gửi đúng định dạng: /update id, value`);
  }

  const response = await updateSheet(sheetName, id, parseInt(value));
  bot.sendMessage(chatId, response);

  const dataMessage = await getSheetData(sheetName);
  bot.sendMessage(chatId, dataMessage);
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || "No Username";

  const userSheets = {
    1564584883: "Tuấn",
    6430635029: "Duyên",
  };

  const sheetName = userSheets[userId];
  if (!sheetName) {
    return bot.sendMessage(chatId, `@${username}, bạn không có quyền xem dữ liệu.`);
  }

  const dataMessage = await getSheetData(sheetName);
  bot.sendMessage(chatId, dataMessage);
});

console.log("Bot is running...");
