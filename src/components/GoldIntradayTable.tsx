"use client";

import { useState, useMemo } from "react";
import type { GoldIntradaySnapshot } from "@/lib/google-sheets";
import { BRAND_SECTIONS, BRAND_REPRESENTATIVE } from "@/lib/gold-price";

interface GoldIntradayTableProps {
    intraday?: GoldIntradaySnapshot[];
}

const BRAND_TITLES: Record<string, string> = {
    SJC: "SJC",
    PNJ: "PNJ",
    BTMC: "Bảo Tín Minh Châu",
};

const fmt = (v: number) => (v > 0 ? v.toLocaleString("en-US") : "—");

/** Chênh lệch so với lần lấy trước, hiện dưới giá */
function Delta({ value }: { value: number | null }) {
    if (value === null) return null;
    if (value === 0) {
        return <span className="block text-[11px] font-medium text-zinc-400">không đổi</span>;
    }
    return (
        <span
            className={`block text-[11px] font-bold tabular-nums ${value > 0
                ? "text-emerald-600 dark:text-emerald-500"
                : "text-red-600 dark:text-red-500"
                }`}
        >
            {value > 0 ? "▲ +" : "▼ "}
            {value.toLocaleString("en-US")}
        </span>
    );
}

export default function GoldIntradayTable({ intraday = [] }: GoldIntradayTableProps) {
    const [side, setSide] = useState<"sell" | "buy">("sell");

    const days = useMemo(() => {
        // intraday đã sắp xếp tăng dần theo thời gian ở tầng dữ liệu
        return Array.from(new Set(intraday.map(s => s.day))).reverse();
    }, [intraday]);

    const [pickedDay, setPickedDay] = useState<string>("");
    const activeDay = days.includes(pickedDay) ? pickedDay : days[0];

    // Các lần lấy trong ngày đang chọn, kèm chênh lệch so với lần liền trước
    const rows = useMemo(() => {
        if (!activeDay) return [];
        const ofDay = intraday.filter(s => s.day === activeDay);

        return ofDay
            .map((snap, i) => {
                const prev = i > 0 ? ofDay[i - 1] : null;
                const deltas: Record<string, number | null> = {};
                for (const b of BRAND_SECTIONS) {
                    const now = snap.brands[b]?.[side] ?? 0;
                    const before = prev?.brands[b]?.[side] ?? 0;
                    deltas[b] = now > 0 && before > 0 ? now - before : null;
                }
                const worldDelta =
                    prev && snap.worldVnd > 0 && prev.worldVnd > 0 ? snap.worldVnd - prev.worldVnd : null;
                return { snap, deltas, worldDelta };
            })
            .reverse(); // mới nhất lên đầu
    }, [intraday, activeDay, side]);

    // Biên độ trong ngày của từng nhà
    const spread = useMemo(() => {
        const out: Record<string, { min: number; max: number } | null> = {};
        for (const b of BRAND_SECTIONS) {
            const vals = rows.map(r => r.snap.brands[b]?.[side] ?? 0).filter(v => v > 0);
            out[b] = vals.length > 0 ? { min: Math.min(...vals), max: Math.max(...vals) } : null;
        }
        return out;
    }, [rows, side]);

    if (intraday.length === 0 || !activeDay) {
        return (
            <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-20 text-center bg-white/50 dark:bg-zinc-900/50">
                <p className="text-zinc-500 font-medium">Chưa có dữ liệu theo lần lấy. Vui lòng đợi hệ thống đồng bộ.</p>
            </div>
        );
    }

    // So với mốc đầy đủ của TOÀN BỘ dữ liệu, không phải của riêng ngày đang xem:
    // khi một nguồn chết cả ngày thì mốc trong ngày cũng thấp theo, không lộ ra lỗi.
    const fullCount = Math.max(...intraday.map(s => s.itemCount));

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Bộ lọc - một hàng trên toàn bộ nội dung */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">Biến động trong ngày</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Mỗi dòng là một lần hệ thống lấy dữ liệu — {rows.length} lần trong ngày {activeDay}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm font-bold text-zinc-500 dark:text-zinc-400">
                        Ngày:
                        <select
                            value={activeDay}
                            onChange={e => setPickedDay(e.target.value)}
                            className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-bold text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            {days.map(d => {
                                const n = intraday.filter(s => s.day === d).length;
                                return (
                                    <option key={d} value={d}>
                                        {d} ({n} lần)
                                    </option>
                                );
                            })}
                        </select>
                    </label>

                    <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                        {(["sell", "buy"] as const).map(sd => (
                            <button
                                key={sd}
                                onClick={() => setSide(sd)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${side === sd
                                    ? "bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-500 shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                                    }`}
                            >
                                {sd === "sell" ? "Giá bán" : "Giá mua"}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Biên độ trong ngày */}
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
                {BRAND_SECTIONS.map(b => {
                    const sp = spread[b];
                    return (
                        <div key={b} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                                {BRAND_TITLES[b]}
                            </p>
                            {sp ? (
                                <>
                                    <p className="text-xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
                                        {sp.max === sp.min ? "Không đổi" : `${(sp.max - sp.min).toLocaleString("en-US")} VNĐ`}
                                    </p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums mt-1">
                                        {fmt(sp.min)} – {fmt(sp.max)}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-zinc-400">Không có dữ liệu ngày này</p>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-left text-sm whitespace-nowrap">
                        <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                            <tr className="text-xs uppercase tracking-wider font-extrabold">
                                <th className="px-4 py-3">Giờ lấy</th>
                                {BRAND_SECTIONS.map(b => (
                                    <th key={b} className="px-4 py-3 text-right">{BRAND_TITLES[b]} (VNĐ)</th>
                                ))}
                                <th className="px-4 py-3 text-right">Thế giới quy đổi</th>
                                <th className="px-4 py-3 text-right">Số mặt hàng</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                            {rows.map(({ snap, deltas, worldDelta }) => (
                                <tr key={snap.ts} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors align-top">
                                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{snap.time}</td>

                                    {BRAND_SECTIONS.map(b => {
                                        const v = snap.brands[b]?.[side] ?? 0;
                                        return (
                                            <td key={b} className="px-4 py-3 text-right tabular-nums">
                                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{fmt(v)}</span>
                                                <Delta value={deltas[b]} />
                                            </td>
                                        );
                                    })}

                                    <td className="px-4 py-3 text-right tabular-nums">
                                        <span className="font-semibold text-amber-600 dark:text-amber-500">{fmt(snap.worldVnd)}</span>
                                        {snap.worldUsd > 0 && (
                                            <span className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                                ${snap.worldUsd.toLocaleString("en-US")}/oz
                                            </span>
                                        )}
                                        <Delta value={worldDelta} />
                                    </td>

                                    <td className="px-4 py-3 text-right tabular-nums">
                                        <span
                                            className={`text-xs font-bold px-2.5 py-1 rounded-full ${snap.itemCount < fullCount
                                                ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                                                }`}
                                            title={snap.itemCount < fullCount ? `Thiếu ${fullCount - snap.itemCount} mặt hàng so với lần lấy đầy đủ (${fullCount}) - có nguồn lỗi` : undefined}
                                        >
                                            {snap.itemCount}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400 flex items-start gap-2">
                    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>
                        Mỗi nhà lấy mặt hàng tiêu biểu: {BRAND_SECTIONS.map(b => `${BRAND_TITLES[b]} — ${BRAND_REPRESENTATIVE[b]}`).join(" · ")}.
                        Cột <strong>Số mặt hàng</strong> tô đỏ khi lần lấy đó thiếu so với mức đầy đủ ({fullCount} mặt hàng),
                        tức có nguồn bị lỗi. Chênh lệch tính so với lần lấy liền trước trong cùng ngày.
                    </span>
                </p>
            </div>
        </div>
    );
}
