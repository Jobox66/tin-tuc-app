import { aggregateNews } from '../lib/aggregator';
import { saveNewsToSheets, getNewsFromSheets, NewsItem } from '../lib/google-sheets';

async function sync() {
    console.log('🚀 Starting News Sync Process...');

    try {
        // 1. Fetch existing news from Google Sheets
        console.log('Fetching existing news from Google Sheets...');
        const existingNews = await getNewsFromSheets();
        console.log(`Found ${existingNews.length} existing news items.`);

        // 2. Aggregate new news
        const newNews = await aggregateNews();
        console.log(`✅ Aggregated ${newNews.length} new news items.`);

        // 3. Merge, deduplicate and sort
        // We use URL as the unique identifier
        const newsMap = new Map<string, NewsItem>();

        // Add existing first
        existingNews.forEach(item => newsMap.set(item.url, item));
        // Add new ones (overwrites duplicates with newer summaries if needed, or just keeps uniqueness)
        newNews.forEach(item => newsMap.set(item.url, item));

        const mergedNews = Array.from(newsMap.values());

        // Sort by timestamp descending (newest first)
        mergedNews.sort((a, b) => b.timestamp - a.timestamp);

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
