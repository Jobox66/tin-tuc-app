import { aggregateNews, GENERAL_SOURCES, FINANCE_SOURCES, NewsSource } from '../lib/aggregator';
import { saveNewsToSheets, getNewsFromSheets, updateHeartbeatOnly, NewsItem, saveGoldPricesToSheets } from '../lib/google-sheets';
import { fetchGoldPrices, deadSources, degradedSources } from '../lib/gold-price';

const SYNC_VERSION = "2026-09-17-v5";

// Tran so bai giu lai moi sheet
const MAX_ITEMS_PER_SHEET = 5000;

// Chay `npm run sync:local -- --today` de backfill: chi lay bai dang trong ngay.
// Khong co co nay thi lay TAT CA bai chua co trong sheet.
const TODAY_ONLY = process.argv.includes('--today');

/** Moc 00:00 hom nay theo gio Viet Nam */
function startOfTodayVN(): number {
    const ymd = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    return new Date(`${ymd}T00:00:00+07:00`).getTime();
}

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
    const sinceTs = TODAY_ONLY ? startOfTodayVN() : 0;
    console.log(`🌐 Step 2: Aggregating new news from ${sources.length} sources${TODAY_ONLY ? ' (CHI TRONG NGAY HOM NAY)' : ' (lay het bai moi)'}...`);
    const newNews = await aggregateNews(sources, existingUrls, 100, 0, sinceTs);
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

    // Giu lai toi da MAX_ITEMS_PER_SHEET bai moi nhat
    const finalNews = mergedNews.slice(0, MAX_ITEMS_PER_SHEET);
    if (mergedNews.length > MAX_ITEMS_PER_SHEET) {
        console.log(`   ✂️ Cắt bớt ${mergedNews.length - MAX_ITEMS_PER_SHEET} bài cũ nhất (trần ${MAX_ITEMS_PER_SHEET}).`);
    }
    console.log(`   Total after merge: ${finalNews.length} items.`);

    // 4. Save back to Google Sheets
    console.log(`💾 Step 4: Saving to Google Sheets (${sheetName})...`);
    await saveNewsToSheets(finalNews, sheetName);
    console.log(`🎉 Sync Complete for ${name}!`);
}

// ============= MAIN GOLD SYNC LOGIC =============
async function syncGold() {
    console.log(`\n🚀 [v${SYNC_VERSION}] Starting Gold Price Sync...`);
    try {
        const snapshot = await fetchGoldPrices();
        if (snapshot.items.length > 0) {
            await saveGoldPricesToSheets(snapshot, 'GoldPrice');

            // Nguon tuy chon thieu: canh bao that ro nhung khong lam do workflow,
            // neu khong thi luot nao cung do va canh bao mat tac dung.
            const degraded = degradedSources(snapshot);
            if (degraded.length > 0) {
                console.warn(`⚠️ THIẾU NGUỒN TUỲ CHỌN: ${degraded.join(', ')} - đã lưu ${snapshot.items.length} mặt hàng lấy được. Xem ô Y1 của sheet GoldPrice để biết lý do.`);
            }

            // Nguon bat buoc thieu thi coi nhu luot sync hong.
            const dead = deadSources(snapshot);
            if (dead.length > 0) {
                throw new Error(`Thiếu nguồn giá vàng bắt buộc: ${dead.join(', ')} (đã lưu phần lấy được)`);
            }

            console.log(`🎉 Gold Sync Complete!${degraded.length > 0 ? ` (thiếu ${degraded.join(', ')})` : ''}`);
        } else {
            throw new Error('Không lấy được mặt hàng vàng nào từ bất kỳ nguồn nào.');
        }
    } catch (e) {
        console.error(`❌ Gold Sync FAILED:`, e);
        throw e;
    }
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

        // Run Gold Sync
        try {
            await syncGold();
        } catch (goldError) {
             console.error(`\n❌ Gold Sync FAILED:`, goldError);
             failedCategories.push('GoldPrice');
        }

        // Define all categories
        const categories: { name: string; sources: NewsSource[]; sheet: string }[] = [
            { name: 'General', sources: GENERAL_SOURCES, sheet: 'Sheet1' },
            { name: 'Finance', sources: FINANCE_SOURCES, sheet: 'Finance' },
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
            // Báo ĐỎ. Trước đây partial failure vẫn exit 0 nên GitHub báo xanh:
            // BTMC chết từ 19/9 đến 23/9 qua 30 lượt chạy mà không ai biết.
            // Dữ liệu của các mục thành công VẪN đã được ghi trước khi thoát.
            process.exit(1);
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
