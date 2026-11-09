/**
 * Cac quyet dinh THUAN (khong goi mang, khong dung googleapis) cua luot sync.
 * Tach rieng de kiem thu duoc bang `npm test` ma khong cham toi sheet that.
 */

// ===== Trang thai tom tat - cot I cua sheet tin =====
// Dong cu (truoc khi co cot I) de trong -> coi nhu da xong, KHONG tom tat lai
// ca kho 5000 bai.
export const SUMMARY_PENDING = 'PENDING';
export const SUMMARY_RETRY = 'RETRY';
export const SUMMARY_DONE = 'DONE';
export const SUMMARY_FAILED = 'FAILED';

/** Mot dong tin trong sheet, chi gom cac cot can de lap ke hoach */
export interface NewsRowRef {
    row: number;        // so dong that tren sheet (1-based, dong 1 la tieu de)
    url: string;
    timestamp: number;
    isSaved: boolean;
    status: string;     // cot I
}

/**
 * "08:28:07 23/9/2026" (gio Viet Nam, dinh dang vi-VN: GIO dung truoc NGAY)
 * -> epoch ms dung, khong phu thuoc mui gio cua may dang chay.
 * Tra null neu khong doc duoc.
 */
export function vnDateTimeToEpoch(text: string | undefined): number | null {
    if (!text) return null;
    const parts = text.trim().split(/\s+/);
    const day = parts.find(p => p.includes('/'));
    const time = parts.find(p => p.includes(':'));
    if (!day || !time) return null;

    const [d, m, y] = day.split('/').map(Number);
    const [hh, mi, ss = 0] = time.split(':').map(Number);
    if (![d, m, y, hh, mi, ss].every(Number.isFinite) || !d || !m || !y) return null;

    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = new Date(`${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mi)}:${pad(ss)}+07:00`).getTime();
    return Number.isNaN(ts) ? null : ts;
}

/**
 * Co den luc lay gia vang chua.
 * `graceMs` bu cho do lech nhip cua cron: dat 30 phut ma luot truoc chay lech
 * vai giay thi 29:58 van phai tinh la da du.
 */
export function isGoldFetchDue(
    lastFetchEpoch: number | null,
    nowMs: number,
    intervalMs: number,
    graceMs: number = 2 * 60_000
): boolean {
    if (intervalMs <= 0) return true;
    if (lastFetchEpoch === null) return true;
    // Moc o tuong lai = dong ho/du lieu sai -> lay luon, dung de ket vinh vien
    if (lastFetchEpoch > nowMs + graceMs) return true;
    return nowMs - lastFetchEpoch + graceMs >= intervalMs;
}

/**
 * Chon cac dong can xoa khi sheet vuot tran.
 * - Chi xoa khi vuot `maxRows + slack` (khong xoa lat nhat moi luot), va xoa
 *   ve dung `maxRows`.
 * - KHONG BAO GIO xoa bai da Luu (isSaved).
 * - Xoa bai cu nhat truoc (theo timestamp; timestamp hong coi nhu cu nhat).
 * Tra ve so dong that tren sheet.
 */
export function planTrim(rows: NewsRowRef[], maxRows: number, slack: number = 0): number[] {
    if (rows.length <= maxRows + slack) return [];

    const excess = rows.length - maxRows;
    const ts = (r: NewsRowRef) => (Number.isFinite(r.timestamp) ? r.timestamp : 0);
    return rows
        .filter(r => !r.isSaved)
        .sort((a, b) => ts(a) - ts(b) || a.row - b.row)
        .slice(0, excess)
        .map(r => r.row);
}

/**
 * Dong trung URL can xoa. Trung xay ra khi Vercel (/api/sync) va GitHub Actions
 * cung them mot bai trong cung vai giay. Giu lai MOT dong moi URL, uu tien:
 * bai da Luu > da tom tat xong (DONE) > dong o tren.
 */
export function planDuplicateRemoval(rows: NewsRowRef[]): number[] {
    const groups = new Map<string, NewsRowRef[]>();
    for (const r of rows) {
        const list = groups.get(r.url);
        if (list) list.push(r); else groups.set(r.url, [r]);
    }
    const rank = (r: NewsRowRef) => [r.isSaved ? 0 : 1, r.status === SUMMARY_DONE ? 0 : 1, r.row];
    const better = (a: NewsRowRef, b: NewsRowRef) => {
        const [x, y] = [rank(a), rank(b)];
        for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
        return 0;
    };
    const out: number[] = [];
    for (const list of groups.values()) {
        if (list.length < 2) continue;
        const [, ...drop] = [...list].sort(better);
        out.push(...drop.map(r => r.row));
    }
    return out;
}

