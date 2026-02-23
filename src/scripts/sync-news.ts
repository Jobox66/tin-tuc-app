import { aggregateNews } from '../lib/aggregator';
import { saveNewsToSheets } from '../lib/google-sheets';

async function sync() {
    console.log('🚀 Starting News Sync Process...');

    try {
        const news = await aggregateNews();
        console.log(`✅ Aggregated ${news.length} news items.`);

        await saveNewsToSheets(news);
        console.log('🎉 Sync Complete! News have been updated in Google Sheets.');
    } catch (error) {
        console.error('❌ Sync Failed:', error);
        process.exit(1);
    }
}

sync();
