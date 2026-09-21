import { google } from 'googleapis';
import { GoldPriceSnapshot, GoldType, classifyGoldType } from './gold-price';

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  date: string;
  thumbnail: string;
  timestamp: number;
  isHidden?: boolean;
  isSaved?: boolean;
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/spreadsheets'];

export function getAuthClient() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error('Google Sheets configuration missing: GOOGLE_PRIVATE_KEY or GOOGLE_SERVICE_ACCOUNT_EMAIL');
  }

  // Robust formatting for private key - handles ALL environments:
  // 1. .env file: key may be wrapped in quotes with literal \n
  // 2. GitHub Secrets: key may have real newlines, or escaped \n
  const formattedKey = privateKey
    .replace(/^"|"$/g, '')     // Remove surrounding quotes if present
    .replace(/\\n/g, '\n')     // Replace literal \n with real newline
    .replace(/\\\\n/g, '\n');  // Replace double-escaped \\n with real newline

  // Final validation
  if (!formattedKey.includes('-----BEGIN')) {
    console.error('[Auth] WARNING: Private key does not contain expected header after formatting.');
    console.error('[Auth] Key starts with:', formattedKey.substring(0, 30));
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: formattedKey,
    scopes: SCOPES,
  });
}

export async function getNewsFromSheets(sheetName: string = 'Sheet1'): Promise<{ news: NewsItem[], heartbeat?: string }> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return { news: [] };

  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    console.log(`Fetching data from Google Sheets: ${sheetName}!A2:H (and Heartbeat Z1)...`);

    // Fetch both range and Heartbeat
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [`${sheetName}!A2:H`, `${sheetName}!Z1`],
    });

    const rows = response.data.valueRanges?.[0].values;
    const heartbeatRow = response.data.valueRanges?.[1].values;
    const heartbeat = heartbeatRow?.[0]?.[0];

    if (!rows || rows.length === 0) {
      console.log(`[GoogleSheets] No data found in ${sheetName}.`);
      return { news: [], heartbeat };
    }

    console.log(`[GoogleSheets] Successfully read ${rows.length} rows from ${sheetName}.`);

    const news = rows.map((row) => ({
      title: row[0] || '',
      summary: row[1] || '',
      url: row[2] || '',
      date: row[3] || '',
      thumbnail: row[4] || '',
      timestamp: row[5] ? parseInt(row[5], 10) : 0,
      isHidden: row[6] === 'TRUE',
      isSaved: row[7] === 'TRUE',
    }));

    return { news, heartbeat };
  } catch (error) {
    console.error(`Error fetching data from ${sheetName}:`, error);
    return { news: [] };
  }
}

/**
 * Google Sheets KHONG tu noi luoi khi values.update ghi qua so dong hien co
 * (khac voi values.append) - se bao "exceeds grid limits". Ham nay nong so dong
 * len truoc khi ghi. Sheet mac dinh chi co 1000 dong.
 */
async function ensureRowCapacity(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetName: string,
  neededRows: number
): Promise<number> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(sheetId,title,gridProperties/rowCount)',
  });

  const target = meta.data.sheets?.find(sh => sh.properties?.title === sheetName);
  if (!target?.properties) {
    console.warn(`[GoogleSheets] Khong tim thay sheet ${sheetName} de kiem tra so dong.`);
    return 0;
  }

  const current = target.properties.gridProperties?.rowCount || 0;
  if (current >= neededRows) return current;

  console.log(`[GoogleSheets] ${sheetName}: nới lưới ${current} -> ${neededRows} dòng.`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        updateSheetProperties: {
          properties: {
            sheetId: target.properties.sheetId,
            gridProperties: { rowCount: neededRows },
          },
          fields: 'gridProperties.rowCount',
        },
      }],
    },
  });

  return neededRows;
}

