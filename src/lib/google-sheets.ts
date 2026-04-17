import { google } from 'googleapis';
import { GoldPriceItem, GoldPriceSnapshot } from './gold-price';

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
  let formattedKey = privateKey
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

export async function saveNewsToSheets(newsItems: NewsItem[], sheetName: string = 'Sheet1'): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return;

  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Clear existing data (A2:H)
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A2:H`,
    });

    // 2. Prepare values
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

    // 3. Update sheet
    if (values.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A2:H`,
        valueInputOption: 'RAW',
        requestBody: {
          values,
        },
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
 * Get the LATEST gold prices from sheet (most recent snapshot)
 */
export async function getLatestGoldPricesFromSheets(sheetName: string = 'GoldPrice'): Promise<{ prices: GoldPriceRow[], history: GoldPriceRow[], heartbeat?: string }> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return { prices: [], history: [] };

  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [`${sheetName}!A2:G`, `${sheetName}!Z1`],
    });

    const rows = response.data.valueRanges?.[0].values;
    const heartbeatRow = response.data.valueRanges?.[1].values;
    const heartbeat = heartbeatRow?.[0]?.[0];

    if (!rows || rows.length === 0) {
      console.log(`[GoogleSheets] No gold price data found in ${sheetName}.`);
      return { prices: [], history: [], heartbeat };
    }

    // Get the latest timestamp group (last N rows with same date)
    const allPrices: GoldPriceRow[] = rows.map((row) => ({
      date: row[0] || '',
      brand: row[1] || '',
      name: row[2] || '',
      buyPrice: row[3] || '0',
      sellPrice: row[4] || '0',
      worldPrice: row[5] || '0',
      timestamp: row[6] || '0',
    }));

    // Find the latest date/time and filter for only that snapshot
    // Sort array by timestamp or assume it is stored chronologically
    const latestDate = allPrices[allPrices.length - 1].date;
    const latestPrices = allPrices.filter(p => p.date === latestDate);

    console.log(`[GoogleSheets] Found ${latestPrices.length} latest gold prices (${latestDate}), and ${allPrices.length} total history records.`);
    return { prices: latestPrices, history: allPrices, heartbeat };
  } catch (error) {
    console.error(`Error fetching gold prices from ${sheetName}:`, error);
    return { prices: [], history: [] };
  }
}
