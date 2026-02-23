import { getNewsFromSheets } from './src/lib/google-sheets';

async function test() {
    console.log('--- Testing Google Sheets Connection ---');
    console.log('Checking Environment Variables:');
    console.log('- GOOGLE_SHEET_ID:', process.env.GOOGLE_SHEET_ID ? 'Set' : 'MISSING');
    console.log('- GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'Set' : 'MISSING');
    console.log('- GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? `Set (Length: ${process.env.GOOGLE_PRIVATE_KEY.length})` : 'MISSING');

    if (process.env.GOOGLE_PRIVATE_KEY) {
        const key = process.env.GOOGLE_PRIVATE_KEY;
        console.log('- Key starts with:', key.substring(0, 20));
        console.log('- Key ends with:', key.substring(key.length - 20));
        if (!key.includes('BEGIN PRIVATE KEY')) {
            console.warn('WARNING: Key does not contain "BEGIN PRIVATE KEY" header.');
        }
    }

    try {
        const news = await getNewsFromSheets();
        console.log(`Success! Found ${news.length} news items.`);
        if (news.length > 0) {
            console.log('Sample Data Structure:');
            console.log(JSON.stringify(news[0], null, 2));
        } else {
            console.log('No items found. Please ensure:');
            console.log('1. Sheet1 exists.');
            console.log('2. Data starts from row 2 (row 1 is header).');
            console.log('3. Columns are: Title, Summary, URL, Date, Thumbnail.');
        }
    } catch (error) {
        console.error('Test Failed:', error);
    }
}

test();