export async function saveNewsToSheets(newsItems: NewsItem[], sheetName: string = 'Sheet1'): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return;

  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Prepare values
    const values = newsItems.map(item => [
      item.title,
      item.summary,
      item.url,
      item.date,
      item.thumbnail,
      item.timestamp.toString(),
      item.isHidden ? 'TRUE' : 'FALSE',
      item.isSaved ? 'TRUE' : 'FALSE',
    ]);

    // 2. Ghi dữ liệu mới TRƯỚC. Nếu clear trước rồi update sau, một lỗi mạng
    // giữa hai bước sẽ để lại sheet trống hoàn toàn.
    let rowCapacity = 0;
    if (values.length > 0) {
      // +2 chu khong phai +1: dong ngay sau vung du lieu phai ton tai thi
      // pham vi clear o buoc 3 moi hop le (neu khong se bao "exceeds grid limits",
      // lam vang luon buoc cap nhat heartbeat ben duoi).
      rowCapacity = await ensureRowCapacity(sheets, spreadsheetId, sheetName, values.length + 2);

      // Ghi theo lô - vài nghìn dòng tóm tắt trong 1 request dễ vượt giới hạn
      // kích thước payload của Sheets API.
      const CHUNK = 1000;
      for (let i = 0; i < values.length; i += CHUNK) {
        const chunk = values.slice(i, i + CHUNK);
        const startRow = 2 + i;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A${startRow}:H${startRow + chunk.length - 1}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: chunk,
          },
        });
        if (values.length > CHUNK) {
          console.log(`[GoogleSheets] ${sheetName}: đã ghi ${Math.min(i + CHUNK, values.length)}/${values.length} dòng.`);
        }
      }
    }

    // 3. Xoá phần dư của lần ghi trước (nếu danh sách mới ngắn hơn)
    const firstStaleRow = values.length + 2;
    if (rowCapacity === 0 || firstStaleRow <= rowCapacity) {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetName}!A${firstStaleRow}:H`,
      });
    }

    // 4. Update Heartbeat (Cell Z1) to track when the JOBS actually run
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!Z1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })]],
        },
      });
      console.log(`[GoogleSheets] Heartbeat updated for ${sheetName} to cell Z1.`);
    } catch (heartbeatError) {
      console.error(`[GoogleSheets] WARNING: Heartbeat update failed for ${sheetName}:`, heartbeatError);
    }

    console.log(`Successfully saved ${values.length} news items to ${sheetName}.`);
  } catch (error) {
    console.error(`Error saving data to ${sheetName}:`, error);
    throw error;
  }
}

export async function updateHeartbeatOnly(sheetName: string): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return;

  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!Z1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })]],
      },
    });
    console.log(`[GoogleSheets] Heartbeat-only updated for ${sheetName}.`);
  } catch (error) {
    console.error(`[GoogleSheets] Heartbeat-only update failed for ${sheetName}:`, error);
  }
}

// ============= GOLD PRICE FUNCTIONS =============

export interface GoldPriceRow {
  date: string;
  brand: string;
  name: string;
  buyPrice: string;
  sellPrice: string;
  worldPrice: string;
  timestamp: string;
}

/** Một điểm trên biểu đồ: giá chốt của một sản phẩm trong một ngày */
export interface GoldHistoryPoint {
  day: string;   // "17/4/2026"
  buy: number;
  sell: number;
}

/** Giá vàng thế giới (USD/oz) chốt theo ngày */
export interface GoldWorldPoint {
  day: string;
  usd: number;
}

/** Chuỗi lịch sử của một sản phẩm, đã gộp theo ngày */
export interface GoldSeries {
  name: string;
  brand: string;
  type: GoldType;
  points: GoldHistoryPoint[];
}

// Sheet được append mỗi ~30 phút x 30 mặt hàng. Chặn số dòng đọc về để trang
// không chậm dần theo thời gian (rollup sang sheet riêng là hướng lâu dài).
const MAX_HISTORY_ROWS = 40000;
// Số ngày tối đa đưa lên biểu đồ
const MAX_HISTORY_DAYS = 90;

/**
 * Cột date được ghi bằng toLocaleString('vi-VN') -> "HH:MM:SS D/M/YYYY"
 * (GIỜ đứng trước NGÀY). Lấy token chứa '/' mới ra phần ngày.
 */
export function extractDay(date: string): string {
  return date.split(' ').find(part => part.includes('/')) || date;
}

function toNumber(value: string): number {
  return parseInt(String(value).replace(/\D/g, ''), 10) || 0;
}

/**
 * Save gold price snapshot to Google Sheets (append mode - keeps history)
 */
export async function saveGoldPricesToSheets(snapshot: GoldPriceSnapshot, sheetName: string = 'GoldPrice'): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return;

  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Prepare values - each gold item becomes a row
    const fetchTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const values = snapshot.items.map(item => [
      fetchTime,
      item.brand,
      item.name,
      item.buyPrice.toString(),
      item.sellPrice.toString(),
      item.worldPrice,
      item.timestamp.toString(),
    ]);

    if (values.length > 0) {
      // Append to sheet (keeps history)
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:G`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values,
        },
      });
    }

    // Update Heartbeat
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!Z1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[fetchTime]],
        },
      });
    } catch (heartbeatError) {
      console.error(`[GoogleSheets] WARNING: Gold heartbeat update failed:`, heartbeatError);
    }

    console.log(`[GoogleSheets] Successfully appended ${values.length} gold price rows to ${sheetName}.`);
  } catch (error) {
    console.error(`Error saving gold prices to ${sheetName}:`, error);
    throw error;
  }
}

