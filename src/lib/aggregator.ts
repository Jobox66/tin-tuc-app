import Parser from 'rss-parser';
import { NewsItem } from './google-sheets';

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

            const items = feed.items.map(item => {
                // Extract thumbnail from content snippets if possible, or use a default
                // RSS content often has <img src="..."> in the summary
                const thumbnail = extractThumbnail(item.content || item.summary || '');

                return {
                    title: item.title || '',
                    summary: cleanSummary(item.contentSnippet || item.summary || ''),
                    url: item.link || '',
                    date: item.pubDate ? new Date(item.pubDate).toLocaleString('vi-VN') : '',
                    thumbnail: thumbnail
                };
            });

            allNews.push(...items);
        } catch (error) {
            console.error(`Error fetching from ${source.name}:`, error);
        }
    }

    // Deduplicate by URL and sort by date (simple sort)
    const uniqueNews = Array.from(new Map(allNews.map(item => [item.url, item])).values());

    return uniqueNews.slice(0, 50); // Limit to top 50 for the sheet
}

function extractThumbnail(content: string): string {
    const match = content.match(/src="([^"]+)"/);
    return match ? match[1] : '';
}

function cleanSummary(summary: string): string {
    // Remove HTML tags and extra whitespace
    return summary.replace(/<[^>]*>?/gm, '').trim().substring(0, 200) + (summary.length > 200 ? '...' : '');
}
