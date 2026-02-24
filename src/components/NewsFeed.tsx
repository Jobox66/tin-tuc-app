"use client";

import { NewsItem } from "@/lib/google-sheets";
import { useState } from "react";

interface NewsFeedProps {
    initialGeneral: NewsItem[];
    initialFinance: NewsItem[];
}

export default function NewsFeed({
    initialGeneral,
    initialFinance,
}: NewsFeedProps) {
    const [activeCategory, setActiveCategory] = useState<"general" | "finance">(
        "general"
    );
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    const news = activeCategory === "general" ? initialGeneral : initialFinance;

    const totalPages = Math.ceil(news.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentNews = news.slice(indexOfFirstItem, indexOfLastItem);

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

    const handleCategoryChange = (category: "general" | "finance") => {
        setActiveCategory(category);
        setCurrentPage(1);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
                {/* Category Tabs */}
                <div className="flex items-center p-1 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-2xl w-fit backdrop-blur-sm border border-zinc-200 dark:border-zinc-700">
                    <button
                        onClick={() => handleCategoryChange("general")}
                        className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${activeCategory === "general"
                                ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-md transform scale-100"
                                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 scale-95 hover:scale-100"
                            }`}
                    >
                        Tin Chung ({initialGeneral.length})
                    </button>
                    <button
                        onClick={() => handleCategoryChange("finance")}
                        className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${activeCategory === "finance"
                                ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-md transform scale-100"
                                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 scale-95 hover:scale-100"
                            }`}
                    >
                        Tài Chính ({initialFinance.length})
                    </button>
                </div>

                {/* Mini Pagination */}
                {totalPages > 1 && (
                    <div className="flex gap-3 items-center">
                        <button
                            onClick={goToPrevPage}
                            disabled={currentPage === 1}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm"
                            title="Trang trước"
                        >
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 19l-7-7 7-7"
                                />
                            </svg>
                        </button>
                        <div className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-bold text-zinc-600 dark:text-zinc-400">
                            Trang {currentPage} / {totalPages}
                        </div>
                        <button
                            onClick={goToNextPage}
                            disabled={currentPage === totalPages}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm"
                            title="Trang sau"
                        >
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {news.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-20 text-center bg-white/50 dark:bg-zinc-900/50">
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <p className="text-zinc-500 font-medium">Chưa có bài báo nào trong mục này.</p>
                    <p className="text-zinc-400 text-sm mt-1">Hãy chờ AI cập nhật tin mới cho anh nhé!</p>
                </div>
            ) : (
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {currentNews.map((item, index) => (
                        <article
                            key={`${item.url}-${index}`}
                            className="group flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 block-reveal"
                        >
                            {item.thumbnail ? (
                                <div className="h-52 relative overflow-hidden">
                                    <img
                                        src={item.thumbnail}
                                        alt={item.title}
                                        className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-110"
                                    />
                                    <div className="absolute top-4 left-4">
                                        <span className="px-3 py-1 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 shadow-sm">
                                            {activeCategory === "finance" ? "Tài Chính" : "Tin Chung"}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-52 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                    <span className="text-zinc-400 text-sm">No Image</span>
                                </div>
                            )}

                            <div className="p-7 flex flex-col flex-1">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                    <time className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                        {item.date}
                                    </time>
                                </div>

                                <h3 className="text-xl font-bold mb-4 line-clamp-2 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                                        {item.title}
                                    </a>
                                </h3>

                                <p className="text-zinc-600 dark:text-zinc-400 text-sm line-clamp-[10] mb-8 flex-1 whitespace-pre-line leading-relaxed">
                                    {item.summary}
                                </p>

                                <div className="mt-auto pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center text-sm font-bold text-zinc-900 dark:text-zinc-50 group/link bg-zinc-50 dark:bg-zinc-800 px-4 py-2 rounded-lg hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 transition-all shadow-sm"
                                    >
                                        Đọc chi tiết
                                        <svg
                                            className="ml-2 w-4 h-4 transition-transform group-hover/link:translate-x-1"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M17 8l4 4m0 0l-4 4m4-4H3"
                                            />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {/* Main Pagination */}
            {totalPages > 1 && (
                <div className="mt-20 flex items-center justify-center flex-wrap gap-2 md:gap-4">
                    <button
                        onClick={goToPrevPage}
                        disabled={currentPage === 1}
                        className="px-6 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm"
                    >
                        Trang trước
                    </button>

                    <div className="flex items-center gap-2">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => goToPage(page)}
                                className={`w-12 h-12 rounded-2xl font-bold text-sm transition-all duration-300 ${currentPage === page
                                        ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/40 transform scale-110"
                                        : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-600 shadow-sm"
                                    }`}
                            >
                                {page}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        className="px-6 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm"
                    >
                        Trang sau
                    </button>
                </div>
            )}
        </>
    );
}
