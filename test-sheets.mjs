import { getNewsFromSheets } from './src/lib/google-sheets.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    console.log('--- Testing Google Sheets Connection ---');
    try {
        const news = await getNewsFromSheets();
        console.log(`Success! Found ${news.length} news items.`);
        if (news.length > 0) {
            console.log('First Item:', news[0]);
        } else {
            console.log('No items found. Check if the sheet has data starting from A2.');
        }
    } catch (error) {
        console.error('Test Failed:', error);
    }
}

test();
