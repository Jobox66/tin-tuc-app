"use client";

import { useState, useMemo } from "react";
import { GoldPriceRow, GoldSeries } from "@/lib/google-sheets";
import { GoldType, GOLD_TYPE_LABELS, classifyGoldType } from "@/lib/gold-price";
import GoldPriceChart from "./GoldPriceChart";

interface GoldPriceBoardProps {
    prices: GoldPriceRow[];
    series?: GoldSeries[];
}

type TypeFilter = GoldType | "all";
type RangeKey = 7 | 30 | 90 | 0;

const TYPE_ORDER: GoldType[] = ["nhan", "mieng", "trangsuc", "nguyenlieu", "khac"];
const BRAND_ORDER = ["SJC", "BTMC", "PNJ", "Nguyên liệu", "Khác"];
const BRAND_TITLES: Record<string, string> = {
    SJC: "Vàng miếng SJC",
    BTMC: "Bảo Tín Minh Châu",
    PNJ: "PNJ",
    "Nguyên liệu": "Vàng nguyên liệu",
    "Khác": "Thương hiệu khác",
};
const RANGES: { key: RangeKey; label: string }[] = [
    { key: 7, label: "7 ngày" },
    { key: 30, label: "30 ngày" },
    { key: 90, label: "90 ngày" },
    { key: 0, label: "Tất cả" },
];

const toNumber = (v: string | number) => parseInt(String(v).replace(/\D/g, ""), 10) || 0;
const fmt = (v: number) => (v > 0 ? v.toLocaleString("en-US") : "—");

