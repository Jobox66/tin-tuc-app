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

export const GENERAL_SOURCES: NewsSource[] = [
    {
        name: 'VNExpress - Tin mới nhất',
        url: 'https://vnexpress.net/rss/tin-moi-nhat.rss',
    },
    {
        name: 'Tuổi Trẻ - Tin mới nhất',
        url: 'https://tuoitre.vn/rss/tin-moi-nhat.rss',
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

export const INTERNATIONAL_SOURCES: NewsSource[] = [
    { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
    { name: 'Reuters - World', url: 'https://www.rss.reuters.com/news/worldNews' },
    { name: 'CNN - Top Stories', url: 'http://rss.cnn.com/rss/edition.rss' },
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { name: 'The Guardian - World', url: 'https://www.theguardian.com/world/rss' },
    { name: 'AP News - Top Stories', url: 'https://rsshub.app/apnews/topics/apf-topnews' },
];

export const INTL_FINANCE_SOURCES: NewsSource[] = [
    { name: 'CNBC - Top News', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
    { name: 'Bloomberg', url: 'https://rsshub.app/bloomberg' },
    { name: 'MarketWatch - Top Stories', url: 'http://feeds.marketwatch.com/marketwatch/topstories/' },
    { name: 'Financial Times - Home', url: 'https://www.ft.com/rss/home' },
];

export const INTL_TECH_SOURCES: NewsSource[] = [
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
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
    maxItemsPerSource: number = 15,
    maxNewItems: number = 10
): Promise<NewsItem[]> {
    const existing = new Set(existingUrls);
    const seen = new Set<string>();
    const candidates: Candidate[] = [];

    // ===== Giai đoạn 1: thu thập bài mới từ RSS (không gọi summarizer) =====
    for (const source of sources) {
        if (candidates.length >= maxNewItems) {
            console.log(`🛑 Reached max new items limit (${maxNewItems}). Skipping remaining source: ${source.name}`);
            continue;
        }

        try {
            console.log(`Fetching from: ${source.name}...`);
            // Add cache-buster to URL
            const urlWithCacheBuster = `${source.url}${source.url.includes('?') ? '&' : '?'}t=${Date.now()}`;
            const feed = await parser.parseURL(urlWithCacheBuster);

            // Limit items per source
            const feedItems = feed.items.slice(0, maxItemsPerSource);

            let skippedCount = 0;
            for (const item of feedItems) {
                const url = (item.link || '').trim();
                if (!url) {
                    skippedCount++;
                    continue;
                }

                // Skip if already in existingUrls OR already added in this run
                const isExisting = existing.has(url);
                const isDuplicate = seen.has(url);

                if (isExisting || isDuplicate) {
                    console.log(`  ⏩ Skipping: ${isExisting ? 'Already in sheet' : 'Duplicate in run'} (${item.title})`);
                    skippedCount++;
                    continue;
                }

                // Stop processing more items if we've hit the max new items limit
                if (candidates.length >= maxNewItems) {
                    console.log(`  🛑 Reached max new items limit (${maxNewItems}). Stopping source: ${source.name}`);
                    break;
                }

                const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
                const timestamp = pubDate.getTime();
                if (isNaN(timestamp)) {
                    console.warn(`Invalid date for ${url}: ${item.pubDate}`);
                }

                seen.add(url);
                candidates.push({
                    title: item.title || '',
                    url,
                    summary: cleanSummary(item.contentSnippet || item.summary || ''),
                    thumbnail: extractThumbnail(item.content || item.summary || ''),
                    pubDate,
                    timestamp,
                });
            }

            console.log(`Fetched ${feed.items.length} items from ${source.name}. Processed: ${feedItems.length}. New: ${feedItems.length - skippedCount}. Skipped: ${skippedCount}.`);
        } catch (error) {
            console.error(`Error fetching from ${source.name}:`, error);
        }
    }

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
