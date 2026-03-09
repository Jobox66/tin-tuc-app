import { aggregateNews, GENERAL_SOURCES, FINANCE_SOURCES, INTERNATIONAL_SOURCES, INTL_FINANCE_SOURCES, INTL_TECH_SOURCES, NewsSource } from '../lib/aggregator';
import { saveNewsToSheets, getNewsFromSheets, updateHeartbeatOnly, NewsItem } from '../lib/google-sheets';

const SYNC_VERSION = "2026-03-09-v4";

// ============= STEP 0: Validate Environment =============
function validateEnv() {
    console.log(`\n🔧 [v${SYNC_VERSION}] Validating environment...`);
    const required = ['GOOGLE_SHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY'];
    const missing: string[] = [];

    for (const key of required) {
        const val = process.env[key];
        if (!val) {
            missing.push(key);
            console.error(`❌ MISSING env var: ${key}`);
        } else {
            // Log length and first/last chars for debugging (safe, no secrets leaked)
            console.log(`✅ ${key}: Set (length=${val.length}, starts="${val.substring(0, 10)}...", ends="...${val.substring(val.length - 10)}")`);
        }
    }

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}. Check GitHub Secrets configuration.`);
    }

    // Extra validation for GOOGLE_PRIVATE_KEY format
    const key = process.env.GOOGLE_PRIVATE_KEY!;
    if (!key.includes('PRIVATE KEY')) {
        console.warn(`⚠️ WARNING: GOOGLE_PRIVATE_KEY does not contain 'PRIVATE KEY' header. It may be malformed.`);
    }

    console.log(`✅ All environment variables validated.\n`);
}

// ============= MAIN SYNC LOGIC =============
async function syncCategory(name: string, sources: NewsSource[], sheetName: string) {
    console.log(`\n🚀 [v${SYNC_VERSION}] Starting News Sync for Category: ${name} (${sheetName})...`);

    // 1. Fetch existing news from Google Sheets
    console.log(`📖 Step 1: Fetching existing news from ${sheetName}...`);
    const response = await getNewsFromSheets(sheetName);
    const existingNews = response.news;
    console.log(`   Found ${existingNews.length} existing news items in ${sheetName}.`);
    if (existingNews.length > 0) {
        console.log(`   Sample Existing URL: ${existingNews[0].url}`);
    }
    const existingUrls = existingNews.map(n => n.url.trim());

    // 2. Aggregate new news (passing existingUrls to skip re-summarizing)
    console.log(`🌐 Step 2: Aggregating new news from ${sources.length} sources...`);
    const newNews = await aggregateNews(sources, existingUrls);
    console.log(`   ✅ Aggregated ${newNews.length} NEW news items for ${name}.`);

    if (newNews.length === 0) {
        console.log(`   No new items for ${name}. Updating heartbeat only...`);
        await updateHeartbeatOnly(sheetName);
        console.log(`   ✅ Heartbeat updated for ${name}. No data rewrite needed.`);
        return;
    }

    // 3. Merge, deduplicate and sort
    console.log(`🔀 Step 3: Merging ${existingNews.length} existing + ${newNews.length} new items...`);
    const newsMap = new Map<string, NewsItem>();

    existingNews.forEach(item => newsMap.set(item.url.trim(), item));
    newNews.forEach(item => {
        const url = item.url.trim();
        if (!newsMap.has(url)) {
            console.log(`   [${name}] ➕ Adding NEW: ${item.title}`);
        } else {
            console.log(`   [${name}] 🔄 Updating: ${item.title}`);
        }
        newsMap.set(url, { ...item, url });
    });

    const mergedNews = Array.from(newsMap.values());

    // Sort by timestamp descending (newest first)
    mergedNews.sort((a, b) => {
        const timeA = isNaN(a.timestamp) ? 0 : a.timestamp;
        const timeB = isNaN(b.timestamp) ? 0 : b.timestamp;
        return timeB - timeA;
    });

    // Limit to 500 items
    const finalNews = mergedNews.slice(0, 500);
    console.log(`   Total after merge: ${finalNews.length} items.`);

    // 4. Save back to Google Sheets
    console.log(`💾 Step 4: Saving to Google Sheets (${sheetName})...`);
    await saveNewsToSheets(finalNews, sheetName);
    console.log(`🎉 Sync Complete for ${name}!`);
}

// ============= ENTRY POINT =============
async function sync() {
    const failedCategories: string[] = [];

    try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📰 NEWS SYNC STARTED at ${new Date().toISOString()}`);
        console.log(`${'='.repeat(60)}`);

        // Step 0: Validate
        validateEnv();

        // Define all categories
        const categories: { name: string; sources: NewsSource[]; sheet: string }[] = [
            { name: 'General', sources: GENERAL_SOURCES, sheet: 'Sheet1' },
            { name: 'Finance', sources: FINANCE_SOURCES, sheet: 'Finance' },
            { name: 'International', sources: INTERNATIONAL_SOURCES, sheet: 'International' },
            { name: 'IntlFinance', sources: INTL_FINANCE_SOURCES, sheet: 'IntlFinance' },
            { name: 'IntlTech', sources: INTL_TECH_SOURCES, sheet: 'IntlTech' },
        ];

        // Sync each category independently
        for (const cat of categories) {
            try {
                await syncCategory(cat.name, cat.sources, cat.sheet);
            } catch (catError) {
                console.error(`\n❌ Category ${cat.name} FAILED:`, catError);
                failedCategories.push(cat.name);
            }
        }

        console.log(`\n${'='.repeat(60)}`);
        if (failedCategories.length > 0) {
            console.warn(`⚠️ SYNC PARTIAL - Failed categories: ${failedCategories.join(', ')}`);
            console.log(`${'='.repeat(60)}\n`);
            // Don't exit(1) for partial failures - other categories succeeded
        } else {
            console.log(`✅ ALL SYNC COMPLETE at ${new Date().toISOString()}`);
            console.log(`${'='.repeat(60)}\n`);
        }

    } catch (error) {
        console.error(`\n${'='.repeat(60)}`);
        console.error(`❌ SYNC FAILED at ${new Date().toISOString()}`);
        console.error(`${'='.repeat(60)}`);
        console.error(error);

        // EXIT WITH ERROR CODE so GitHub Actions shows RED
        process.exit(1);
    }
}

sync();
