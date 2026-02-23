"use client";

import { NewsItem } from "@/lib/google-sheets";
import { useState } from "react";

interface NewsFeedProps {
    initialNews: NewsItem[];
}

export default function NewsFeed({ initialNews }: NewsFeedProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    const totalPages = Math.ceil(initialNews.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentNews = initialNews.slice(indexOfFirstItem, indexOfLastItem);

    const goToPage = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const goToNextPage = () => {
        if (currentPage < totalPages) goToPage(currentPage + 1);
    };
    const goToPrevPage = () => {
        if (currentPage > 1) goToPage(currentPage - 1);
    };

    const MiniPagination = () => (
        <div className="flex items-center gap-2 mb-6 justify-end">
            <button
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                title="Trang trước"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                {currentPage} / {totalPages}
            </div>
            <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                title="Trang sau"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    );

    if (initialNews.length === 0) {
        return (
            <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center">
                <p className="text-zinc-500 mb-2">Chưa có tin tức nào được tìm thấy.</p>
            </div>
        );
    }

    return (
        <>
            {totalPages > 1 && <MiniPagination />}
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {currentNews.map((item, index) => (
                    <article
                        key={`${item.url}-${index}`}
                        className="group flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1"
                    >
                        {item.thumbnail ? (
                            <div className="h-48 relative overflow-hidden">
                                <img
                                    src={item.thumbnail}
                                    alt={item.title}
                                    className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
                                />
                            </div>
                        ) : (
                            <div className="h-48 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
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

                            <p className="text-zinc-600 dark:text-zinc-400 text-sm line-clamp-10 mb-6 flex-1 whitespace-pre-line">
                                {item.summary}
                            </p>

                            <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="mt-16 flex items-center justify-center flex-wrap gap-2 md:gap-4">
                    <button
                        onClick={goToPrevPage}
                        disabled={currentPage === 1}
                        className="px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                        Trang trước
                    </button>

                    <div className="flex items-center gap-1 md:gap-2">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => goToPage(page)}
                                className={`w-10 h-10 rounded-xl font-bold text-sm transition-all duration-200 ${currentPage === page
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                                    : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-indigo-500 dark:hover:border-indigo-500"
                                    }`}
                            >
                                {page}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                        Trang sau
                    </button>
                </div>
            )}
        </>
    );
}
