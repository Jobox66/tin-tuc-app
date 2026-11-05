import { google } from 'googleapis';
import { GoldPriceSnapshot, GoldType, classifyGoldType, worldToVndPerChi, dayToTimestamp, BRAND_REPRESENTATIVE, BRAND_SECTIONS } from './gold-price';
export { dayToTimestamp } from './gold-price';
import { NewsRowRef, SUMMARY_PENDING, planTrim, toDeleteRanges, vnDateTimeToEpoch } from './sync-plan';
export type { NewsRowRef } from './sync-plan';

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

// ============= GHI TIN THEO KIEU THEM DONG / SUA O =============
// Truoc day moi luot doc het 5000 dong, gop trong RAM roi GHI DE ca sheet.
// Hau qua: ton cong ghi theo ca kho, va moi thao tac Luu/An anh bam TRONG luc
// sync dang chay deu bi ban ghi cu de len. Gio chi them dong moi o cuoi, sua
// dung o can sua theo URL, va xoa dong cu bang deleteDimension.
// Thu tu dong tren sheet KHONG con la moi nhat truoc - trang web tu sap xep
// theo timestamp nen khong anh huong hien thi.

const NEWS_WRITE_CHUNK = 1000;

function sheetsClient() {
  return google.sheets({ version: 'v4', auth: getAuthClient() });
}

function nowVN(): string {
  return new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/**
 * Them bai moi vao CUOI sheet, danh dau cot I = PENDING de luot tom tat xu ly sau.
 * values.append tu noi luoi (khac values.update) nen khong can ensureRowCapacity.
 */
export async function appendNewsToSheet(items: NewsItem[], sheetName: string): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return;
  const sheets = sheetsClient();

  const values = items.map(item => [
    item.title,
    item.summary,
    item.url,
    item.date,
    item.thumbnail,
    item.timestamp.toString(),
    item.isHidden ? 'TRUE' : 'FALSE',
    item.isSaved ? 'TRUE' : 'FALSE',
    SUMMARY_PENDING,
  ]);

  for (let i = 0; i < values.length; i += NEWS_WRITE_CHUNK) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:I`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: values.slice(i, i + NEWS_WRITE_CHUNK) },
    });
  }

  // Heartbeat + tieu de cot I trong cung mot lenh. Loi o day khong duoc lam
  // hong luot ghi vua xong.
  try {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          { range: `${sheetName}!Z1`, values: [[nowVN()]] },
          { range: `${sheetName}!I1`, values: [['summaryStatus']] },
        ],
      },
    });
  } catch (heartbeatError) {
    console.error(`[GoogleSheets] WARNING: Heartbeat update failed for ${sheetName}:`, heartbeatError);
  }

  console.log(`[GoogleSheets] ${sheetName}: đã thêm ${values.length} bài mới (append).`);
}

/** Doc cac cot can de lap ke hoach (URL, timestamp, da luu, trang thai tom tat) */
export async function readNewsRowRefs(sheetName: string): Promise<NewsRowRef[]> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return [];

  const res = await sheetsClient().spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [`${sheetName}!C2:C`, `${sheetName}!F2:F`, `${sheetName}!H2:H`, `${sheetName}!I2:I`],
    majorDimension: 'COLUMNS',
  });
  const col = (i: number): string[] => (res.data.valueRanges?.[i]?.values?.[0] as string[]) || [];
  const [urls, stamps, saved, status] = [col(0), col(1), col(2), col(3)];

  const refs: NewsRowRef[] = [];
  for (let i = 0; i < urls.length; i++) {
    const url = (urls[i] || '').trim();
    if (!url) continue;
    refs.push({
      row: i + 2,
      url,
      timestamp: stamps[i] ? parseInt(stamps[i], 10) : 0,
      isSaved: saved[i] === 'TRUE',
      status: status[i] || '',
    });
  }
  return refs;
}

export interface SummaryUpdate {
  url: string;
  status: string;
  summary?: string;
  thumbnail?: string;
}

/**
 * Ghi ket qua tom tat theo URL. Doc lai cot URL NGAY truoc khi ghi de lay so
 * dong moi nhat - phong truong hop dong da bi dich do mot luot cat tia.
 * Tra ve so bai da ghi.
 */
export async function updateNewsSummaries(sheetName: string, updates: SummaryUpdate[]): Promise<number> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId || updates.length === 0) return 0;
  const sheets = sheetsClient();

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!C2:C`, majorDimension: 'COLUMNS' });
  const urls = (res.data.values?.[0] as string[]) || [];
  const rowByUrl = new Map<string, number>();
  urls.forEach((u, i) => { if (u) rowByUrl.set(u.trim(), i + 2); });

  const data: { range: string; values: string[][] }[] = [];
  let written = 0;
  for (const u of updates) {
    const row = rowByUrl.get(u.url);
    if (!row) {
      console.warn(`[GoogleSheets] ${sheetName}: không còn thấy bài để ghi tóm tắt (đã bị cắt?): ${u.url}`);
      continue;
    }
    if (u.summary) data.push({ range: `${sheetName}!B${row}`, values: [[u.summary]] });
    if (u.thumbnail) data.push({ range: `${sheetName}!E${row}`, values: [[u.thumbnail]] });
    data.push({ range: `${sheetName}!I${row}`, values: [[u.status]] });
    written++;
  }
  if (data.length === 0) return 0;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data },
  });
  return written;
}

