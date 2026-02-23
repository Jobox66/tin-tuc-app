import { getNewsFromSheets, NewsItem } from "@/lib/google-sheets";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function Home() {
  const news: NewsItem[] = await getNewsFromSheets();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 selection:bg-indigo-100 dark:selection:bg-indigo-900">
      {/* Header */}
      <nav className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Tin Tức App</h1>
          </div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
            Google Sheets Power
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-12">
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-4 text-zinc-900 dark:text-zinc-50">
            Tổng hợp tin tức mới nhất
          </h2>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl">
            Cập nhật những thông tin nóng hổi nhất được tổng hợp tự động từ Google Sheets của bạn.
          </p>
        </header>

        {news.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <p className="text-zinc-500 mb-2">Chưa có tin tức nào được tìm thấy.</p>
            <p className="text-sm text-zinc-400">Hãy kiểm tra cấu hình Google Sheets trong file .env</p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {news.map((item, index) => (
              <article
                key={index}
                className="group flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1"
              >
                {item.thumbnail ? (
                  <div className="aspect-video relative overflow-hidden">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <span className="text-zinc-400 text-sm">No Image</span>
                  </div>
                )}

                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      News
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <time className="text-xs text-zinc-500 dark:text-zinc-400">
                      {item.date}
                    </time>
                  </div>

                  <h3 className="text-xl font-bold mb-3 line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.title}
                    </a>
                  </h3>

                  <p className="text-zinc-600 dark:text-zinc-400 text-sm line-clamp-3 mb-6 flex-1">
                    {item.summary}
                  </p>

                  <div className="mt-auto">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm font-bold text-zinc-900 dark:text-zinc-50 group/link"
                    >
                      Đọc chi tiết
                      <svg
                        className="ml-2 w-4 h-4 transition-transform group-hover/link:translate-x-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-12 mt-20">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-zinc-500 text-sm">
            © 2026 Tin Tức App. Được build bằng Next.js và Google Sheets.
          </p>
        </div>
      </footer>
    </div>
  );
}