/**
 * Gộp các dòng lịch sử thành chuỗi theo sản phẩm + theo ngày.
 * Trong mỗi ngày lấy bản ghi CUỐI (mới nhất) vì sheet được append theo thời gian.
 */
function buildSeries(rows: GoldPriceRow[]): { series: GoldSeries[]; world: GoldWorldPoint[] } {
  const byProduct = new Map<string, { brand: string; name: string; days: Map<string, GoldHistoryPoint> }>();
  // Gia the gioi giong nhau o moi dong trong cung mot snapshot -> gom rieng theo ngay
  const worldByDay = new Map<string, number>();

  for (const row of rows) {
    if (!row.name) continue;

    const usd = toNumber(row.worldPrice);
    if (usd > 0) worldByDay.set(extractDay(row.date), usd);
    const key = `${row.brand}|${row.name}`;
    let entry = byProduct.get(key);
    if (!entry) {
      entry = { brand: row.brand, name: row.name, days: new Map() };
      byProduct.set(key, entry);
    }
    // Ghi đè => giữ bản ghi cuối cùng của ngày
    entry.days.set(extractDay(row.date), {
      day: extractDay(row.date),
      buy: toNumber(row.buyPrice),
      sell: toNumber(row.sellPrice),
    });
  }

  const series = Array.from(byProduct.values())
    .map(entry => ({
      name: entry.name,
      brand: entry.brand,
      type: classifyGoldType(entry.name),
      points: Array.from(entry.days.values()).slice(-MAX_HISTORY_DAYS),
    }))
    .filter(s => s.points.length > 0);

  const world = Array.from(worldByDay.entries())
    .map(([day, usd]) => ({ day, usd }))
    .slice(-MAX_HISTORY_DAYS);

  return { series, world };
}

/**
 * Get the LATEST gold prices from sheet (most recent snapshot) + chuỗi lịch sử đã gộp theo ngày.
 * Chỉ trả về dữ liệu đã tổng hợp, không đẩy toàn bộ raw history xuống client.
 */
export async function getLatestGoldPricesFromSheets(sheetName: string = 'GoldPrice'): Promise<{ prices: GoldPriceRow[], series: GoldSeries[], world: GoldWorldPoint[], heartbeat?: string }> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return { prices: [], series: [], world: [] };

  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Đếm số dòng đã điền (đọc 1 cột rẻ hơn nhiều so với đọc cả bảng)
    const countRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:A`,
      majorDimension: 'COLUMNS',
    });
    const filledRows = countRes.data.values?.[0]?.length || 0;
    const startRow = Math.max(2, filledRows - MAX_HISTORY_ROWS + 1);

    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [`${sheetName}!A${startRow}:G`, `${sheetName}!Z1`],
    });

    const rows = response.data.valueRanges?.[0].values;
    const heartbeatRow = response.data.valueRanges?.[1].values;
    const heartbeat = heartbeatRow?.[0]?.[0];

    if (!rows || rows.length === 0) {
      console.log(`[GoogleSheets] No gold price data found in ${sheetName}.`);
      return { prices: [], series: [], world: [], heartbeat };
    }

    const allPrices: GoldPriceRow[] = rows.map((row) => ({
      date: row[0] || '',
      brand: row[1] || '',
      name: row[2] || '',
      buyPrice: row[3] || '0',
      sellPrice: row[4] || '0',
      worldPrice: row[5] || '0',
      timestamp: row[6] || '0',
    }));

    // Snapshot mới nhất = các dòng có cùng mốc thời gian với dòng cuối
    const latestDate = allPrices[allPrices.length - 1].date;
    const latestPrices = allPrices.filter(p => p.date === latestDate);
    const { series, world } = buildSeries(allPrices);

    console.log(`[GoogleSheets] Gold: ${latestPrices.length} dòng mới nhất (${latestDate}), ${allPrices.length} dòng lịch sử (từ row ${startRow}/${filledRows}), ${series.length} chuỗi sản phẩm, ${world.length} ngày giá thế giới.`);
    return { prices: latestPrices, series, world, heartbeat };
  } catch (error) {
    console.error(`Error fetching gold prices from ${sheetName}:`, error);
    return { prices: [], series: [], world: [] };
  }
}
