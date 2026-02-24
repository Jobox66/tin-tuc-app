import { aggregateNews, GENERAL_SOURCES, FINANCE_SOURCES, NewsSource } from '../lib/aggregator';
import { saveNewsToSheets, getNewsFromSheets, NewsItem } from '../lib/google-sheets';

async function syncCategory(name: string, sources: NewsSource[], sheetName: string) {
    console.log(`\n🚀 Starting News Sync for Category: ${name} (${sheetName})...`);
    try {
        // 1. Fetch existing news from Google Sheets
        console.log(`Fetching existing news from ${sheetName}...`);
        const existingNews = await getNewsFromSheets(sheetName);
        console.log(`Found ${existingNews.length} existing news items in ${sheetName}.`);
        const existingUrls = existingNews.map(n => n.url);

        // 2. Aggregate new news (passing existingUrls to skip re-summarizing)
        const newNews = await aggregateNews(sources, existingUrls);
        console.log(`✅ Aggregated ${newNews.length} NEW news items for ${name}.`);

        if (newNews.length === 0) {
            console.log(`No new items for ${name}. Skipping update.`);
            return;
        }

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

        // Limit to 500 items 
        const finalNews = mergedNews.slice(0, 500);

        console.log(`Total news items for ${name} after merge: ${finalNews.length}`);

        // 4. Save back to Google Sheets
        await saveNewsToSheets(finalNews, sheetName);
        console.log(`🎉 Sync Complete for ${name}!`);
    } catch (error) {
        console.error(`❌ Sync Failed for ${name}:`, error);
    }
}

async function sync() {
    // Sync General Category
    await syncCategory('General', GENERAL_SOURCES, 'Sheet1');

    // Sync Finance Category
    await syncCategory('Finance', FINANCE_SOURCES, 'Finance');
}

sync();