/**
 * Cat sheet ve `maxRows` bai khi vuot `maxRows + slack`. Khong bao gio xoa bai
 * da Luu. Tra ve so dong da xoa.
 */
export async function trimNewsSheet(sheetName: string, maxRows: number, slack: number): Promise<number> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return 0;

  const refs = await readNewsRowRefs(sheetName);
  const toDelete = planTrim(refs, maxRows, slack);
  if (toDelete.length === 0) return 0;

  const sheets = sheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' });
  const sheetId = meta.data.sheets?.find(sh => sh.properties?.title === sheetName)?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) {
    throw new Error(`Không tìm thấy sheet ${sheetName} để cắt bớt`);
  }

  // toDeleteRanges da xep tu duoi len -> cac lenh xoa trong cung batch khong
  // lam lech chi so cua nhau
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: toDeleteRanges(toDelete).map(r => ({
        deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: r.startIndex, endIndex: r.endIndex } },
      })),
    },
  });

  console.log(`[GoogleSheets] ${sheetName}: đã xoá ${toDelete.length} bài cũ nhất (giữ bài đã lưu, trần ${maxRows}).`);
  return toDelete.length;
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
  usdVnd: string;      // Cot H - ty gia luc chup. Dong cu khong co -> rong
}

/** Một điểm trên biểu đồ: giá chốt của một sản phẩm trong một ngày */
export interface GoldHistoryPoint {
  day: string;   // "17/4/2026"
  buy: number;
  sell: number;
}

/** Giá vàng thế giới chốt theo ngày, kèm quy đổi về VNĐ/chỉ */
export interface GoldWorldPoint {
  day: string;
  usd: number;      // USD/oz - gia goc
  vnd: number;      // VND/chi - quy doi theo ty gia cua chinh ngay do
  usdVnd: number;   // Ty gia da dung
}

