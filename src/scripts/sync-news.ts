import { aggregateNews } from '../lib/aggregator';
import { saveNewsToSheets, getNewsFromSheets, NewsItem } from '../lib/google-sheets';

async function sync() {
    console.log('🚀 Starting News Sync Process...');

    try {
        // 1. Fetch existing news from Google Sheets
        console.log('Fetching existing news from Google Sheets...');
        const existingNews = await getNewsFromSheets();
        console.log(`Found ${existingNews.length} existing news items.`);
        const existingUrls = existingNews.map(n => n.url);

        // 2. Aggregate new news (passing existingUrls to skip re-summarizing)
        const newNews = await aggregateNews(existingUrls);
        console.log(`✅ Aggregated ${newNews.length} NEW news items (excluding existing).`);

        // 3. Merge, deduplicate and sort
        const newsMap = new Map<string, NewsItem>();

        // Add existing first
        existingNews.forEach(item => newsMap.set(item.url, item));
        // Add new ones
        newNews.forEach(item => {
            if (!newsMap.has(item.url)) {
                console.log(`Adding NEW item: ${item.title}`);
            }
            newsMap.set(item.url, item);
        });

        const mergedNews = Array.from(newsMap.values());

        // Sort by timestamp descending (newest first). Handle NaN cases.
        mergedNews.sort((a, b) => {
            const timeA = isNaN(a.timestamp) ? 0 : a.timestamp;
            const timeB = isNaN(b.timestamp) ? 0 : b.timestamp;
            return timeB - timeA;
        });

        // Limit to 500 items to keep Google Sheets manageable
        const finalNews = mergedNews.slice(0, 500);

        console.log(`Total news items after merge and sort: ${finalNews.length}`);

        // 4. Save back to Google Sheets
        await saveNewsToSheets(finalNews);
        console.log('🎉 Sync Complete! News have been updated in Google Sheets.');
    } catch (error) {
        console.error('❌ Sync Failed:', error);
        process.exit(1);
    }
}

sync();
