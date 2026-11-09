/**
 * LUOT NHANH lay tin - dung chung cho:
 *  - script GitHub Actions (src/scripts/sync-news.ts) - chay du phong + tom tat
 *  - route Vercel /api/sync - cron-job.org goi moi vai phut (06/11/2026)
 * Chi doc RSS va them bai moi vao sheet, KHONG goi Python, nen chay duoc tren Vercel.
 */
import { collectNewArticles, GENERAL_SOURCES, FINANCE_SOURCES, NewsSource } from './aggregator';
import { appendNewsToSheet, readNewsRowRefs, updateHeartbeatOnly } from './google-sheets';

export interface Category { name: string; sources: NewsSource[]; sheet: string }

// Cho phep tro sang sheet tam de chay thu ca luong ma khong dung du lieu that.
export const SHEETS = {
    general: process.env.SYNC_SHEET_GENERAL || 'Sheet1',
    finance: process.env.SYNC_SHEET_FINANCE || 'Finance',
    gold: process.env.SYNC_SHEET_GOLD || 'GoldPrice',
};

export const CATEGORIES: Category[] = [
    { name: 'General', sources: GENERAL_SOURCES, sheet: SHEETS.general },
    { name: 'Finance', sources: FINANCE_SOURCES, sheet: SHEETS.finance },
];

/**
 * Doc RSS, them NGAY bai moi vao cuoi sheet (tom tat + anh tu RSS, cot I = PENDING).
 * `sinceTs` > 0: bo qua bai cu hon moc nay (backfill --today).
 * Tra ve so bai da them.
 */
export async function collectCategory(cat: Category, sinceTs: number = 0): Promise<number> {
    console.log(`\n🚀 ${cat.name} (${cat.sheet}) - lấy tin mới...`);

    const refs = await readNewsRowRefs(cat.sheet);
    console.log(`   Sheet đang có ${refs.length} bài.`);

    const newNews = await collectNewArticles(cat.sources, refs.map(r => r.url), 100, 0, sinceTs);

    if (newNews.length === 0) {
        console.log(`   Không có bài mới. Chỉ cập nhật heartbeat.`);
        await updateHeartbeatOnly(cat.sheet);
        return 0;
    }

    newNews.forEach(item => console.log(`   [${cat.name}] ➕ ${item.title}`));
    await appendNewsToSheet(newNews, cat.sheet);
    return newNews.length;
}
