import { google } from 'googleapis';

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  date: string;
  thumbnail: string;
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

export async function getNewsFromSheets(): Promise<NewsItem[]> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!spreadsheetId || !privateKey || !clientEmail) {
    const missing = [];
    if (!spreadsheetId) missing.push('GOOGLE_SHEET_ID');
    if (!privateKey) missing.push('GOOGLE_PRIVATE_KEY');
    if (!clientEmail) missing.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    console.warn(`Google Sheets configuration missing: ${missing.join(', ')}`);
    return [];
  }

  // Handle both literal newlines and escaped \n
  const formattedKey = privateKey.includes('\n')
    ? privateKey
    : privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: formattedKey,
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    console.log('Fetching data from Google Sheets: A2:E...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A2:E',
    });
    console.log('Google Sheets API response received.');

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      console.log('No data found in Google Sheets.');
      return [];
    }

    return rows.map((row) => ({
      title: row[0] || '',
      summary: row[1] || '',
      url: row[2] || '',
      date: row[3] || '',
      thumbnail: row[4] || '',
    }));
  } catch (error) {
    console.error('Error fetching data from Google Sheets:', error);
    return [];
  }
}

export async function saveNewsToSheets(newsItems: NewsItem[]): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!spreadsheetId || !privateKey || !clientEmail) {
    console.warn('Google Sheets configuration missing. Cannot save news.');
    return;
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // 1. Clear existing data starting from A2
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Sheet1!A2:E',
    });

    // 2. Prepare values for update
    const values = newsItems.map(item => [
      item.title,
      item.summary,
      item.url,
      item.date,
      item.thumbnail
    ]);

    // 3. Update sheet with new data
    if (values.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A2:E',
        valueInputOption: 'RAW',
        requestBody: {
          values,
        },
      });
      console.log(`Successfully saved ${values.length} news items to Google Sheets.`);
    } else {
      console.log('No news items to save.');
    }
  } catch (error) {
    console.error('Error saving data to Google Sheets:', error);
    throw error;
  }
}
