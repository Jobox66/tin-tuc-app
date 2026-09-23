"use client";

import { useState, useMemo } from "react";
import type { GoldPriceRow, GoldSeries, GoldWorldPoint } from "@/lib/google-sheets";
import { GOLD_TYPE_LABELS, classifyGoldType, BRAND_REPRESENTATIVE, BRAND_SECTIONS, dayToTimestamp } from "@/lib/gold-price";
import GoldPriceChart, { ChartSeries } from "./GoldPriceChart";

interface GoldPriceBoardProps {
    prices: GoldPriceRow[];
    series?: GoldSeries[];
    world?: GoldWorldPoint[];
}

type RangeKey = 7 | 30 | 90 | 0;

const RANGES: { key: RangeKey; label: string }[] = [
    { key: 7, label: "7 ngày" },
    { key: 30, label: "30 ngày" },
    { key: 90, label: "90 ngày" },
    { key: 0, label: "Tất cả" },
];

const BRAND_TITLES: Record<string, string> = {
    SJC: "SJC",
    PNJ: "PNJ",
    BTMC: "Bảo Tín Minh Châu",
};
const BRAND_COLORS: Record<string, ChartSeries["color"]> = {
    SJC: "s1",
    PNJ: "s2",
    BTMC: "s3",
};

const toNumber = (v: string | number) => parseInt(String(v).replace(/\D/g, ""), 10) || 0;
const fmt = (v: number) => (v > 0 ? v.toLocaleString("en-US") : "—");

