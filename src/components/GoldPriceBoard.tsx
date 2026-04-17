"use client";

import { GoldPriceRow } from "@/lib/google-sheets";

interface GoldPriceBoardProps {
    prices: GoldPriceRow[];
}

export default function GoldPriceBoard({ prices }: GoldPriceBoardProps) {
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
    // Usually timestamp is milliseconds
    const lastUpdate = prices[0]?.timestamp ? new Date(parseInt(prices[0].timestamp)).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : prices[0]?.date;

    const sjcPrices = prices.filter(p => p.brand === 'SJC');
    const btmcPrices = prices.filter(p => p.brand === 'BTMC');
    const otherPrices = prices.filter(p => p.brand !== 'SJC' && p.brand !== 'BTMC');

    const renderTable = (data: GoldPriceRow[], title: string) => {
        if (data.length === 0) return null;
        return (
            <div className="mb-10">
                <h3 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span className="w-2 h-6 bg-indigo-600 rounded-full inline-block"></span>
                    {title}
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                            <tr>
                                <th className="px-6 py-4 font-extrabold uppercase tracking-wider text-xs">Sản phẩm</th>
                                <th className="px-6 py-4 font-extrabold uppercase tracking-wider text-xs text-right">Mua vào (VNĐ)</th>
                                <th className="px-6 py-4 font-extrabold uppercase tracking-wider text-xs text-right">Bán ra (VNĐ)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                            {data.map((item, idx) => {
                                const buy = parseInt(item.buyPrice, 10);
                                const sell = parseInt(item.sellPrice, 10);
                                return (
                                    <tr key={idx} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">{item.name}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-lg group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-colors">
                                                {buy > 0 ? buy.toLocaleString('vi-VN') : '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-3 py-1 rounded-lg group-hover:bg-rose-100 dark:group-hover:bg-rose-900/40 transition-colors">
                                                {sell > 0 ? sell.toLocaleString('vi-VN') : '—'}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10 bg-gradient-to-br from-indigo-500 to-purple-700 p-8 rounded-3xl text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-32 h-32 bg-purple-400 opacity-20 rounded-full blur-xl"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                            <span className="text-xl">🥇</span>
                        </div>
                        <h2 className="text-3xl font-black tracking-tight">Giá Vàng Trực Tuyến</h2>
                    </div>
                    <p className="text-indigo-100/90 text-sm font-medium flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Đồng bộ lúc: {lastUpdate}
                    </p>
                </div>
                
                <div className="relative z-10 bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 text-right shrink-0">
                    <p className="text-xs text-indigo-100/80 mb-1 uppercase font-bold tracking-wider">Giá thế giới (USD/oz)</p>
                    <p className="text-3xl font-black">${worldPrice}</p>
                </div>
            </div>
            
            <div className="space-y-2">
                {renderTable(sjcPrices, "Vàng miếng SJC")}
                {renderTable(btmcPrices, "Vàng Bảo Tín Minh Châu")}
                {renderTable(otherPrices, "Thương hiệu khác (Nhẫn, Nguyên liệu)")}
            </div>
        </div>
    );
}
