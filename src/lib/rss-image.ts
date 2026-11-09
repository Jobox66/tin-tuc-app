/**
 * Lay anh dai dien cua mot bai tu chinh muc RSS (luot nhanh khong goi Python).
 * Moi bao dat anh mot kieu (kiem 09/11/2026):
 *   VnExpress  <img src="..."> trong description (+ <enclosure>)
 *   Tuoi Tre   CHI co <enclosure url="..." type="image/jpeg">, description khong co anh
 *   Vietstock  <img src='...'> NHAY DON, duong dan co dau cach ("Down 13_819791.jpg")
 *   CafeF      <img src="..."> trong description
 * Thu tu uu tien: enclosure anh -> media:content/thumbnail -> <img> dau tien.
 */
export interface RssImageFields {
    enclosure?: { url?: string; type?: string };
    content?: string;
    summary?: string;
    'content:encoded'?: string;
    'media:content'?: unknown;
    'media:thumbnail'?: unknown;
}

const IMG_EXT = /\.(jpe?g|png|webp|gif|avif)(?:[?#]|$)/i;

/** Chuan hoa: bo khoang trang dau/cuoi, ma hoa dau cach, chi nhan http(s) */
function cleanUrl(raw: string | undefined): string {
    const u = (raw || '').trim().replace(/&amp;/g, '&').replace(/ /g, '%20');
    return /^https?:\/\//i.test(u) ? u : '';
}

/** `src` cua the <img> dau tien, chap nhan ca nhay kep va nhay don */
export function firstImgSrc(html: string | undefined): string {
    const m = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(html || '');
    return cleanUrl(m ? (m[1] ?? m[2]) : '');
}

function mediaUrl(v: unknown): string {
    // rss-parser (customFields) tra dang { $: { url } } hoac mang cac phan tu do
    const first = Array.isArray(v) ? v[0] : v;
    const url = (first as { $?: { url?: string } } | undefined)?.$?.url;
    return cleanUrl(url);
}

export function pickThumbnail(item: RssImageFields): string {
    const enc = item.enclosure;
    if (enc?.url && ((enc.type || '').startsWith('image/') || IMG_EXT.test(enc.url))) {
        const u = cleanUrl(enc.url);
        if (u) return u;
    }
    return mediaUrl(item['media:content'])
        || mediaUrl(item['media:thumbnail'])
        || firstImgSrc(item['content:encoded'])
        || firstImgSrc(item.content)
        || firstImgSrc(item.summary);
}
