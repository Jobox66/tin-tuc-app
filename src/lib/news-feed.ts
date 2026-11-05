/**
 * Chon phan tin gui xuong trinh duyet luc mo trang.
 * Dung duoc o ca server lan client: chi import TYPE tu google-sheets
 * (file do keo theo googleapis, khong dong goi cho trinh duyet duoc).
 */
import type { NewsItem } from './google-sheets';

// Truoc day trang gui CA ~6.800 bai (~7MB) xuong trinh duyet chi de phan trang
// 15 bai/trang. 300 bai = 20 trang; muon xem cu hon thi bam "Tải thêm".
export const INITIAL_NEWS_LIMIT = 300;

/** Sap xep moi nhat truoc; timestamp hong coi nhu cu nhat */
export function sortNewsDesc(items: NewsItem[]): NewsItem[] {
    const ts = (n: NewsItem) => (Number.isFinite(n.timestamp) ? n.timestamp : 0);
    return [...items].sort((a, b) => ts(b) - ts(a));
}

/**
 * `limit` bai CHUA AN moi nhat + TAT CA bai da Luu (tab "Tin Đã Lưu" phai
 * day du ngay tu dau), giu thu tu moi nhat truoc.
 */
export function buildInitialFeed(items: NewsItem[], limit: number = INITIAL_NEWS_LIMIT): { items: NewsItem[]; hasMore: boolean } {
    const sorted = sortNewsDesc(items);
    const picked: NewsItem[] = [];
    let visibleTaken = 0;
    let hasMore = false;

    for (const item of sorted) {
        const isVisible = !item.isHidden;
        if (isVisible && visibleTaken < limit) {
            visibleTaken++;
            picked.push(item);
        } else if (item.isSaved) {
            picked.push(item);
            if (isVisible) hasMore = true;
        } else if (isVisible) {
            hasMore = true;
        }
    }
    return { items: picked, hasMore };
}
