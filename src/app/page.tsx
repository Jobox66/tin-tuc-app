import { getNewsFromSheets, getLatestGoldPricesFromSheets, NewsItem } from "@/lib/google-sheets";
import NewsFeed from "@/components/NewsFeed";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const generalRes = await getNewsFromSheets('Sheet1');
  const financeRes = await getNewsFromSheets('Finance');
  const internationalRes = await getNewsFromSheets('International');
  const intlFinanceRes = await getNewsFromSheets('IntlFinance');
  const intlTechRes = await getNewsFromSheets('IntlTech');
  const goldRes = await getLatestGoldPricesFromSheets('GoldPrice');

  const generalNews = generalRes.news;
  const financeNews = financeRes.news;
  const internationalNews = internationalRes.news;
  const intlFinanceNews = intlFinanceRes.news;
  const intlTechNews = intlTechRes.news;
  const heartbeat = generalRes.heartbeat || financeRes.heartbeat;

  // Sorting helper
  const sortByTimestamp = (items: NewsItem[]) =>
    [...items].sort((a, b) => {
      const timeA = isNaN(a.timestamp) ? 0 : a.timestamp;
      const timeB = isNaN(b.timestamp) ? 0 : b.timestamp;
      return timeB - timeA;
    });

  const sortedGeneral = sortByTimestamp(generalNews);
  const sortedFinance = sortByTimestamp(financeNews);
  const sortedInternational = sortByTimestamp(internationalNews);
  const sortedIntlFinance = sortByTimestamp(intlFinanceNews);
  const sortedIntlTech = sortByTimestamp(intlTechNews);

  // Find latest article timestamp
  const allNews = [...generalNews, ...financeNews, ...internationalNews, ...intlFinanceNews, ...intlTechNews];
  const lastArticleTime = allNews.length > 0
    ? new Date(Math.max(...allNews.map(n => n.timestamp))).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    : 'Chưa có dữ liệu';

  const systemRunTime = heartbeat || 'Chưa có log';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 selection:bg-indigo-100 dark:selection:bg-indigo-900">
      {/* Header */}
      <nav className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1650px] px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight">App Tin Tuc</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-4">
              <div className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                {generalNews.length + financeNews.length + internationalNews.length + intlFinanceNews.length + intlTechNews.length} bài báo
              </div>
              <div className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                Multi-Tab Sync
              </div>
            </div>
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium flex flex-col items-end gap-0.5">
              <span>Tin mới nhất: {lastArticleTime}</span>
              <span>Hệ thống quét lúc: {systemRunTime}</span>
              <span className="text-indigo-400 font-bold mt-1">
                Tổng: {generalNews.length} (Chung) | {financeNews.length} (TC) | {internationalNews.length} (QT) | {intlFinanceNews.length} (TC-QT) | {intlTechNews.length} (CN)
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-[1650px] px-6 py-12">
        <header className="mb-12">
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-4 text-zinc-900 dark:text-zinc-50">
            Tổng hợp tin tức mới nhất
          </h2>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl">
            Tin tức đa lĩnh vực được cập nhật liên tục và tóm tắt bởi AI.
          </p>
        </header>

        <NewsFeed
          initialGeneral={sortedGeneral}
          initialFinance={sortedFinance}
          initialInternational={sortedInternational}
          initialIntlFinance={sortedIntlFinance}
          initialIntlTech={sortedIntlTech}
          initialGoldPrices={goldRes.prices}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-12 mt-20">
        <div className="mx-auto max-w-[1650px] px-6 text-center">
          <p className="text-zinc-500 text-sm">
            © 2026 App Tin Tuc. Được build bằng Next.js và Google Sheets by DucTN.
          </p>
        </div>
      </footer>
    </div>
  );
}