/** Một lần lấy dữ liệu (snapshot) - dùng cho bảng biến động trong ngày */
export interface GoldIntradaySnapshot {
  day: string;        // "23/9/2026"
  time: string;       // "08:28:07"
  ts: number;         // để sắp xếp
  itemCount: number;  // số mặt hàng lấy được lần đó - ít hơn bình thường = có nguồn lỗi
  brands: Record<string, { buy: number; sell: number }>;
  worldUsd: number;
  worldVnd: number;
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
// Số ngày đưa vào bảng "từng lần trong ngày". Mỗi ngày có thể có tới ~144 lần
// lấy nếu chạy 10 phút/lần, nên phải chặn để payload gửi xuống client không phình.
const MAX_INTRADAY_DAYS = 7;

/**
 * Cột date được ghi bằng toLocaleString('vi-VN') -> "HH:MM:SS D/M/YYYY"
 * (GIỜ đứng trước NGÀY). Lấy token chứa '/' mới ra phần ngày.
 */
export function extractDay(date: string): string {
  return date.split(' ').find(part => part.includes('/')) || date;
}


/** "08:28:07 23/9/2026" -> "08:28:07" */
export function extractTime(date: string): string {
  return date.split(' ').find(part => part.includes(':')) || '';
}

/** "08:28:07 23/9/2026" -> timestamp đầy đủ (dùng để sắp xếp các lần lấy) */
export function sheetDateToTimestamp(date: string): number {
  const base = dayToTimestamp(extractDay(date));
  const [h = 0, m = 0, sec = 0] = extractTime(date).split(':').map(Number);
  return base + ((h * 3600) + (m * 60) + sec) * 1000;
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
      snapshot.usdVnd.toString(),
    ]);

    if (values.length > 0) {
      // Append to sheet (keeps history)
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:H`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values,
        },
      });
    }

    // Update Heartbeat + nhat ky loi nguon.
    // Ghi loi vao sheet vi log cua GitHub Actions can quyen truy cap moi doc duoc,
    // con sheet thi luc nao cung doc duoc - de chan doan nguon nao hong tren CI.
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!Y1:Z1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            snapshot.sourceErrors.length > 0
              ? `${fetchTime} | ${snapshot.sourceErrors.join(' || ')}`
              : `${fetchTime} | OK (${snapshot.items.length} mặt hàng)`,
            fetchTime,
          ]],
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
  const worldByDay = new Map<string, { usd: number; usdVnd: number }>();

  for (const row of rows) {
    if (!row.name) continue;

    const usd = toNumber(row.worldPrice);
    if (usd > 0) {
      worldByDay.set(extractDay(row.date), { usd, usdVnd: toNumber(row.usdVnd) });
    }
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

  // Dong cu (truoc 23/9/2026) chua co cot ty gia -> dung ty gia gan nhat co duoc
  const latestRate = Array.from(worldByDay.values()).reduce(
    (acc, v) => (v.usdVnd > 0 ? v.usdVnd : acc), 0);

  const world = Array.from(worldByDay.entries())
    .map(([day, v]) => {
      const rate = v.usdVnd > 0 ? v.usdVnd : latestRate;
      return { day, usd: v.usd, vnd: worldToVndPerChi(v.usd, rate), usdVnd: rate };
    })
    .slice(-MAX_HISTORY_DAYS);

  return { series, world };
}

/**
 * Moc lan lay gia vang gan nhat (o Z1 - chi duoc ghi SAU KHI append thanh cong),
 * dang epoch ms. null = chua co / doc loi -> caller coi nhu den han lay.
 */
export async function getGoldLastFetchEpoch(sheetName: string = 'GoldPrice'): Promise<number | null> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return null;
  try {
    const res = await sheetsClient().spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!Z1` });
    return vnDateTimeToEpoch(res.data.values?.[0]?.[0]);
  } catch (error) {
    console.error(`[GoogleSheets] Không đọc được mốc lấy giá vàng gần nhất (${sheetName}!Z1):`, error);
    return null;
  }
}

