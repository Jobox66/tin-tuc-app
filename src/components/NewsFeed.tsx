"use client";

import type { NewsItem, GoldPriceRow, GoldSeries, GoldWorldPoint, GoldDayMoves } from "@/lib/google-sheets";
import { useState, useTransition, useMemo, useEffect, useRef } from "react";
import { updateArticleStatus, loadAllNews } from "@/app/actions";
import { sourceLabel, shortArticleDate } from "@/lib/article-display";
import GoldPriceBoard from "./GoldPriceBoard";
import { scrollToTop } from "./ScrollControls";

type CategoryKey = "general" | "finance";
type TabKey = CategoryKey | "gold";

const TAB_LABELS: Record<TabKey, string> = {
    general: "Tin Chung",
    finance: "Tài Chính",
    gold: "Giá Vàng",
};

/** Tab không phải tin bài - không có phân trang, lọc, lưu/ẩn */
const NON_NEWS_TABS: TabKey[] = ["gold"];
const isNewsTab = (tab: TabKey) => !NON_NEWS_TABS.includes(tab);

const CATEGORY_SHEETS: Record<CategoryKey, string> = {
    general: "Sheet1",
    finance: "Finance",
};

const ITEMS_PER_PAGE = 15;

/** Dãy số trang có dấu "..." - luôn có trang đầu, trang cuối và ±1 quanh trang hiện tại */
function getPaginationItems(currentPage: number, totalPages: number) {
    const delta = 1;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
            range.push(i);
        }
    }

    range.forEach(i => {
        if (l) {
            if (i - l === 2) {
                rangeWithDots.push(l + 1);
            } else if (i - l !== 1) {
                rangeWithDots.push('...');
            }
        }
        rangeWithDots.push(i);
        l = i;
    });

    return rangeWithDots;
}

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:focus-visible:outline-red-400";

const BookmarkIcon = ({ filled, className = "h-4 w-4" }: { filled?: boolean; className?: string }) => (
    <svg className={`${className} ${filled ? "fill-current" : "fill-none"}`} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
);