export default function GoldPriceBoard({ prices, series = [] }: GoldPriceBoardProps) {
    const [viewMode, setViewMode] = useState<"current" | "history">("current");
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
    const [pickedProduct, setPickedProduct] = useState<string>("");
    const [range, setRange] = useState<RangeKey>(30);

    // Các loại vàng thực sự có trong dữ liệu
    const availableTypes = useMemo(() => {
        const present = new Set<GoldType>();
        prices.forEach(p => present.add(classifyGoldType(p.name)));
        series.forEach(s => present.add(s.type));
        return TYPE_ORDER.filter(t => present.has(t));
    }, [prices, series]);

    const filteredPrices = useMemo(
        () => (typeFilter === "all" ? prices : prices.filter(p => classifyGoldType(p.name) === typeFilter)),
        [prices, typeFilter]
    );

    const filteredSeries = useMemo(
        () => (typeFilter === "all" ? series : series.filter(s => s.type === typeFilter)),
        [series, typeFilter]
    );

    // Sản phẩm đang xem: giữ lựa chọn của người dùng nếu còn hợp lệ, không thì lấy cái đầu
    const activeSeries =
        filteredSeries.find(s => `${s.brand}|${s.name}` === pickedProduct) || filteredSeries[0];

    const visiblePoints = useMemo(() => {
        if (!activeSeries) return [];
        return range === 0 ? activeSeries.points : activeSeries.points.slice(-range);
    }, [activeSeries, range]);

    // Bảng chi tiết: mới nhất lên đầu, kèm chênh lệch mua-bán và thay đổi so ngày trước
    const tableRows = useMemo(() => {
        return visiblePoints
            .map((p, i) => {
                const prev = i > 0 ? visiblePoints[i - 1] : null;
                const deltaSell = prev && prev.sell > 0 && p.sell > 0 ? p.sell - prev.sell : null;
                return { ...p, spread: p.sell > 0 && p.buy > 0 ? p.sell - p.buy : 0, deltaSell };
            })
            .reverse();
    }, [visiblePoints]);

    if (!prices || prices.length === 0) {
        return (
            <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-20 text-center bg-white/50 dark:bg-zinc-900/50">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <p className="text-zinc-500 font-medium">Chưa có dữ liệu giá vàng. Vui lòng đợi hệ thống đồng bộ.</p>
            </div>
        );
    }

    const worldPrice = prices[0]?.worldPrice || "0";
    const lastUpdate = prices[0]?.timestamp
        ? new Date(parseInt(prices[0].timestamp)).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
        : prices[0]?.date;

    const renderTable = (data: GoldPriceRow[], title: string) => {
        if (data.length === 0) return null;
        return (
            <div className="mb-10" key={title}>
                <h3 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span className="w-2 h-6 bg-amber-500 rounded-full inline-block"></span>
                    {title}
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                            <tr>
                                <th className="px-6 py-4 font-extrabold uppercase tracking-wider text-xs">Sản phẩm</th>
                                <th className="px-6 py-4 font-extrabold uppercase tracking-wider text-xs">Loại</th>
                                <th className="px-6 py-4 font-extrabold uppercase tracking-wider text-xs text-right">Mua vào (VNĐ)</th>
                                <th className="px-6 py-4 font-extrabold uppercase tracking-wider text-xs text-right">Bán ra (VNĐ)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                            {data.map((item, idx) => {
                                // Fix number parsing issue from formatted strings (like 16.550.000)
                                const buy = toNumber(item.buyPrice);
                                const sell = toNumber(item.sellPrice);
                                const type = classifyGoldType(item.name);
                                return (
                                    <tr key={`${item.name}-${idx}`} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">{item.name}</td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                                {GOLD_TYPE_LABELS[type]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-lg tabular-nums group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 transition-colors">
                                                {fmt(buy)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-lg tabular-nums group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40 transition-colors">
                                                {fmt(sell)}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-gradient-to-br from-zinc-800 to-zinc-950 dark:from-zinc-900 dark:to-black p-8 rounded-3xl text-zinc-100 shadow-xl shadow-zinc-900/20 relative overflow-hidden border border-zinc-700/50">
                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-zinc-600 opacity-10 rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-32 h-32 bg-amber-500 opacity-10 rounded-full blur-xl"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-amber-500/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-amber-500/20">
                            <span className="text-xl">🥇</span>
                        </div>
                        <h2 className="text-3xl font-black tracking-tight text-white">Giá Vàng Trực Tuyến</h2>
                    </div>
                    <p className="text-zinc-400 text-sm font-medium flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Đồng bộ lúc: {lastUpdate}
                    </p>
                </div>

                <div className="relative z-10 bg-zinc-800/50 backdrop-blur-md px-6 py-4 rounded-2xl border border-zinc-700/50 text-right shrink-0">
                    <p className="text-xs text-zinc-400 mb-1 uppercase font-bold tracking-wider">Giá thế giới (USD/oz)</p>
                    <p className="text-3xl font-black text-amber-400">${worldPrice}</p>
                </div>
            </div>

            {/* Bộ lọc - một hàng, đặt trên toàn bộ nội dung nó chi phối */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mr-1">Loại vàng:</span>
                {(["all", ...availableTypes] as TypeFilter[]).map(t => (
                    <button
                        key={t}
                        onClick={() => setTypeFilter(t)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all duration-200 ${typeFilter === t
                            ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20"
                            : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-amber-500"
                            }`}
                    >
                        {t === "all" ? "Tất cả" : GOLD_TYPE_LABELS[t]}
                    </button>
                ))}
            </div>

            {/* Toggle View Mode */}
            <div className="flex justify-center mb-8">
                <div className="bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl flex items-center border border-zinc-200 dark:border-zinc-700/50 shadow-inner">
                    {(["current", "history"] as const).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${viewMode === mode
                                ? "bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-500 shadow-sm"
                                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                                }`}
                        >
                            {mode === "current" ? "Bảng giá hiện tại" : "Biến động lịch sử"}
                        </button>
                    ))}
                </div>
            </div>

            {viewMode === "current" ? (
                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {filteredPrices.length === 0 ? (
                        <p className="text-zinc-500 py-12 text-center bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
                            Không có mặt hàng nào thuộc loại này.
                        </p>
                    ) : (
                        BRAND_ORDER.map(brand =>
                            renderTable(filteredPrices.filter(p => p.brand === brand), BRAND_TITLES[brand])
                        )
                    )}
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {!activeSeries || activeSeries.points.length === 0 ? (
                        <p className="text-zinc-500 py-12 text-center bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
                            Chưa có đủ dữ liệu lịch sử cho loại vàng này.
                        </p>
                    ) : (
                        <>
                            {/* Bộ lọc của khu vực lịch sử */}
                            <div className="flex flex-wrap items-center gap-4">
                                <label className="flex items-center gap-2 text-sm font-bold text-zinc-500 dark:text-zinc-400">
                                    Sản phẩm:
                                    <select
                                        value={`${activeSeries.brand}|${activeSeries.name}`}
                                        onChange={e => setPickedProduct(e.target.value)}
                                        className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-bold text-sm max-w-[22rem] focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    >
                                        {filteredSeries.map(s => (
                                            <option key={`${s.brand}|${s.name}`} value={`${s.brand}|${s.name}`}>
                                                [{s.brand}] {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                                    {RANGES.map(r => (
                                        <button
                                            key={r.key}
                                            onClick={() => setRange(r.key)}
                                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${range === r.key
                                                ? "bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-500 shadow-sm"
                                                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                                                }`}
                                        >
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Biểu đồ */}
                            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
                                <h3 className="text-xl font-bold mb-1 text-zinc-900 dark:text-zinc-100">
                                    {activeSeries.name}
                                </h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                                    {activeSeries.brand} · {GOLD_TYPE_LABELS[activeSeries.type]} · {visiblePoints.length} ngày có dữ liệu
                                </p>
                                <GoldPriceChart points={visiblePoints} productName={activeSeries.name} />
                            </div>

                            {/* Bảng chi tiết phía dưới - bản song sinh của biểu đồ */}
                            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
                                <h3 className="text-lg font-bold mb-6 text-zinc-900 dark:text-zinc-100">Chi tiết theo ngày</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[640px] text-left text-sm whitespace-nowrap">
                                        <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                                            <tr className="text-xs uppercase tracking-wider font-extrabold">
                                                <th className="px-4 py-3">Ngày</th>
                                                <th className="px-4 py-3 text-right">Mua vào (VNĐ)</th>
                                                <th className="px-4 py-3 text-right">Bán ra (VNĐ)</th>
                                                <th className="px-4 py-3 text-right">Chênh lệch</th>
                                                <th className="px-4 py-3 text-right">So ngày trước</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                            {tableRows.map(row => (
                                                <tr key={row.day} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">{row.day}</td>
                                                    <td className="px-4 py-3 text-right font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums">{fmt(row.buy)}</td>
                                                    <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-500 tabular-nums">{fmt(row.sell)}</td>
                                                    <td className="px-4 py-3 text-right text-zinc-500 dark:text-zinc-400 tabular-nums">{fmt(row.spread)}</td>
                                                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                                                        {row.deltaSell === null ? (
                                                            <span className="text-zinc-400">—</span>
                                                        ) : row.deltaSell === 0 ? (
                                                            <span className="text-zinc-500">0</span>
                                                        ) : (
                                                            <span className={row.deltaSell > 0 ? "text-emerald-600 dark:text-emerald-500" : "text-red-600 dark:text-red-500"}>
                                                                {row.deltaSell > 0 ? "▲ +" : "▼ "}
                                                                {row.deltaSell.toLocaleString("en-US")}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="mt-6 text-sm text-zinc-500 flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Mỗi ngày lấy bản ghi mới nhất. Dữ liệu lưu trữ tự động qua Google Sheets.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
