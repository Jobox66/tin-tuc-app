/**
 * Dinh dang hien thi cho the bai bao. Thuan (khong import runtime tu
 * google-sheets.ts) de dung duoc o client component.
 */

const SOURCE_NAMES: Record<string, string> = {
    'vnexpress.net': 'VnExpress',
    'tuoitre.vn': 'Tuổi Trẻ',
    'cafef.vn': 'CafeF',
    'vietstock.vn': 'Vietstock',
    'thanhnien.vn': 'Thanh Niên',
    'dantri.com.vn': 'Dân Trí',
    'vietnamnet.vn': 'VietNamNet',
};

/** "https://www.vnexpress.net/abc-123.html" -> "VnExpress"; host la -> ten mien */
export function sourceLabel(url: string): string {
    let host: string;
    try {
        host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return '';
    }
    for (const [domain, name] of Object.entries(SOURCE_NAMES)) {
        if (host === domain || host.endsWith(`.${domain}`)) return name;
    }
    return host;
}

/**
 * Cot date ghi theo vi-VN: "HH:MM:SS D/M/YYYY" (gio TRUOC ngay).
 * -> "10:51 · 17/11" ; nam khac nam hien tai cua chuoi thi giu nam.
 * Chuoi khong dung dang -> tra nguyen van.
 */
export function shortArticleDate(date: string, currentYear?: number): string {
    const m = date.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return date;
    const [, h, min, d, mo, y] = m;
    const day = `${d.padStart(2, '0')}/${mo.padStart(2, '0')}`;
    const withYear = currentYear !== undefined && Number(y) !== currentYear ? `${day}/${y}` : day;
    return `${h.padStart(2, '0')}:${min} · ${withYear}`;
}
