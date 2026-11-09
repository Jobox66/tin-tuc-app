import { summarizeWithPython, runPool, SUMMARIZER_CONCURRENCY } from '../lib/aggregator';
import { CATEGORIES, SHEETS, Category, collectCategory } from '../lib/news-sync';
import {
    readNewsRowRefs, updateNewsSummaries, trimNewsSheet,
    saveGoldPricesToSheets, getGoldLastFetchEpoch, SummaryUpdate,
} from '../lib/google-sheets';
import { fetchGoldPrices, deadSources, degradedSources } from '../lib/gold-price';
import { isGoldFetchDue, selectPendingSummaries, nextSummaryStatus } from '../lib/sync-plan';

const SYNC_VERSION = "2026-11-06-v6.1";

// Tran so bai giu lai moi sheet. Chi cat khi vuot them TRIM_SLACK bai de khong
// phai xoa dong lat nhat o moi luot. Bai da Luu khong bao gio bi cat.
const MAX_ITEMS_PER_SHEET = 5000;
const TRIM_SLACK = 100;

// So bai toi da duoc tom tat moi sheet moi luot. Bai con lai giu PENDING, luot
// sau lam tiep - de mot dot ton dong (vd sau khi trigger chet nhieu gio) khong
// keo mot luot ra qua timeout cua workflow.
const MAX_SUMMARIES_PER_RUN = 120;

// Nhip lay gia vang. Mac dinh 0 = LUOT NAO CUNG LAY (anh muon quet nhanh, 06/11).
// An toan ve dung luong vi gia vang gio ghi THEO THAY DOI: gia khong doi thi chi
// ghi de moc gio, khong them dong (xem planGoldWrites). Dat bien moi truong
// GOLD_MIN_INTERVAL_MINUTES > 0 neu muon thua lai. --force-gold de bo qua nhip.
const GOLD_MIN_INTERVAL_MIN = Number(process.env.GOLD_MIN_INTERVAL_MINUTES ?? 0);
const FORCE_GOLD = process.argv.includes('--force-gold');

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
/** LUOT CHAM: tom tat cac bai PENDING/RETRY roi ghi lai dung o theo URL */
async function summarizeCategory(cat: Category): Promise<void> {
    const pending = selectPendingSummaries(await readNewsRowRefs(cat.sheet), MAX_SUMMARIES_PER_RUN);
    if (pending.length === 0) {
        console.log(`🧠 ${cat.name}: không có bài chờ tóm tắt.`);
        return;
    }

    console.log(`🧠 ${cat.name}: tóm tắt ${pending.length} bài (song song ${SUMMARIZER_CONCURRENCY})...`);
    const startedAt = Date.now();
    const results = await runPool(pending, SUMMARIZER_CONCURRENCY, ref => summarizeWithPython(ref.url));

    const updates: SummaryUpdate[] = pending.map((ref, i) => {
        const result = results[i];
        const ok = !!result?.summary;
        return {
            url: ref.url,
            status: nextSummaryStatus(ref.status, ok),
            summary: ok ? result!.summary : undefined,
            thumbnail: ok ? result!.image || undefined : undefined,
        };
    });
    const written = await updateNewsSummaries(cat.sheet, updates);
    const failedCount = updates.filter(u => !u.summary).length;
    console.log(`🧠 ${cat.name}: ghi ${written} kết quả (${failedCount} bài không tóm tắt được, giữ tóm tắt RSS) trong ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`);
}