const Chevron = ({ dir }: { dir: "left" | "right" }) => (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={dir === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
    </svg>
);

interface NewsFeedProps {
    initialGeneral: NewsItem[];
    initialFinance: NewsItem[];
    initialGoldPrices: GoldPriceRow[];
    initialGoldSeries?: GoldSeries[];
    initialGoldWorld?: GoldWorldPoint[];
    initialGoldMoves?: GoldDayMoves[];
    /** Con bai cu hon chua gui xuong (trang chi gui phan dau de nhe) */
    initialHasMore?: Record<CategoryKey, boolean>;
    /** Nam hien tai (gio VN, tinh o server) - the bai chi ghi nam khi khac */
    currentYear?: number;
}

export default function NewsFeed({
    initialGeneral,
    initialFinance,
    initialGoldPrices,
    initialGoldSeries = [],
    initialGoldWorld = [],
    initialGoldMoves = [],
    initialHasMore = { general: false, finance: false },
    currentYear,
}: NewsFeedProps) {
    const [activeTab, setActiveTab] = useState<TabKey>("general");

    // Local state for articles to allow Optimistic UI updates
    const [articles, setArticles] = useState<Record<CategoryKey, NewsItem[]>>({
        general: initialGeneral,
        finance: initialFinance,
    });

    const [hasMore, setHasMore] = useState<Record<CategoryKey, boolean>>(initialHasMore);
    const [loadingMore, setLoadingMore] = useState(false);
    const [, startTransition] = useTransition();
    const [currentPage, setCurrentPage] = useState(1);
    const [showSavedOnly, setShowSavedOnly] = useState(false);

    // Compute filtered news based on active category and showSavedOnly
    const news = useMemo(() => {
        if (!isNewsTab(activeTab)) return [];
        const list = articles[activeTab as CategoryKey];
        if (showSavedOnly) {
            return list.filter(n => n.isSaved);
        }
        return list.filter(n => !n.isHidden);
    }, [activeTab, articles, showSavedOnly]);

    const savedCount = isNewsTab(activeTab)
        ? articles[activeTab as CategoryKey].filter(n => n.isSaved).length
        : 0;

    const totalPages = Math.ceil(news.length / ITEMS_PER_PAGE);
    const indexOfFirstItem = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentNews = news.slice(indexOfFirstItem, indexOfFirstItem + ITEMS_PER_PAGE);

    // Đổi trang / tab / bộ lọc -> lên đầu trang. Chạy SAU khi React đã vẽ nội
    // dung mới: cuộn ngay trong onClick thì trang đang co/giãn (vd. sang tab
    // Giá Vàng ngắn hơn) có thể làm lệch hoặc ngắt giữa chừng.
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        scrollToTop();
    }, [currentPage, activeTab, showSavedOnly]);

    const goToPage = (page: number) => {
        setCurrentPage(Math.min(Math.max(page, 1), Math.max(totalPages, 1)));
    };

    const handleTabChange = (tab: TabKey) => {
        if (tab === activeTab && !showSavedOnly && currentPage === 1) {
            scrollToTop(); // bấm lại tab đang mở -> vẫn lên đầu
            return;
        }
        setActiveTab(tab);
        setShowSavedOnly(false);
        setCurrentPage(1);
    };

    const handleLoadMore = async () => {
        if (!isNewsTab(activeTab) || loadingMore) return;
        const category = activeTab as CategoryKey;
        setLoadingMore(true);
        try {
            const result = await loadAllNews(CATEGORY_SHEETS[category]);
            if (!result.success) {
                alert("Không tải được bài cũ hơn. Vui lòng thử lại.");
                return;
            }
            setArticles(prev => ({ ...prev, [category]: result.items }));
            setHasMore(prev => ({ ...prev, [category]: false }));
        } finally {
            setLoadingMore(false);
        }
    };

    const handleToggleStatus = async (item: NewsItem, field: 'isHidden' | 'isSaved') => {
        if (!isNewsTab(activeTab)) return;
        const category = activeTab as CategoryKey;
        const newValue = !item[field];
        const sheetName = CATEGORY_SHEETS[category];

        // 1. Optimistic Update
        setArticles(prev => {
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
                    const newList = prev[category].map(n =>
                        n.url === item.url ? { ...n, [field]: !newValue } : n
                    );
                    return { ...prev, [category]: newList };
                });
                alert("Lỗi khi cập nhật trạng thái tin bài. Vui lòng thử lại.");
            }
        });
    };

    const showPager = isNewsTab(activeTab) && totalPages > 1;

    return (
        <>
            {/* Thanh điều hướng dính dưới header (h-14) */}
            <div className="sticky top-14 z-30 -mx-4 mb-6 border-b border-zinc-200/80 bg-zinc-50/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/90">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none]">
                        <div role="tablist" aria-label="Chuyên mục" className="flex shrink-0 items-center rounded-lg bg-zinc-200/60 p-1 dark:bg-zinc-800/60">
                            {(Object.keys(TAB_LABELS) as TabKey[]).map((key) => {
                                const selected = activeTab === key && !showSavedOnly;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        role="tab"
                                        aria-selected={selected}
                                        onClick={() => handleTabChange(key)}
                                        className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition-colors duration-150 sm:px-4 ${FOCUS_RING} ${selected
                                            ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white"
                                            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                                            }`}
                                    >
                                        {TAB_LABELS[key]}
                                    </button>
                                );
                            })}
                        </div>

                        {isNewsTab(activeTab) && (
                            <button
                                type="button"
                                aria-pressed={showSavedOnly}
                                onClick={() => {
                                    setShowSavedOnly(!showSavedOnly);
                                    setCurrentPage(1);
                                }}
                                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-semibold transition-colors duration-150 ${FOCUS_RING} ${showSavedOnly
                                    ? "border-red-700 bg-red-700 text-white dark:border-red-500 dark:bg-red-600"
                                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                                    }`}
                            >
                                <BookmarkIcon filled={showSavedOnly} />
                                {/* Màn hẹp chỉ còn icon + số để không bị cắt mép */}
                                <span className="sr-only sm:not-sr-only">Đã lưu</span>
                                <span className={`tabular-nums ${showSavedOnly ? "text-red-100" : "text-zinc-400"}`}>{savedCount}</span>
                            </button>
                        )}
                    </div>

                    {/* Phân trang gọn - chỉ màn rộng */}
                    {showPager && (
                        <div className="hidden shrink-0 items-center gap-1 md:flex">
                            <button
                                type="button"
                                onClick={() => goToPage(currentPage - 1)}
                                disabled={currentPage === 1}
                                aria-label="Trang trước"
                                className={`grid h-9 w-9 place-items-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-200/70 disabled:pointer-events-none disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800 ${FOCUS_RING}`}
                            >
                                <Chevron dir="left" />
                            </button>
                            <span className="px-1 text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
                                Trang <span className="font-semibold text-zinc-900 dark:text-zinc-100">{currentPage}</span> / {totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => goToPage(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                aria-label="Trang sau"
                                className={`grid h-9 w-9 place-items-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-200/70 disabled:pointer-events-none disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800 ${FOCUS_RING}`}
                            >
                                <Chevron dir="right" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {activeTab === "gold" ? (
                <GoldPriceBoard prices={initialGoldPrices} series={initialGoldSeries} world={initialGoldWorld} moves={initialGoldMoves} />
            ) : news.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
                    <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                        <BookmarkIcon className="h-6 w-6" />
                    </div>
                    <p className="font-medium text-zinc-700 dark:text-zinc-300">
                        {showSavedOnly ? "Chưa có bài nào được lưu ở mục này" : "Chưa có tin trong mục này"}
                    </p>
                    {showSavedOnly && (
                        <p className="mt-1 text-sm text-zinc-500">Bấm biểu tượng dấu trang trên mỗi bài để lưu lại đọc sau.</p>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {currentNews.map((item, index) => (
                        <ArticleCard
                            key={item.url}
                            item={item}
                            eager={index < 3}
                            currentYear={currentYear}
                            onToggle={handleToggleStatus}
                        />
                    ))}
                </div>
            )}

            {/* Phân trang chính */}
            {showPager && (
                <nav aria-label="Phân trang" className="mt-10 flex items-center justify-center gap-1 sm:gap-2">
                    <button
                        type="button"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`flex h-10 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-300 disabled:pointer-events-none disabled:opacity-40 sm:px-4 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 ${FOCUS_RING}`}
                    >
                        <Chevron dir="left" />
                        <span className="hidden sm:inline">Trang trước</span>
                    </button>

                    {getPaginationItems(currentPage, totalPages).map((p, index) =>
                        p === '...' ? (
                            <span key={`dots-${index}`} className="grid h-10 w-6 place-items-center text-zinc-400 sm:w-8" aria-hidden="true">…</span>
                        ) : (
                            <button
                                key={p}
                                type="button"
                                onClick={() => goToPage(p as number)}
                                aria-current={currentPage === p ? "page" : undefined}
                                aria-label={`Trang ${p}`}
                                className={`grid h-10 min-w-10 place-items-center rounded-lg px-2 text-sm font-semibold tabular-nums transition-colors ${FOCUS_RING} ${currentPage === p
                                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                    : "text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                    }`}
                            >
                                {p}
                            </button>
                        )
                    )}

                    <button
                        type="button"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`flex h-10 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-300 disabled:pointer-events-none disabled:opacity-40 sm:px-4 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 ${FOCUS_RING}`}
                    >
                        <span className="hidden sm:inline">Trang sau</span>
                        <Chevron dir="right" />
                    </button>
                </nav>
            )}

            {/* Trang chi gui phan dau; bai cu hon tai khi can */}
            {isNewsTab(activeTab) && !showSavedOnly && hasMore[activeTab as CategoryKey] && currentPage >= totalPages && (
                <div className="mt-8 flex justify-center">
                    <button
                        type="button"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className={`rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-300 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 ${FOCUS_RING}`}
                    >
                        {loadingMore ? "Đang tải…" : "Tải thêm bài cũ hơn"}
                    </button>
                </div>
            )}
        </>
    );
}

interface ArticleCardProps {
    item: NewsItem;
    /** 3 thẻ đầu nằm trong màn hình đầu tiên - tải ảnh ngay */
    eager: boolean;
    currentYear?: number;
    onToggle: (item: NewsItem, field: 'isHidden' | 'isSaved') => void;
}

function ArticleCard({ item, eager, currentYear, onToggle }: ArticleCardProps) {
    const [imageFailed, setImageFailed] = useState(false);
    const source = sourceLabel(item.url);
    const showImage = item.thumbnail && !imageFailed;

    // Nút lưu/ẩn: hiện khi rê chuột hoặc focus; máy cảm ứng (không có hover) luôn hiện
    const revealOnHover = "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100";

    return (
        <article className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-[border-color,box-shadow] duration-200 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
            <div className="relative aspect-[16/9] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                {showImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh từ nhiều báo, không qua next/image
                    <img
                        src={item.thumbnail}
                        alt=""
                        loading={eager ? "eager" : "lazy"}
                        decoding="async"
                        onError={() => setImageFailed(true)}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                    />
                ) : (
                    <div className="grid h-full w-full place-items-center text-sm font-semibold text-zinc-400">
                        {source || "Không có ảnh"}
                    </div>
                )}

                {/* z-10: nổi trên link phủ toàn thẻ */}
                <div className="absolute right-3 top-3 z-10 flex gap-1.5">
                    <button
                        type="button"
                        onClick={() => onToggle(item, 'isSaved')}
                        aria-pressed={item.isSaved}
                        aria-label={item.isSaved ? "Bỏ lưu bài viết" : "Lưu bài viết"}
                        title={item.isSaved ? "Bỏ lưu" : "Lưu bài viết"}
                        className={`grid h-9 w-9 place-items-center rounded-lg shadow-sm backdrop-blur-md transition-[opacity,background-color,color] duration-150 ${FOCUS_RING} ${item.isSaved
                            ? "bg-red-700 text-white opacity-100"
                            : `bg-white/90 text-zinc-700 hover:bg-white hover:text-zinc-950 dark:bg-zinc-900/90 dark:text-zinc-300 ${revealOnHover}`
                            }`}
                    >
                        <BookmarkIcon filled={item.isSaved} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onToggle(item, 'isHidden')}
                        aria-label="Ẩn bài viết"
                        title="Ẩn bài viết"
                        className={`grid h-9 w-9 place-items-center rounded-lg bg-white/90 text-zinc-700 shadow-sm backdrop-blur-md transition-[opacity,background-color,color] duration-150 hover:bg-zinc-900 hover:text-white dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-100 dark:hover:text-zinc-900 ${FOCUS_RING} ${revealOnHover}`}
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="flex flex-1 flex-col p-4 sm:p-5">
                <div className="mb-2 flex items-center gap-2 text-xs">
                    {source && <span className="font-semibold text-red-700 dark:text-red-400">{source}</span>}
                    {source && <span className="text-zinc-300 dark:text-zinc-600" aria-hidden="true">•</span>}
                    <time className="tabular-nums text-zinc-500 dark:text-zinc-400">{shortArticleDate(item.date, currentYear)}</time>
                </div>

                <h2 className="mb-2 text-[17px] font-bold leading-snug text-zinc-950 dark:text-zinc-50">
                    {/* after: phủ cả thẻ -> bấm đâu trên thẻ cũng mở bài */}
                    <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="line-clamp-3 decoration-red-700/40 decoration-2 underline-offset-4 after:absolute after:inset-0 after:content-[''] group-hover:underline focus-visible:outline-none dark:decoration-red-400/50"
                    >
                        {item.title}
                    </a>
                </h2>

                <p className="line-clamp-5 whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {item.summary}
                </p>
            </div>
            {/* Viền focus cho link phủ thẻ (outline trên <a> bị overflow-hidden cắt) */}
            <span className="pointer-events-none absolute inset-0 rounded-xl ring-red-700 ring-offset-0 group-has-[a:focus-visible]:ring-2 dark:ring-red-400" aria-hidden="true" />
        </article>
    );
}
