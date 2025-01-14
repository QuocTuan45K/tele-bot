require("dotenv").config();
const { google } = require("googleapis");
const TelegramBot = require("node-telegram-bot-api");

// Lấy thông tin từ biến môi trường
const credentials = JSON.parse(process.env.CREDENTIALS); // Parse JSON từ biến môi trường

// Khởi tạo bot Telegram
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Kết nối Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials: credentials, // Sử dụng trực tiếp credentials từ biến môi trường
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// Hàm lấy toàn bộ dữ liệu từ Google Sheet
async function getSheetData(sheetName) {
  try {
    const range = `${sheetName}!A2:C`; // Phạm vi dữ liệu
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
    const range = `${sheetName}!A2:C`; // Phạm vi dữ liệu
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: range,
    });

    const rows = response.data.values;
    let updated = false;

    // Tìm ID cần cập nhật
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === id.toString()) {
        // Cập nhật giá trị mới
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

// Xử lý lệnh Telegram
bot.on("message", (msg) => {
  const chatId = msg.chat.id; // ID của nhóm
  const userId = msg.from.id; // ID của người gửi tin nhắn
  const username = msg.from.username || "Không có username";
  const firstName = msg.from.first_name || "Không có tên";

  bot.sendMessage(chatId, `User: ${firstName} (@${username})\nTelegram ID: ${userId}`);
});

bot.onText(/\/update (.+)/, async (msg, match) => {
  const chatId = msg.chat.id; // ID của nhóm
  const userId = msg.from.id; // ID của người gửi tin nhắn
  const username = msg.from.username || "No Username"; // Username của người gửi

  // Mapping thành viên trong nhóm với sheet riêng
  const userSheets = {
    1564584883: "Tuấn", // Telegram ID -> Sheet "Tuấn"
    6430635029: "Duyên", // Telegram ID -> Sheet "Duyên"
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

  // Lấy và hiển thị dữ liệu sau khi cập nhật
  const updatedData = await getSheetData(sheetName);
  bot.sendMessage(chatId, updatedData);
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id; // ID của nhóm
  const userId = msg.from.id; // ID của người gửi tin nhắn
  const username = msg.from.username || "No Username"; // Username của người gửi

  // Mapping thành viên trong nhóm với sheet riêng
  const userSheets = {
    1564584883: "Tuấn", // Telegram ID -> Sheet "Tuấn"
    6430635029: "Duyên", // Telegram ID -> Sheet "Duyên"
  };

  const sheetName = userSheets[userId];
  if (!sheetName) {
    bot.sendMessage(chatId, `@${username}, bạn không có quyền xem dữ liệu.`);
    return;
  }

  // Lấy và hiển thị dữ liệu hiện tại
  const dataMessage = await getSheetData(sheetName);
  bot.sendMessage(chatId, dataMessage);
});

console.log("Bot is running...");
