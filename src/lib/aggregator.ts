import Parser from 'rss-parser';
import { NewsItem } from './google-sheets';
import { execSync } from 'child_process';
import path from 'path';

const parser = new Parser();

const SOURCES = [
    {
        name: 'VNExpress - Tin mới nhất',
        url: 'https://vnexpress.net/rss/tin-moi-nhat.rss',
    },
    {
        name: 'Tuổi Trẻ - Tin mới nhất',
        url: 'https://tuoitre.vn/rss/tin-moi-nhat.rss',
    }
];

export async function aggregateNews(): Promise<NewsItem[]> {
    const allNews: NewsItem[] = [];

    for (const source of SOURCES) {
        try {
            console.log(`Fetching from: ${source.name}...`);
            const feed = await parser.parseURL(source.url);

            // Take first 30 items per source for expanded news
            const feedItems = feed.items.slice(0, 30);

            for (const item of feedItems) {
                const url = item.link || '';
                console.log(`Summarizing: ${item.title}...`);

                let summary = cleanSummary(item.contentSnippet || item.summary || '');
                let thumbnail = extractThumbnail(item.content || item.summary || '');
                const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
                const timestamp = pubDate.getTime();

                try {
                    // Call Python summarizer
                    const pythonPath = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
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
                    date: pubDate.toLocaleString('vi-VN'),
                    thumbnail: thumbnail,
                    timestamp: timestamp
                });
            }
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
