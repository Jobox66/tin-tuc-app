"use client";

import { NewsItem } from "@/lib/google-sheets";
import { useState, useTransition, useMemo } from "react";
import { updateArticleStatus } from "@/app/actions";

type CategoryKey = "general" | "finance" | "international" | "intlFinance" | "intlTech";

const CATEGORY_LABELS: Record<CategoryKey, string> = {
    general: "Tin Chung",
    finance: "Tài Chính",
    international: "Quốc Tế",
    intlFinance: "Tài Chính QT",
    intlTech: "Công Nghệ",
};

const CATEGORY_SHEETS: Record<CategoryKey, string> = {
    general: "Sheet1",
    finance: "Finance",
    international: "International",
    intlFinance: "IntlFinance",
    intlTech: "IntlTech",
};

interface NewsFeedProps {
    initialGeneral: NewsItem[];
    initialFinance: NewsItem[];
    initialInternational: NewsItem[];
    initialIntlFinance: NewsItem[];
    initialIntlTech: NewsItem[];
}

export default function NewsFeed({
    initialGeneral,
    initialFinance,
    initialInternational,
    initialIntlFinance,
    initialIntlTech,
}: NewsFeedProps) {
    const [activeCategory, setActiveCategory] = useState<CategoryKey>(
        "general"
    );

    // Local state for articles to allow Optimistic UI updates
    const [articles, setArticles] = useState<Record<CategoryKey, NewsItem[]>>({
        general: initialGeneral,
        finance: initialFinance,
        international: initialInternational,
        intlFinance: initialIntlFinance,
        intlTech: initialIntlTech,
    });

    const [isPending, startTransition] = useTransition();
    const [currentPage, setCurrentPage] = useState(1);
    const [showSavedOnly, setShowSavedOnly] = useState(false);
    const itemsPerPage = 15;

    // Compute filtered news based on active category and showSavedOnly
    const news = useMemo(() => {
        const list = articles[activeCategory];
        if (showSavedOnly) {
            return list.filter(n => n.isSaved);
        }
        return list.filter(n => !n.isHidden);
    }, [activeCategory, articles, showSavedOnly]);

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

    const handleCategoryChange = (category: CategoryKey) => {
        setActiveCategory(category);
        setShowSavedOnly(false);
        setCurrentPage(1);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleToggleStatus = async (item: NewsItem, field: 'isHidden' | 'isSaved') => {
        const newValue = !item[field];
        const sheetName = CATEGORY_SHEETS[activeCategory];

        // 1. Optimistic Update
        setArticles(prev => {
            const category: CategoryKey = activeCategory;
            const newList = prev[category].map(n =>
                n.url === item.url ? { ...n, [field]: newValue } : n
            );
            return { ...prev, [category]: newList };
        });

        // 2. Server Update
        startTransition(async () => {
            const result = await updateArticleStatus(item.url, field, newValue, sheetName);
            if (!result.success) {
                // Revert on error
                setArticles(prev => {
                    const category: CategoryKey = activeCategory;
                    const newList = prev[category].map(n =>
                        n.url === item.url ? { ...n, [field]: !newValue } : n
                    );
                    return { ...prev, [category]: newList };
                });
                alert("Lỗi khi cập nhật trạng thái tin bài. Vui lòng thử lại.");
            }
        });
    };

    return (
        <>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
                {/* Category Tabs & Saved Toggle */}
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center p-1 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-2xl w-fit backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 flex-wrap">
                        {(Object.keys(CATEGORY_LABELS) as CategoryKey[]).map((key) => (
                            <button
                                key={key}
                                onClick={() => handleCategoryChange(key)}
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeCategory === key && !showSavedOnly
                                    ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-md transform scale-100"
                                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 scale-95"
                                    }`}
                            >
                                {CATEGORY_LABELS[key]}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => {
                            setShowSavedOnly(!showSavedOnly);
                            setCurrentPage(1);
                        }}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold border transition-all duration-300 ${showSavedOnly
                            ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20"
                            : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-indigo-500"
                            }`}
                    >
                        <svg className={`w-5 h-5 ${showSavedOnly ? "fill-current" : "fill-none"}`} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        Tin Đã Lưu ({articles[activeCategory].filter(n => n.isSaved).length})
                    </button>
                </div>

                {/* Mini Pagination */}
                {totalPages > 1 && (
                    <div className="flex gap-3 items-center">
                        <button
                            onClick={goToPrevPage}
                            disabled={currentPage === 1}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-bold text-zinc-600 dark:text-zinc-400">
                            Trang {currentPage} / {totalPages}
                        </div>
                        <button
                            onClick={goToNextPage}
                            disabled={currentPage === totalPages}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {news.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-20 text-center bg-white/50 dark:bg-zinc-900/50">
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400">
                        {showSavedOnly ? (
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                        ) : (
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" />
                            </svg>
                        )}
                    </div>
                    <p className="text-zinc-500 font-medium">
                        {showSavedOnly ? "Anh chưa lưu bài viết nào ở mục này." : "Danh sách trống."}
                    </p>
                </div>
            ) : (
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {currentNews.map((item, index) => (
                        <article
                            key={`${item.url}-${index}`}
                            className="group flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1"
                        >
                            {/* Image Section */}
                            <div className="h-52 relative overflow-hidden">
                                {item.thumbnail ? (
                                    <img
                                        src={item.thumbnail}
                                        alt={item.title}
                                        className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                                        No Image
                                    </div>
                                )}

                                {/* Overlay Controls */}
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <button
                                        onClick={() => handleToggleStatus(item, 'isSaved')}
                                        className={`p-2 rounded-xl backdrop-blur-md border shadow-sm transition-all duration-300 ${item.isSaved
                                            ? "bg-indigo-600 border-indigo-500 text-white opacity-100"
                                            : "bg-white/80 dark:bg-zinc-900/80 border-white/20 text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 opacity-0 group-hover:opacity-100"
                                            }`}
                                        title={item.isSaved ? "Bỏ lưu" : "Lưu bài viết"}
                                    >
                                        <svg className={`w-5 h-5 ${item.isSaved ? "fill-current" : "fill-none"}`} stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleToggleStatus(item, 'isHidden')}
                                        className="p-2 rounded-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-white/20 text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-red-500 hover:text-white"
                                        title="Ẩn bài viết"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="absolute top-4 left-4">
                                    <span className="px-3 py-1 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 shadow-sm">
                                        {CATEGORY_LABELS[activeCategory]}
                                    </span>
                                </div>
                            </div>

                            {/* Content Section */}
                            <div className="p-7 flex flex-col flex-1">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className={`w-1.5 h-1.5 rounded-full ${item.isSaved ? "bg-indigo-500" : "bg-zinc-300"} animate-pulse`}></div>
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
                                        <svg className="ml-2 w-4 h-4 transition-transform group-hover/link:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
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
                        className="px-6 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-bold text-sm disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm"
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
                                    : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-indigo-500 hover:text-indigo-600 shadow-sm"
                                    }`}
                            >
                                {page}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        className="px-6 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-bold text-sm disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm"
                    >
                        Trang sau
                    </button>
                </div>
            )}
        </>
    );
}
