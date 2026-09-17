import Parser from 'rss-parser';
import { NewsItem } from './google-sheets';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const parser = new Parser();
const execFileAsync = promisify(execFile);

export interface NewsSource {
    name: string;
    url: string;
}

// Bám theo chuyên mục thay vì "tin mới nhất" để lọc bớt giải trí, thể thao,
// đời sống... - thứ chiếm phần lớn feed tổng hợp.
export const GENERAL_SOURCES: NewsSource[] = [
    {
        name: 'VNExpress - Thời sự',
        url: 'https://vnexpress.net/rss/thoi-su.rss',
    },
    {
        name: 'VNExpress - Thế giới',
        url: 'https://vnexpress.net/rss/the-gioi.rss',
    },
    {
        name: 'VNExpress - Kinh doanh',
        url: 'https://vnexpress.net/rss/kinh-doanh.rss',
    },
    {
        name: 'VNExpress - Khoa học công nghệ',
        url: 'https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss',
    },
    {
        name: 'Tuổi Trẻ - Thời sự',
        url: 'https://tuoitre.vn/rss/thoi-su.rss',
    },
    {
        name: 'Tuổi Trẻ - Thế giới',
        url: 'https://tuoitre.vn/rss/the-gioi.rss',
    },
    {
        name: 'Tuổi Trẻ - Kinh doanh',
        url: 'https://tuoitre.vn/rss/kinh-doanh.rss',
    },
    {
        name: 'Tuổi Trẻ - Khoa học',
        url: 'https://tuoitre.vn/rss/khoa-hoc.rss',
    }
];

export const FINANCE_SOURCES: NewsSource[] = [
    {
        name: 'Vietstock - Tin mới nhất',
        url: 'https://vietstock.vn/rss/tin-moi-nhat.rss',
    },
    {
        name: 'CafeF - Thị trường chứng khoán',
        url: 'https://cafef.vn/thi-truong-chung-khoan.rss',
    },
    {
        name: 'Báo Đầu tư - Chứng khoán',
        url: 'https://baodautu.vn/chung-khoan/rss',
    }
];

interface Candidate {
    title: string;
    url: string;
    summary: string;
    thumbnail: string;
    pubDate: Date;
    timestamp: number;
}

const SUMMARIZER_TIMEOUT_MS = 30_000;

// Tuoi Tre tra pubDate dang "9/17/2026 2:18:00 PM" - KHONG co timezone.
// new Date() se hieu theo gio cua MAY DANG CHAY: dung khi chay o VN, nhung
// lech +7h tren GitHub Actions (UTC) khien bai Tuoi Tre luon nhay len dau
// danh sach va chon mat tin moi that. VNExpress/CafeF co "+0700" nen khong bi.
const HAS_TIMEZONE = /(Z|GMT|UTC|[+-]\d{2}:?\d{2})\s*$/i;

/**
 * Doc pubDate ve timestamp.
 * - Thieu timezone  -> coi nhu gio Viet Nam (+07:00), khong phu thuoc may chay
 * - Thieu/hong han  -> tra null de caller bo qua bai do (truoc day gan
 *   new Date() khien bai cu doi lot tin vua dang)
 * - O tuong lai     -> kep ve hien tai, bai khong the xuat ban o tuong lai
 */
export function parsePubDate(raw: string | undefined, now: number = Date.now()): number | null {
    if (!raw) return null;
    const text = raw.trim();
    if (!text) return null;

    let ts = HAS_TIMEZONE.test(text)
        ? new Date(text).getTime()
        : new Date(`${text} +07:00`).getTime();

    if (isNaN(ts)) ts = new Date(text).getTime();
    if (isNaN(ts)) return null;

    return ts > now + 5 * 60_000 ? now : ts;
}

const SUMMARIZER_CONCURRENCY = 4;

/**
 * Chạy `worker` trên toàn bộ `items` với tối đa `limit` tác vụ đồng thời,
 * trả kết quả theo đúng thứ tự đầu vào.
 */
async function runPool<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let cursor = 0;

    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        for (let i = cursor++; i < items.length; i = cursor++) {
            results[i] = await worker(items[i], i);
        }
    });

    await Promise.all(runners);
    return results;
}

/**
 * Gọi Python summarizer (bất đồng bộ - execSync sẽ khoá hẳn event loop).
 * Trả về null nếu thất bại để caller giữ nguyên dữ liệu lấy từ RSS.
 */
async function summarizeWithPython(url: string): Promise<{ summary: string; image?: string } | null> {
    const pythonPath = process.env.PYTHON_PATH || path.join(process.cwd(), '.venv', process.platform === 'win32' ? 'Scripts' : 'bin', 'python');
    const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'summarizer.py');

    try {
        const { stdout } = await execFileAsync(pythonPath, [scriptPath, url], {
            encoding: 'utf8',
            timeout: SUMMARIZER_TIMEOUT_MS,
            maxBuffer: 20 * 1024 * 1024, // summarizer.py trả cả full text, 1MB mặc định dễ tràn
        });

        const result = JSON.parse(stdout);
        if (!result.success) {
            console.warn(`  ⚠️ Summarizer reported failure for ${url}: ${result.error}`);
            return null;
        }
        return { summary: result.summary, image: result.image };
    } catch (summError) {
        console.error(`  ❌ Summarization failed for ${url}:`, summError instanceof Error ? summError.message : summError);
        return null;
    }
}

