import Parser from 'rss-parser';
import { NewsItem } from './google-sheets';
import { execSync } from 'child_process';
import path from 'path';

const parser = new Parser();

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

export async function aggregateNews(sources: NewsSource[], existingUrls: string[] = []): Promise<NewsItem[]> {
    const allNews: NewsItem[] = [];

    for (const source of sources) {
        try {
            console.log(`Fetching from: ${source.name}...`);
            // Add cache-buster to URL
            const urlWithCacheBuster = `${source.url}${source.url.includes('?') ? '&' : '?'}t=${Date.now()}`;
            const feed = await parser.parseURL(urlWithCacheBuster);

            // Take first 50 items per source
            const feedItems = feed.items.slice(0, 50);

            let skippedCount = 0;
            for (const item of feedItems) {
                const url = (item.link || '').trim();

                // Debug log for every item in feed
                console.log(`  🔍 Checking feed item: ${item.title} (${url.substring(0, 30)}...)`);

                // Skip if already in existingUrls OR already added in this run
                const isExisting = existingUrls.includes(url);
                const isDuplicate = allNews.some(n => n.url === url);

                if (isExisting || isDuplicate) {
                    console.log(`  ⏩ Skipping: ${isExisting ? 'Already in sheet' : 'Duplicate in run'}`);
                    skippedCount++;
                    continue;
                }

                console.log(`Summarizing: ${item.title}...`);

                let summary = cleanSummary(item.contentSnippet || item.summary || '');
                let thumbnail = extractThumbnail(item.content || item.summary || '');
                const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
                const timestamp = pubDate.getTime();

                if (isNaN(timestamp)) {
                    console.warn(`Invalid date for ${url}: ${item.pubDate}`);
                }

                try {
                    // Call Python summarizer - Use environment variable or fallback to local venv
                    const pythonPath = process.env.PYTHON_PATH || path.join(process.cwd(), '.venv', process.platform === 'win32' ? 'Scripts' : 'bin', 'python');
                    const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'summarizer.py');
                    const resultJson = execSync(`"${pythonPath}" "${scriptPath}" "${url}"`, { encoding: 'utf8' });
                    const result = JSON.parse(resultJson);

                    if (result.success) {
                        summary = result.summary;
                        if (result.image) {
                            thumbnail = result.image;
                        }
                    }
                } catch (summError) {
                    console.error(`Summarization failed for ${url}:`, summError);
                }

                allNews.push({
                    title: item.title || '',
                    summary: summary,
                    url: url,
                    date: pubDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
                    thumbnail: thumbnail,
                    timestamp: timestamp
                });
            }
            console.log(`Fetched ${feed.items.length} items from ${source.name}. Processed: ${feedItems.length}. New: ${feedItems.length - skippedCount}. Skipped: ${skippedCount}.`);
        } catch (error) {
            console.error(`Error fetching from ${source.name}:`, error);
        }
    }

    // Deduplicate by URL
    const uniqueNews = Array.from(new Map(allNews.map(item => [item.url, item])).values());

    return uniqueNews;
}

function extractThumbnail(content: string): string {
    const match = content.match(/src="([^"]+)"/);
    return match ? match[1] : '';
}

function cleanSummary(summary: string): string {
    // Remove HTML tags and extra whitespace
    return summary.replace(/<[^>]*>?/gm, '').trim().substring(0, 300) + (summary.length > 300 ? '...' : '');
}
