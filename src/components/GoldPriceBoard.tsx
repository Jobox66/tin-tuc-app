"use client";

import { useState, useMemo } from "react";
import { GoldPriceRow } from "@/lib/google-sheets";

interface GoldPriceBoardProps {
    prices: GoldPriceRow[];
    history?: GoldPriceRow[];
}

export default function GoldPriceBoard({ prices, history = [] }: GoldPriceBoardProps) {
    const [viewMode, setViewMode] = useState<'current' | 'history'>('current');

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
    const lastUpdate = prices[0]?.timestamp ? new Date(parseInt(prices[0].timestamp)).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : prices[0]?.date;

    const sjcPrices = prices.filter(p => p.brand === 'SJC');
    const btmcPrices = prices.filter(p => p.brand === 'BTMC');
    const otherPrices = prices.filter(p => p.brand !== 'SJC' && p.brand !== 'BTMC');

    // Mảng lịch sử để vẽ biến động giá của một số mặt hàng chính (SJC)
    const historySJC = useMemo(() => {
        if (!history || history.length === 0) return [];
        // Extract SJC history only
        const sjc = history.filter(p => p.brand === 'SJC' || p.name.includes('SJC') || p.name.includes('TRÒN TRƠN'));
        
        // Group by Date to find unique snapshots
        const dateMap = new Map<string, typeof sjc>();
        sjc.forEach(item => {
            const parts = item.date.split(' ');
            const day = parts[0]; // e.g. "17/04/2026"
            if (!dateMap.has(day)) {
                dateMap.set(day, []);
            }
            dateMap.get(day)!.push(item);
        });

        // Get last 7 days
        const sortedDays = Array.from(dateMap.keys()).reverse().slice(0, 7).reverse();

        // Build chart data
        return sortedDays.map(day => {
            const items = dateMap.get(day)!;
            const sjcItem = items.find(i => i.name.includes('SJC'));
            const nhanItem = items.find(i => i.name.includes('TRÒN TRƠN') || i.brand === 'BTMC');

            return {
                date: day,
                sjcBuy: sjcItem ? parseInt(sjcItem.buyPrice.toString().replace(/\D/g, ''), 10) : 0,
                sjcSell: sjcItem ? parseInt(sjcItem.sellPrice.toString().replace(/\D/g, ''), 10) : 0,
                nhanBuy: nhanItem ? parseInt(nhanItem.buyPrice.toString().replace(/\D/g, ''), 10) : 0,
                nhanSell: nhanItem ? parseInt(nhanItem.sellPrice.toString().replace(/\D/g, ''), 10) : 0,
            };
        });
    }, [history]);

    const renderTable = (data: GoldPriceRow[], title: string) => {
        if (data.length === 0) return null;
        return (
            <div className="mb-10">
                <h3 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span className="w-2 h-6 bg-amber-500 rounded-full inline-block"></span>
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
                                // Fix number parsing issue from formatted strings (like 16.550.000)
                                const buy = parseInt(item.buyPrice.toString().replace(/\D/g, ''), 10) || 0;
                                const sell = parseInt(item.sellPrice.toString().replace(/\D/g, ''), 10) || 0;
                                return (
                                    <tr key={idx} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">{item.name}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-lg group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 transition-colors">
                                                {buy > 0 ? buy.toLocaleString('en-US') : '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-lg group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40 transition-colors">
                                                {sell > 0 ? sell.toLocaleString('en-US') : '—'}
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

            {/* Toggle View Mode */}
            <div className="flex justify-center mb-8">
                <div className="bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl flex items-center border border-zinc-200 dark:border-zinc-700/50 shadow-inner">
                    <button
                        onClick={() => setViewMode('current')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                            viewMode === 'current' 
                            ? "bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-500 shadow-sm" 
                            : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                        }`}
                    >
                        Bảng giá hiện tại
                    </button>
                    <button
                        onClick={() => setViewMode('history')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                            viewMode === 'history' 
                            ? "bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-500 shadow-sm" 
                            : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                        }`}
                    >
                        Biến động lịch sử
                    </button>
                </div>
            </div>
            
            {viewMode === 'current' ? (
                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {renderTable(sjcPrices, "Vàng miếng SJC")}
                    {renderTable(btmcPrices, "Vàng Bảo Tín Minh Châu")}
                    {renderTable(otherPrices, "Thương hiệu khác (Nhẫn, Nguyên liệu)")}
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
                        <h3 className="text-xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">
                            Biến động giá Vàng miếng SJC & Nhẫn Trơn (7 ngày qua)
                        </h3>
                        
                        {historySJC.length === 0 ? (
                            <p className="text-zinc-500 py-10 text-center bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">Chưa có đủ dữ liệu lịch sử.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[600px] text-left text-sm whitespace-nowrap">
                                    <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                                        <tr>
                                            <th className="px-4 py-4 font-semibold">Ngày</th>
                                            <th className="px-4 py-4 font-semibold text-right" colSpan={2}>SJC (VNĐ)</th>
                                            <th className="px-4 py-4 font-semibold text-right" colSpan={2}>Nhẫn Trơn (VNĐ)</th>
                                        </tr>
                                        <tr className="text-xs uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-extrabold bg-zinc-50/50 dark:bg-zinc-900/50">
                                            <th className="px-4 py-2"></th>
                                            <th className="px-4 py-2 text-right">Mua</th>
                                            <th className="px-4 py-2 text-right">Bán</th>
                                            <th className="px-4 py-2 text-right">Mua</th>
                                            <th className="px-4 py-2 text-right">Bán</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                        {historySJC.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100">{item.date}</td>
                                                <td className="px-4 py-4 text-right">
                                                    <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{item.sjcBuy > 0 ? item.sjcBuy.toLocaleString('en-US') : '—'}</span>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <span className="text-amber-600 dark:text-amber-500 font-semibold">{item.sjcSell > 0 ? item.sjcSell.toLocaleString('en-US') : '—'}</span>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{item.nhanBuy > 0 ? item.nhanBuy.toLocaleString('en-US') : '—'}</span>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <span className="text-amber-600 dark:text-amber-500 font-semibold">{item.nhanSell > 0 ? item.nhanSell.toLocaleString('en-US') : '—'}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <p className="mt-4 text-sm text-zinc-500 flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Dữ liệu được lưu trữ tự động qua Google Sheets.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