export async function aggregateNews(
    sources: NewsSource[],
    existingUrls: string[] = [],
    // Feed cua VNExpress/Tuoi Tre tra 50-60 bai; quet het de khong bo sot
    maxItemsPerSource: number = 100,
    // 0 = KHONG gioi han. Moi lan quet lay bang het bai chua co trong sheet.
    maxNewItems: number = 0,
    // Neu dat, bo qua bai cu hon moc nay (dung cho lan backfill dau tien)
    sinceTimestamp: number = 0
): Promise<NewsItem[]> {
    const existing = new Set(existingUrls);
    const seen = new Set<string>();
    const budget = maxNewItems > 0 ? maxNewItems : Infinity;
    const runStartedAt = Date.now();

    // ===== Giai đoạn 1: đọc RSS song song, gom bài mới THEO TỪNG NGUỒN =====
    // (không gọi summarizer ở bước này)
    const perSource = await Promise.all(sources.map(async (source) => {
        try {
            console.log(`Fetching from: ${source.name}...`);
            // Add cache-buster to URL
            const urlWithCacheBuster = `${source.url}${source.url.includes('?') ? '&' : '?'}t=${Date.now()}`;
            const feed = await parser.parseURL(urlWithCacheBuster);

            // Limit items per source
            const feedItems = feed.items.slice(0, maxItemsPerSource);
            console.log(`Fetched ${feed.items.length} items from ${source.name}. Processed: ${feedItems.length}.`);
            return { source, feedItems };
        } catch (error) {
            console.error(`Error fetching from ${source.name}:`, error);
            return { source, feedItems: [] };
        }
    }));

    // Lọc trùng tuần tự (Set dùng chung) để một bài xuất hiện ở 2 chuyên mục
    // chỉ được giữ một lần
    const queues: { name: string; items: Candidate[] }[] = perSource.map(({ source, feedItems }) => {
        const items: Candidate[] = [];
        let alreadyInSheet = 0;
        let duplicateInRun = 0;
        let tooOld = 0;
        let noDate = 0;

        for (const item of feedItems) {
            const url = (item.link || '').trim();
            if (!url) continue;

            // Dem gon thay vi log tung dong - khi sheet da co vai nghin bai thi
            // log tung dong bi bo qua se lam ngap log CI
            if (existing.has(url)) { alreadyInSheet++; continue; }
            if (seen.has(url)) { duplicateInRun++; continue; }

            const timestamp = parsePubDate(item.pubDate, runStartedAt);
            if (timestamp === null) {
                console.warn(`  ⚠️ Bỏ qua (pubDate thiếu/không đọc được): ${item.title} [${item.pubDate}]`);
                noDate++;
                continue;
            }
            const pubDate = new Date(timestamp);

            if (sinceTimestamp > 0 && timestamp < sinceTimestamp) {
                tooOld++;
                continue;
            }

            seen.add(url);
            items.push({
                title: item.title || '',
                url,
                summary: cleanSummary(item.contentSnippet || item.summary || ''),
                thumbnail: extractThumbnail(item.content || item.summary || ''),
                pubDate,
                timestamp,
            });
        }

        const skipParts = [`đã có ${alreadyInSheet}`, `trùng trong lượt ${duplicateInRun}`];
        if (sinceTimestamp > 0) skipParts.push(`quá cũ ${tooOld}`);
        if (noDate > 0) skipParts.push(`thiếu ngày ${noDate}`);
        console.log(`  → ${source.name}: ${items.length} bài mới (bỏ qua: ${skipParts.join(', ')}).`);
        return { name: source.name, items };
    });

    // Chia ngân sách maxNewItems theo VÒNG TRÒN giữa các nguồn.
    // Nếu duyệt tuần tự, nguồn đầu tiên ăn hết quota và các nguồn sau không bao
    // giờ tới lượt - với 5 nguồn/chuyên mục thì 4 nguồn sau sẽ luôn trắng tay.
    const candidates: Candidate[] = [];
    const cursors = new Array(queues.length).fill(0);
    let progressed = true;

    while (candidates.length < budget && progressed) {
        progressed = false;
        for (let q = 0; q < queues.length && candidates.length < budget; q++) {
            const queue = queues[q];
            if (cursors[q] < queue.items.length) {
                candidates.push(queue.items[cursors[q]++]);
                progressed = true;
            }
        }
    }

    const share = queues
        .map((q, i) => `${q.name}=${cursors[i]}`)
        .join(', ');
    console.log(`📊 Lấy ${candidates.length} bài${budget === Infinity ? ' (không giới hạn)' : `/${maxNewItems} suất`}: ${share}`);

    if (candidates.length === 0) return [];

    // ===== Giai đoạn 2: tóm tắt song song =====
    console.log(`🧠 Summarizing ${candidates.length} new articles (concurrency=${SUMMARIZER_CONCURRENCY}, timeout=${SUMMARIZER_TIMEOUT_MS / 1000}s)...`);
    const startedAt = Date.now();

    const summaries = await runPool(candidates, SUMMARIZER_CONCURRENCY, async (candidate) => {
        console.log(`Summarizing: ${candidate.title}...`);
        return summarizeWithPython(candidate.url);
    });

    console.log(`🧠 Summarization done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`);

    return candidates.map((candidate, index) => {
        const result = summaries[index];
        return {
            title: candidate.title,
            summary: result?.summary || candidate.summary,
            url: candidate.url,
            date: candidate.pubDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
            thumbnail: result?.image || candidate.thumbnail,
            timestamp: candidate.timestamp,
        };
    });
}

function extractThumbnail(content: string): string {
    const match = content.match(/src="([^"]+)"/);
    return match ? match[1] : '';
}

function cleanSummary(summary: string): string {
    // Remove HTML tags and extra whitespace, then truncate
    const text = summary.replace(/<[^>]*>?/gm, '').trim();
    return text.length > 300 ? `${text.substring(0, 300)}...` : text;
}