export default function GoldPriceBoard({ prices, series = [], world = [] }: GoldPriceBoardProps) {
    const [range, setRange] = useState<RangeKey>(30);

    // Trục ngày dùng chung cho mọi chuỗi.
    // PHẢI sắp xếp: Set trả về theo thứ tự gặp lần đầu, mà mỗi nguồn có những
    // ngày đứt quãng khác nhau - PNJ có 19-22/9 còn SJC/BTMC thì không, khiến
    // 23/9 bị đẩy lên trước 19/9 trên trục.
    const allDays = useMemo(() => {
        const set = new Set<string>();
        series.forEach(s => s.points.forEach(p => set.add(p.day)));
        world.forEach(w => set.add(w.day));
        return Array.from(set).sort((a, b) => dayToTimestamp(a) - dayToTimestamp(b));
    }, [series, world]);

    // Lọc theo NGÀY THẬT chứ không phải "N mốc dữ liệu cuối" - dữ liệu có quãng
    // đứt (1/6 -> 17/9) nên lấy N phần tử cuối sẽ trộn lẫn tháng 5 vào "7 ngày".
    const days = useMemo(() => {
        if (range === 0 || allDays.length === 0) return allDays;
        // Mốc tính từ NGÀY MỚI NHẤT CÓ DỮ LIỆU, không phải Date.now(): gọi hàm
        // không thuần khiết trong render vừa vi phạm quy tắc React vừa gây lệch
        // giữa HTML dựng ở server và lần render đầu ở trình duyệt.
        const latest = dayToTimestamp(allDays[allDays.length - 1]);
        const cutoff = latest - (range - 1) * 86_400_000;
        return allDays.filter(d => dayToTimestamp(d) >= cutoff);
    }, [allDays, range]);

    // Mỗi hãng một đường, lấy mặt hàng đại diện; cộng thêm đường giá thế giới
    const chartSeries = useMemo<ChartSeries[]>(() => {
        const out: ChartSeries[] = [];

        for (const brand of BRAND_SECTIONS) {
            const repName = BRAND_REPRESENTATIVE[brand];
            const found = series.find(s => s.brand === brand && s.name === repName)
                || series.find(s => s.brand === brand);
            if (!found) continue;
            out.push({
                key: `${brand}`,
                label: `${BRAND_TITLES[brand]} — ${found.name}`,
                color: BRAND_COLORS[brand],
                points: found.points.map(p => ({ day: p.day, value: p.sell > 0 ? p.sell : p.buy })),
            });
        }

        // Giá thế giới đã quy về VNĐ/chỉ nên vẽ chung trục được.
        // Vẽ nét đứt để phân biệt: đây là giá quy đổi, không phải giá niêm yết.
        if (world.length > 0) {
            out.push({
                key: "world",
                label: "Thế giới (quy đổi)",
                color: "s4",
                dashed: true,
                points: world.map(w => ({ day: w.day, value: w.vnd, usd: w.usd })),
            });
        }

        return out;
    }, [series, world]);

    // Bảng chi tiết: các mặt hàng đại diện, mới nhất lên đầu
    const tableRows = useMemo(() => {
        const byDay = new Map<string, Record<string, number>>();
        days.forEach(d => byDay.set(d, {}));

        chartSeries.filter(s => s.key !== "world").forEach(s => {
            s.points.forEach(p => {
                const row = byDay.get(p.day);
                if (row) row[s.key] = p.value;
            });
        });
        world.forEach(w => {
            const row = byDay.get(w.day);
            if (row) { row.world = w.vnd; row.worldUsd = w.usd; }
        });

        return days
            .map(day => ({ day, values: byDay.get(day)! }))
            .filter(r => Object.keys(r.values).length > 0)
            .reverse();
    }, [days, chartSeries, world]);

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

    const otherPrices = prices.filter(p => !BRAND_SECTIONS.includes(p.brand as typeof BRAND_SECTIONS[number]));

    const renderSection = (title: string, data: GoldPriceRow[], accent: string, subtitle?: string) => {
        if (data.length === 0) return null;
        return (
            <section className="mb-10" key={title}>
                <div className="flex items-baseline gap-3 mb-4">
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <span className={`w-2 h-6 rounded-full inline-block ${accent}`}></span>
                        {title}
                    </h3>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">{data.length} mặt hàng</span>
                    {subtitle && <span className="text-xs text-zinc-400">{subtitle}</span>}
                </div>
                <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                            <tr>
                                <th className="px-6 py-4 font-extrabold uppercase tracking-wider text-xs">Sản phẩm</th>
                                <th className="px-6 py-4 font-extrabold uppercase tracking-wider text-xs">Loại</th>
                                <th className="px-6 py-4 font-extrabold uppercase tracking-wider text-xs text-right">Mua vào (VNĐ)</th>
                                <th className="px-6 py-4 font-extrabold uppercase tracking-wider text-xs text-right">Bán ra (VNĐ)</th>
                                <th className="px-6 py-4 font-extrabold uppercase tracking-wider text-xs text-right">Chênh lệch</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                            {data.map((item, idx) => {
                                const buy = toNumber(item.buyPrice);
                                const sell = toNumber(item.sellPrice);
                                const isRep = BRAND_REPRESENTATIVE[item.brand] === item.name;
                                return (
                                    <tr key={`${item.name}-${idx}`} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">
                                            {item.name}
                                            {isRep && (
                                                <span className="ml-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500">
                                                    trên biểu đồ
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                                {GOLD_TYPE_LABELS[classifyGoldType(item.name)]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">{fmt(buy)}</td>
                                        <td className="px-6 py-4 text-right font-bold text-amber-700 dark:text-amber-500 tabular-nums">{fmt(sell)}</td>
                                        <td className="px-6 py-4 text-right text-zinc-500 dark:text-zinc-400 tabular-nums">
                                            {buy > 0 && sell > 0 ? fmt(sell - buy) : "—"}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        );
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-gradient-to-br from-zinc-800 to-zinc-950 dark:from-zinc-900 dark:to-black p-8 rounded-3xl text-zinc-100 shadow-xl shadow-zinc-900/20 relative overflow-hidden border border-zinc-700/50">
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

            {/* ===== Biến động lịch sử ===== */}
            <section className="mb-12">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                    <div>
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Biến động lịch sử</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Giá bán mặt hàng tiêu biểu mỗi nhà và giá thế giới quy đổi — cùng đơn vị VNĐ/chỉ
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
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
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5">
                        Đường <strong>Thế giới (nét đứt)</strong> là giá USD/oz quy đổi sang VNĐ/chỉ
                        theo tỷ giá bán ra Vietcombank của chính ngày đó
                        (1 chỉ = 3,75g · 1 oz = 31,1035g). Khoảng cách giữa nét đứt và các đường còn lại
                        chính là mức chênh của vàng trong nước so với thế giới. Di chuột để xem giá USD gốc.
                    </p>
                    <GoldPriceChart series={chartSeries} days={days} />
                </div>

                {/* Bảng số - bản song sinh của biểu đồ */}
                <div className="mt-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
                    <h4 className="text-lg font-bold mb-6 text-zinc-900 dark:text-zinc-100">Chi tiết theo ngày (giá bán)</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-left text-sm whitespace-nowrap">
                            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                                <tr className="text-xs uppercase tracking-wider font-extrabold">
                                    <th className="px-4 py-3">Ngày</th>
                                    {BRAND_SECTIONS.map(b => (
                                        <th key={b} className="px-4 py-3 text-right">{BRAND_TITLES[b]} (VNĐ)</th>
                                    ))}
                                    <th className="px-4 py-3 text-right">Thế giới quy đổi (VNĐ)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                {tableRows.map(row => (
                                    <tr key={row.day} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">{row.day}</td>
                                        {BRAND_SECTIONS.map(b => (
                                            <td key={b} className="px-4 py-3 text-right font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums">
                                                {fmt(row.values[b] || 0)}
                                            </td>
                                        ))}
                                        <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-500 tabular-nums">
                                            {row.values.world ? (
                                                <>
                                                    {fmt(row.values.world)}
                                                    {row.values.worldUsd ? (
                                                        <span className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                                            ${row.values.worldUsd.toLocaleString("en-US")}/oz
                                                        </span>
                                                    ) : null}
                                                </>
                                            ) : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* ===== Bảng giá hiện tại, phân khu theo nhà ===== */}
            <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mb-6">Bảng giá hiện tại</h3>
            {renderSection("SJC", prices.filter(p => p.brand === "SJC"), "bg-[#2a78d6]")}
            {renderSection("PNJ", prices.filter(p => p.brand === "PNJ"), "bg-[#eb6834]")}
            {renderSection("Bảo Tín Minh Châu", prices.filter(p => p.brand === "BTMC"), "bg-[#1baf7a]")}
            {renderSection("Khác", otherPrices, "bg-zinc-400", "nguyên liệu, đối tác")}
        </div>
    );
}
