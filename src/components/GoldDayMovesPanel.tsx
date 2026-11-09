"use client";

import { useState, useMemo } from "react";
import type { GoldDayMoves } from "@/lib/gold-moves";
import { buildMoveTable } from "@/lib/gold-moves";
import { BRAND_SECTIONS, BRAND_REPRESENTATIVE } from "@/lib/gold-price";

const BRAND_TITLES: Record<string, string> = {
    SJC: "SJC",
    PNJ: "PNJ",
    BTMC: "BTMC",
};

const fmt = (v: number) => (v > 0 ? v.toLocaleString("en-US") : "—");

function Delta({ value }: { value: number | null }) {
    if (value === null || value === 0) return null;
    return (
        <span className={`ml-1.5 text-[11px] font-bold tabular-nums ${value > 0 ? "text-emerald-600 dark:text-emerald-500" : "text-red-600 dark:text-red-500"}`}>
            {value > 0 ? "▲" : "▼"}{Math.abs(value).toLocaleString("en-US")}
        </span>
    );
}

/**
 * Khung nho "Bien dong trong ngay": bang theo gio cua mat hang tieu bieu moi nha,
 * chon nhanh giua 7 ngay gan nhat. Du lieu da gop san o server (vai chuc diem)
 * nen doi ngay khong goi lai server.
 */
export default function GoldDayMovesPanel({ moves = [] }: { moves?: GoldDayMoves[] }) {
    const [side, setSide] = useState<"sell" | "buy">("sell");
    const [pickedDay, setPickedDay] = useState<string>("");

    // moves da xep ngay moi nhat truoc o tang du lieu
    const active = moves.find(m => m.day === pickedDay) ?? moves[0];
    const rows = useMemo(() => (active ? buildMoveTable(active, side) : []), [active, side]);

    if (!active) return null;

    return (
        <section className="mb-12">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Biến động trong ngày</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Mỗi dòng là một mức giá; giờ là lần cuối hệ thống thấy mức giá đó.
                    </p>
                </div>
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

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                {/* Chon ngay */}
                <div className="flex gap-2 overflow-x-auto px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
                    {moves.map((m, i) => (
                        <button
                            key={m.day}
                            onClick={() => setPickedDay(m.day)}
                            className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold tabular-nums border transition-all ${m.day === active.day
                                ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-amber-500"
                                }`}
                        >
                            {m.day}{i === 0 ? " · mới nhất" : ""}
                        </button>
                    ))}
                </div>

                <div className="max-h-80 overflow-auto">
                    <table className="w-full min-w-[520px] text-left text-sm whitespace-nowrap">
                        <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                            <tr className="text-xs uppercase tracking-wider font-extrabold">
                                <th className="px-5 py-3">Giờ</th>
                                {BRAND_SECTIONS.map(b => (
                                    <th key={b} className="px-5 py-3 text-right">{BRAND_TITLES[b]}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                            {rows.map(row => (
                                <tr key={row.ts} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-5 py-2.5 font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{row.time.slice(0, 5)}</td>
                                    {BRAND_SECTIONS.map(b => {
                                        const cell = row.cells[b];
                                        const changed = cell?.delta != null && cell.delta !== 0;
                                        return (
                                            <td key={b} className="px-5 py-2.5 text-right tabular-nums">
                                                <span className={changed ? "font-bold text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}>
                                                    {cell ? fmt(cell.value) : "—"}
                                                </span>
                                                {cell && <Delta value={cell.delta} />}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p className="px-5 py-3 text-[11px] text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">
                    Mặt hàng tiêu biểu: {BRAND_SECTIONS.map(b => `${BRAND_TITLES[b]} — ${BRAND_REPRESENTATIVE[b]}`).join(" · ")}.
                    Số đậm kèm ▲▼ là lúc giá đổi so với dòng ngay dưới; số mờ là giá không đổi.
                </p>
            </div>
        </section>
    );
}