// ============= MAIN GOLD SYNC LOGIC =============
async function syncGold(): Promise<void> {
    if (!FORCE_GOLD && GOLD_MIN_INTERVAL_MIN > 0) {
        const last = await getGoldLastFetchEpoch(SHEETS.gold);
        if (!isGoldFetchDue(last, Date.now(), GOLD_MIN_INTERVAL_MIN * 60_000)) {
            const ago = Math.round((Date.now() - last!) / 60_000);
            console.log(`\n🥇 Bỏ qua giá vàng: lần lấy gần nhất cách đây ${ago} phút (nhịp ${GOLD_MIN_INTERVAL_MIN} phút).`);
            return;
        }
    }

    console.log(`\n🚀 [v${SYNC_VERSION}] Starting Gold Price Sync...`);
    const snapshot = await fetchGoldPrices();
    if (snapshot.items.length === 0) {
        throw new Error('Không lấy được mặt hàng vàng nào từ bất kỳ nguồn nào.');
    }
    await saveGoldPricesToSheets(snapshot, SHEETS.gold);

    // Nguon tuy chon thieu: canh bao that ro nhung khong lam do workflow,
    // neu khong thi luot nao cung do va canh bao mat tac dung.
    const degraded = degradedSources(snapshot);
    if (degraded.length > 0) {
        console.warn(`⚠️ THIẾU NGUỒN TUỲ CHỌN: ${degraded.join(', ')} - đã lưu ${snapshot.items.length} mặt hàng lấy được. Xem ô Y1 của sheet ${SHEETS.gold} để biết lý do.`);
    }

    // Nguon bat buoc thieu thi coi nhu luot sync hong.
    const dead = deadSources(snapshot);
    if (dead.length > 0) {
        throw new Error(`Thiếu nguồn giá vàng bắt buộc: ${dead.join(', ')} (đã lưu phần lấy được)`);
    }

    console.log(`🎉 Gold Sync Complete!${degraded.length > 0 ? ` (thiếu ${degraded.join(', ')})` : ''}`);
}

// ============= ENTRY POINT =============
async function sync() {
    const failed: string[] = [];
    const step = async (label: string, fn: () => Promise<unknown>) => {
        try {
            await fn();
        } catch (err) {
            console.error(`\n❌ ${label} FAILED:`, err);
            failed.push(label);
        }
    };

    try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📰 NEWS SYNC STARTED at ${new Date().toISOString()}`);
        console.log(`${'='.repeat(60)}`);

        validateEnv();

        const categories: Category[] = CATEGORIES;

        // Gia vang ghi sheet rieng -> chay SONG SONG voi phan tin. Truoc day no
        // chay truoc va bat tin phai cho het phan cho BTMC.
        const goldTask = step('GoldPrice', syncGold);

        // 1. Luot nhanh: tin len sheet ngay. Tu 06/11/2026 luot nay chu yeu chay
        // tren Vercel (/api/sync); o day giu lai lam DU PHONG - bai da co thi bo
        // qua, con neu hai ben trung luc them cung mot bai thi buoc don dep o duoi
        // se xoa ban trung.
        const t0 = Date.now();
        const sinceTs = TODAY_ONLY ? startOfTodayVN() : 0;
        for (const cat of categories) await step(`${cat.name}: lấy tin`, () => collectCategory(cat, sinceTs));
        console.log(`\n⏱️ Tin mới đã lên sheet sau ${((Date.now() - t0) / 1000).toFixed(1)}s.`);

        // 2. Luot cham: tom tat. 3. Cat tia - lam SAU tom tat de khong lam dich
        // dong giua luc doc va ghi ket qua tom tat.
        for (const cat of categories) await step(`${cat.name}: tóm tắt`, () => summarizeCategory(cat));
        for (const cat of categories) await step(`${cat.name}: dọn trùng + cắt bớt`, () => trimNewsSheet(cat.sheet, MAX_ITEMS_PER_SHEET, TRIM_SLACK));

        await goldTask;

        console.log(`\n${'='.repeat(60)}`);
        if (failed.length > 0) {
            console.warn(`⚠️ SYNC PARTIAL - Failed: ${failed.join(', ')}`);
            console.log(`${'='.repeat(60)}\n`);
            // Báo ĐỎ. Trước đây partial failure vẫn exit 0 nên GitHub báo xanh:
            // BTMC chết từ 19/9 đến 23/9 qua 30 lượt chạy mà không ai biết.
            // Dữ liệu của các mục thành công VẪN đã được ghi trước khi thoát.
            process.exit(1);
        } else {
            console.log(`✅ ALL SYNC COMPLETE at ${new Date().toISOString()} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
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