/** Doc nhat ky loi nguon gia vang (o Y1) - dung de chan doan su co tren CI */
export async function getGoldSyncLog(sheetName: string = 'GoldPrice'): Promise<string> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return '';
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuthClient() });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!Y1`,
    });
    return res.data.values?.[0]?.[0] || '(chưa có)';
  } catch (error) {
    console.error('Error reading gold sync log:', error);
    return '';
  }
}

/**
 * Gom cac dong thanh tung LAN LAY (snapshot), chi giu dai dien moi nha.
 * Khac buildSeries: khong gop theo ngay, giu nguyen moc gio de thay bien dong
 * giua cac lan quet.
 */
function buildIntraday(rows: GoldPriceRow[]): GoldIntradaySnapshot[] {
  const bySnapshot = new Map<string, GoldIntradaySnapshot>();
  // Ty gia gan nhat, dung cho dong cu chua co cot H
  let latestRate = 0;
  rows.forEach(r => { const v = toNumber(r.usdVnd); if (v > 0) latestRate = v; });

  for (const row of rows) {
    if (!row.date || !row.name) continue;

    let snap = bySnapshot.get(row.date);
    if (!snap) {
      snap = {
        day: extractDay(row.date),
        time: extractTime(row.date),
        ts: sheetDateToTimestamp(row.date),
        itemCount: 0,
        brands: {},
        worldUsd: 0,
        worldVnd: 0,
      };
      bySnapshot.set(row.date, snap);
    }
    snap.itemCount++;

    const usd = toNumber(row.worldPrice);
    if (usd > 0 && snap.worldUsd === 0) {
      const rate = toNumber(row.usdVnd) || latestRate;
      snap.worldUsd = usd;
      snap.worldVnd = worldToVndPerChi(usd, rate);
    }

    // Chi giu mat hang dai dien cua moi nha
    const brand = row.brand;
    if ((BRAND_SECTIONS as readonly string[]).includes(brand) && BRAND_REPRESENTATIVE[brand] === row.name) {
      snap.brands[brand] = { buy: toNumber(row.buyPrice), sell: toNumber(row.sellPrice) };
    }
  }

  const all = Array.from(bySnapshot.values()).sort((a, b) => a.ts - b.ts);
  // Chi giu N ngay gan nhat
  const days = Array.from(new Set(all.map(s => s.day))).slice(-MAX_INTRADAY_DAYS);
  const keep = new Set(days);
  return all.filter(s => keep.has(s.day));
}

/**
 * Get the LATEST gold prices from sheet (most recent snapshot) + chuỗi lịch sử đã gộp theo ngày.
 * Chỉ trả về dữ liệu đã tổng hợp, không đẩy toàn bộ raw history xuống client.
 */
export async function getLatestGoldPricesFromSheets(sheetName: string = 'GoldPrice'): Promise<{ prices: GoldPriceRow[], series: GoldSeries[], world: GoldWorldPoint[], intraday: GoldIntradaySnapshot[], heartbeat?: string }> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return { prices: [], series: [], world: [], intraday: [] };

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
      ranges: [`${sheetName}!A${startRow}:H`, `${sheetName}!Z1`],
    });

    const rows = response.data.valueRanges?.[0].values;
    const heartbeatRow = response.data.valueRanges?.[1].values;
    const heartbeat = heartbeatRow?.[0]?.[0];

    if (!rows || rows.length === 0) {
      console.log(`[GoogleSheets] No gold price data found in ${sheetName}.`);
      return { prices: [], series: [], world: [], intraday: [], heartbeat };
    }

    const allPrices: GoldPriceRow[] = rows.map((row) => ({
      date: row[0] || '',
      brand: row[1] || '',
      name: row[2] || '',
      buyPrice: row[3] || '0',
      sellPrice: row[4] || '0',
      worldPrice: row[5] || '0',
      timestamp: row[6] || '0',
      usdVnd: row[7] || '',
    }));

    // Snapshot mới nhất = các dòng có cùng mốc thời gian với dòng cuối
    const latestDate = allPrices[allPrices.length - 1].date;
    const latestPrices = allPrices.filter(p => p.date === latestDate);
    const { series, world } = buildSeries(allPrices);
    const intraday = buildIntraday(allPrices);

    console.log(`[GoogleSheets] Gold: ${latestPrices.length} dòng mới nhất (${latestDate}), ${allPrices.length} dòng lịch sử (từ row ${startRow}/${filledRows}), ${series.length} chuỗi sản phẩm, ${world.length} ngày giá thế giới, ${intraday.length} lần lấy.`);
    return { prices: latestPrices, series, world, intraday, heartbeat };
  } catch (error) {
    console.error(`Error fetching gold prices from ${sheetName}:`, error);
    return { prices: [], series: [], world: [], intraday: [] };
  }
}
