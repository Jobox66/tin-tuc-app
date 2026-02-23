import { getNewsFromSheets, NewsItem } from "@/lib/google-sheets";
import NewsFeed from "@/components/NewsFeed";

export const dynamic = "force-dynamic";

export default async function Home() {
  const news: NewsItem[] = await getNewsFromSheets();

  // Ensure sorted by timestamp descending
  const sortedNews = [...news].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 selection:bg-indigo-100 dark:selection:bg-indigo-900">
      {/* Header */}
      <nav className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1650px] px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Tin Tức App</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              {news.length} bài báo
            </div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              Google Sheets Power
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
            Tất cả các tin tức được cập nhật liên tục và tóm tắt bởi AI.
          </p>
        </header>

        <NewsFeed initialNews={sortedNews} />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-12 mt-20">
        <div className="mx-auto max-w-[1650px] px-6 text-center">
          <p className="text-zinc-500 text-sm">
            © 2026 Tin Tức App. Được build bằng Next.js và Google Sheets by DucTN.
          </p>
        </div>
      </footer>
    </div>
  );
}
