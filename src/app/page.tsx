import { getNewsFromSheets, getLatestGoldPricesFromSheets } from "@/lib/google-sheets";
import { buildInitialFeed } from "@/lib/news-feed";
import { shortArticleDate } from "@/lib/article-display";
import NewsFeed from "@/components/NewsFeed";
import { BrandButton, BackToTop } from "@/components/ScrollControls";

// Cache trang 60s thay vi doc lai 3 sheet (~7MB) tu Google o MOI luot truy cap.
// Tin moi cham toi da 60s; Luu/An bai van thay ngay vi actions.ts goi
// revalidatePath('/').
export const revalidate = 60;

const VN_TZ = 'Asia/Ho_Chi_Minh';

export default async function Home() {
  // Đọc song song 6 sheet - tuần tự khiến TTFB cộng dồn 6 lượt gọi Google API
  const [generalRes, financeRes, goldRes] = await Promise.all([
    getNewsFromSheets('Sheet1'),
    getNewsFromSheets('Finance'),
    getLatestGoldPricesFromSheets('GoldPrice'),
  ]);

  const generalNews = generalRes.news;
  const financeNews = financeRes.news;
  const heartbeat = generalRes.heartbeat || financeRes.heartbeat;

  // Chi gui phan dau (moi nhat + bai da luu) xuong trinh duyet
  const generalFeed = buildInitialFeed(generalNews);
  const financeFeed = buildInitialFeed(financeNews);

  // Nam hien tai (gio VN) - the bai chi ghi nam khi khac nam nay
  const currentYear = Number(new Date().toLocaleString('en-US', { timeZone: VN_TZ, year: 'numeric' }));

  const allNews = [...generalNews, ...financeNews];
  const lastArticleTime = allNews.length > 0
    ? shortArticleDate(
      new Date(allNews.reduce((max, n) => Math.max(max, n.timestamp), 0)).toLocaleString('vi-VN', { timeZone: VN_TZ }),
      currentYear,
    )
    : null;
  const systemRunTime = heartbeat ? shortArticleDate(heartbeat, currentYear) : null;
  const totalCount = (generalNews.length + financeNews.length).toLocaleString('vi-VN');

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 selection:bg-red-100 dark:bg-zinc-950 dark:text-zinc-100 dark:selection:bg-red-900/60">
      <nav className="sticky top-0 z-50 h-14 w-full border-b border-zinc-200/80 bg-white/85 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/85">
        <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
          <BrandButton />
          <div
            className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"
            title={`Tin Chung: ${generalNews.length.toLocaleString('vi-VN')} · Tài Chính: ${financeNews.length.toLocaleString('vi-VN')}${systemRunTime ? ` · Hệ thống quét lúc ${systemRunTime}` : ''}`}
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {lastArticleTime ? (
              <span>
                <span className="hidden sm:inline">Tin mới nhất </span>
                <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{lastArticleTime}</span>
              </span>
            ) : (
              <span>Chưa có dữ liệu</span>
            )}
            <span className="hidden text-zinc-300 sm:inline dark:text-zinc-700" aria-hidden="true">|</span>
            <span className="hidden tabular-nums sm:inline">{totalCount} bài</span>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
        <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl dark:text-zinc-50">
            Tin mới nhất
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 sm:text-base dark:text-zinc-400">
            Tổng hợp từ VnExpress, Tuổi Trẻ, CafeF, Vietstock và tóm tắt tự động.
          </p>
        </header>

        <NewsFeed
          initialGeneral={generalFeed.items}
          initialFinance={financeFeed.items}
          initialHasMore={{ general: generalFeed.hasMore, finance: financeFeed.hasMore }}
          initialGoldPrices={goldRes.prices}
          initialGoldSeries={goldRes.series}
          initialGoldWorld={goldRes.world}
          initialGoldMoves={goldRes.moves}
          currentYear={currentYear}
        />
      </main>

      <footer className="border-t border-zinc-200 py-8 dark:border-zinc-800">
        <div className="mx-auto max-w-[1400px] px-4 text-sm text-zinc-500 sm:px-6">
          © 2026 Tin Tức · Next.js + Google Sheets · DucTN
          {systemRunTime && <span className="block sm:ml-2 sm:inline">· Hệ thống quét lúc {systemRunTime}</span>}
        </div>
      </footer>

      <BackToTop />
    </div>
  );
}
