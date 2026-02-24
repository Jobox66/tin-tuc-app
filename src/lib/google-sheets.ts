import { google } from 'googleapis';

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

function getAuthClient() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error('Google Sheets configuration missing: GOOGLE_PRIVATE_KEY or GOOGLE_SERVICE_ACCOUNT_EMAIL');
  }

  // Robust formatting for private key
  const formattedKey = privateKey
    .replace(/^"|"$/g, '') // Remove surrounding quotes
    .replace(/\\n/g, '\n'); // Replace literal \n with real newline

  return new google.auth.JWT({
    email: clientEmail,
    key: formattedKey,
    scopes: SCOPES,
  });
}

export async function getNewsFromSheets(sheetName: string = 'Sheet1'): Promise<NewsItem[]> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return [];

  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    console.log(`Fetching data from Google Sheets: ${sheetName}!A2:H...`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:H`,
    });
    console.log(`Google Sheets API response received for ${sheetName}.`);

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log(`No data found in ${sheetName}.`);
      return [];
    }

    return rows.map((row) => ({
      title: row[0] || '',
      summary: row[1] || '',
      url: row[2] || '',
      date: row[3] || '',
      thumbnail: row[4] || '',
      timestamp: row[5] ? parseInt(row[5], 10) : 0,
      isHidden: row[6] === 'TRUE',
      isSaved: row[7] === 'TRUE',
    }));
  } catch (error) {
    console.error(`Error fetching data from ${sheetName}:`, error);
    return [];
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
      console.log(`Successfully saved ${values.length} news items to ${sheetName} (including Hidden/Saved status).`);
    }
  } catch (error) {
    console.error(`Error saving data to ${sheetName}:`, error);
    throw error;
  }
}