/** Don trung URL roi cat ve tran. Tra ve so dong that can xoa. */
export function planCleanup(rows: NewsRowRef[], maxRows: number, slack: number = 0): number[] {
    const dups = new Set(planDuplicateRemoval(rows));
    const rest = rows.filter(r => !dups.has(r.row));
    return [...dups, ...planTrim(rest, maxRows, slack)];
}

/**
 * Gom so dong thanh cac khoang lien tiep, sap xep TU DUOI LEN de khi gui
 * nhieu lenh deleteDimension trong mot batchUpdate thi viec xoa khoang duoi
 * khong lam lech chi so cua khoang tren.
 * Tra ve chi so 0-based kieu Sheets API: [startIndex, endIndex).
 */
export function toDeleteRanges(rowNumbers: number[]): { startIndex: number; endIndex: number }[] {
    const sorted = [...new Set(rowNumbers)].sort((a, b) => a - b);
    const ranges: { startIndex: number; endIndex: number }[] = [];
    for (const row of sorted) {
        const idx = row - 1;
        const last = ranges[ranges.length - 1];
        if (last && last.endIndex === idx) last.endIndex = idx + 1;
        else ranges.push({ startIndex: idx, endIndex: idx + 1 });
    }
    return ranges.reverse();
}

/** Cac dong cho tom tat, bai MOI NHAT truoc, toi da `limit` */
export function selectPendingSummaries(rows: NewsRowRef[], limit: number): NewsRowRef[] {
    return rows
        .filter(r => r.url && (r.status === SUMMARY_PENDING || r.status === SUMMARY_RETRY))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, Math.max(0, limit));
}

// ===== Ghi gia vang THEO THAY DOI (quyet dinh cua anh, 06/11/2026) =====
// Gia khong doi so voi lan ghi gan nhat cua mat hang trong CUNG NGAY -> ghi de
// moc gio (hien gio moi nhat). Gia doi, hoac sang ngay moi -> them dong.
// Sang ngay moi luon them dong de moi ngay co it nhat mot dong: neu ghi de qua
// ngay thi ngay hom truoc mat diem tren bieu do.

/** "08:28:07 23/9/2026" -> "23/9/2026" */
export function dayOfVnDateTime(text: string): string {
    return text.split(/\s+/).find(p => p.includes('/')) || '';
}

/** Mot dong da co trong sheet GoldPrice (chi cac cot can de so sanh) */
export interface GoldTailRow {
    row: number;      // so dong that tren sheet
    date: string;     // cot A - moc gio lan cuoi thay muc gia nay
    brand: string;
    name: string;
    buy: string;
    sell: string;
}

export interface GoldWriteItem {
    brand: string;
    name: string;
    buy: string | number;
    sell: string | number;
}

const samePrice = (a: string | number, b: string | number) =>
    (parseInt(String(a).replace(/\D/g, ''), 10) || 0) === (parseInt(String(b).replace(/\D/g, ''), 10) || 0);

export function planGoldWrites<T extends GoldWriteItem>(
    tail: GoldTailRow[],
    items: T[],
    fetchTime: string
): { overwrite: { row: number; item: T }[]; append: T[] } {
    // Dong MOI NHAT cua tung mat hang (so dong lon nhat)
    const latest = new Map<string, GoldTailRow>();
    for (const r of tail) {
        const key = `${r.brand}|${r.name}`;
        const cur = latest.get(key);
        if (!cur || r.row > cur.row) latest.set(key, r);
    }

    const today = dayOfVnDateTime(fetchTime);
    const overwrite: { row: number; item: T }[] = [];
    const append: T[] = [];
    for (const item of items) {
        const prev = latest.get(`${item.brand}|${item.name}`);
        if (prev && dayOfVnDateTime(prev.date) === today && samePrice(prev.buy, item.buy) && samePrice(prev.sell, item.sell)) {
            overwrite.push({ row: prev.row, item });
        } else {
            append.push(item);
        }
    }
    return { overwrite, append };
}

/** Trang thai tiep theo sau mot lan tom tat */
export function nextSummaryStatus(current: string, succeeded: boolean): string {
    if (succeeded) return SUMMARY_DONE;
    // Cho thu lai MOT lan (loi mang/timeout thoang qua), lan 2 hong thi thoi
    return current === SUMMARY_RETRY ? SUMMARY_FAILED : SUMMARY_RETRY;
}
