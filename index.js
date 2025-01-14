require("dotenv").config();
const { google } = require("googleapis");
const TelegramBot = require("node-telegram-bot-api");

// Khởi tạo bot Telegram
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Parse GOOGLE_CREDENTIALS từ biến môi trường
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

// Sử dụng credentials trực tiếp
const auth = new google.auth.GoogleAuth({
  credentials, // Truyền trực tiếp object credentials
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
    
    let dataMessage = "Dữ liệu hiện tại:\n";
    rows.forEach((row) => {
      dataMessage += `ID: ${row[0]}, Name: ${row[1]}, Count: ${row[2] || 0}\n`;
    });
    return dataMessage;
  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu Sheet:", error);
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

    const rows = response.data.values;
    let updated = false;

    // Tìm ID cần cập nhật
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === id.toString()) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.SPREADSHEET_ID,
          range: `${sheetName}!C${i + 2}`, // Vị trí cột Count của hàng i+2
          valueInputOption: "RAW",
          resource: { values: [[newValue]] },
        });
        updated = true;
        break;
      }
    }

    return updated ? "Cập nhật thành công!" : "Không tìm thấy ID.";
  } catch (error) {
    console.error("Lỗi khi cập nhật Sheet:", error);
    return "Lỗi khi cập nhật dữ liệu.";
  }
}

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || "Không có username";
  const firstName = msg.from.first_name || "Không có tên";

  bot.sendMessage(chatId, `User: ${firstName} (@${username})\nTelegram ID: ${userId}`);
});

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
    bot.sendMessage(chatId, `@${username}, bạn không có quyền sử dụng lệnh này.`);
    return;
  }

  const data = match[1].split(",").map((item) => item.trim());
  if (data.length < 2) {
    bot.sendMessage(chatId, `@${username}, vui lòng gửi đúng định dạng: /update id, value`);
    return;
  }

  const id = data[0];
  const newValue = parseInt(data[1]);
  if (isNaN(newValue)) {
    bot.sendMessage(chatId, `@${username}, value phải là số.`);
    return;
  }

  const response = await updateSheet(sheetName, id, newValue);
  bot.sendMessage(chatId, `@${username}: ${response}`);

  const updatedData = await getSheetData(sheetName);
  bot.sendMessage(chatId, updatedData);
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
    bot.sendMessage(chatId, `@${username}, bạn không có quyền xem dữ liệu.`);
    return;
  }

  const dataMessage = await getSheetData(sheetName);
  bot.sendMessage(chatId, dataMessage);
});

console.log("Bot is running...");
