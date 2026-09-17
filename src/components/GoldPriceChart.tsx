"use client";

import { useMemo, useState } from "react";
import { GoldHistoryPoint } from "@/lib/google-sheets";

/**
 * Line chart biến động giá vàng - SVG thuần, không thêm dependency.
 *
 * Palette: categorical slot 1 (blue) = giá mua, slot 2 (orange) = giá bán.
 * Đã chạy validator: pass cả 6 check ở light (CVD ΔE 24.7 / normal 33.6)
 * lẫn dark (CVD ΔE 26.8 / normal 31.8).
 */

interface GoldPriceChartProps {
    points: GoldHistoryPoint[];
    productName: string;
}

const W = 880;
const H = 360;
const PAD = { top: 28, right: 92, bottom: 48, left: 84 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const fmtFull = (v: number) => v.toLocaleString("en-US");
const fmtTr = (v: number) => (v / 1_000_000).toFixed(2);

/** Chọn bước chia trục Y tròn số (1/2/2.5/5 x 10^n) */
function niceStep(range: number, target: number): number {
    const raw = range / target;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return step * mag;
}

export default function GoldPriceChart({ points, productName }: GoldPriceChartProps) {
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const chart = useMemo(() => {
        const hasSell = points.some(p => p.sell > 0);
        const hasBuy = points.some(p => p.buy > 0);

        const values: number[] = [];
        points.forEach(p => {
            if (p.buy > 0) values.push(p.buy);
            if (p.sell > 0) values.push(p.sell);
        });
        if (values.length === 0) return null;

        let min = Math.min(...values);
        let max = Math.max(...values);
        if (min === max) {
            // Giá phẳng tuyệt đối - tạo biên độ giả để đường không dính mép
            min = min * 0.995;
            max = max * 1.005;
        } else {
            const pad = (max - min) * 0.18;
            min -= pad;
            max += pad;
        }

        const step = niceStep(max - min, 4);
        const tickMin = Math.floor(min / step) * step;
        const tickMax = Math.ceil(max / step) * step;
        const ticks: number[] = [];
        for (let t = tickMin; t <= tickMax + step / 2; t += step) ticks.push(t);

        const x = (i: number) =>
            PAD.left + (points.length === 1 ? PLOT_W / 2 : (i / (points.length - 1)) * PLOT_W);
        const y = (v: number) => PAD.top + PLOT_H - ((v - tickMin) / (tickMax - tickMin)) * PLOT_H;

        const path = (key: "buy" | "sell") => {
            const segs: string[] = [];
            let open = false;
            points.forEach((p, i) => {
                const v = p[key];
                if (v <= 0) { open = false; return; }
                segs.push(`${open ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`);
                open = true;
            });
            return segs.join(" ");
        };

        // Nhãn trục X: tối đa 6 mốc, luôn có điểm đầu và cuối
        const maxLabels = 6;
        const stride = Math.max(1, Math.ceil(points.length / maxLabels));
        const xLabels = points
            .map((p, i) => ({ i, day: p.day }))
            .filter(({ i }) => i % stride === 0 || i === points.length - 1);

        const lastBuyIdx = points.map(p => p.buy).reduce((acc, v, i) => (v > 0 ? i : acc), -1);
        const lastSellIdx = points.map(p => p.sell).reduce((acc, v, i) => (v > 0 ? i : acc), -1);

        return { hasBuy, hasSell, ticks, tickMin, tickMax, x, y, path, xLabels, lastBuyIdx, lastSellIdx };
    }, [points]);

    if (!chart) {
        return (
            <p className="text-zinc-500 py-12 text-center bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
                Chưa có dữ liệu để vẽ biểu đồ.
            </p>
        );
    }

    const { hasBuy, hasSell, ticks, x, y, path, xLabels, lastBuyIdx, lastSellIdx } = chart;
    const seriesCount = (hasBuy ? 1 : 0) + (hasSell ? 1 : 0);
    const hovered = hoverIdx !== null ? points[hoverIdx] : null;

    const handleMove = (e: React.PointerEvent<SVGRectElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        const svgX = PAD.left + ratio * PLOT_W;
        const idx = points.length === 1
            ? 0
            : Math.round(((svgX - PAD.left) / PLOT_W) * (points.length - 1));
        setHoverIdx(Math.min(points.length - 1, Math.max(0, idx)));
    };

    return (
        <div className="gold-viz">
            <style>{`
                .gold-viz {
                    --viz-surface: #ffffff;
                    --viz-grid: #e8e7e3;
                    --viz-axis: #d5d4cf;
                    --viz-text-secondary: #52514e;
                    --viz-text-muted: #7c7b76;
                    --viz-buy: #2a78d6;
                    --viz-sell: #eb6834;
                }
                @media (prefers-color-scheme: dark) {
                    :root:where(:not([data-theme="light"])) .gold-viz {
                        --viz-surface: #18181b;
                        --viz-grid: #2f2f33;
                        --viz-axis: #3f3f45;
                        --viz-text-secondary: #c3c2b7;
                        --viz-text-muted: #9a9a94;
                        --viz-buy: #3987e5;
                        --viz-sell: #d95926;
                    }
                }
                :root[data-theme="dark"] .gold-viz {
                    --viz-surface: #18181b;
                    --viz-grid: #2f2f33;
                    --viz-axis: #3f3f45;
                    --viz-text-secondary: #c3c2b7;
                    --viz-text-muted: #9a9a94;
                    --viz-buy: #3987e5;
                    --viz-sell: #d95926;
                }
            `}</style>

            {/* Legend - luôn hiện khi >= 2 series */}
            {seriesCount >= 2 && (
                <div className="flex items-center gap-6 mb-4 text-sm">
                    <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 font-medium">
                        <svg width="20" height="4" aria-hidden="true">
                            <line x1="0" y1="2" x2="20" y2="2" stroke="var(--viz-buy)" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Giá mua
                    </span>
                    <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 font-medium">
                        <svg width="20" height="4" aria-hidden="true">
                            <line x1="0" y1="2" x2="20" y2="2" stroke="var(--viz-sell)" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Giá bán
                    </span>
                </div>
            )}

            <div className="overflow-x-auto">
                <div className="relative" style={{ minWidth: 620 }}>
                    <svg
                        viewBox={`0 0 ${W} ${H}`}
                        style={{ width: "100%", height: "auto", display: "block" }}
                        role="img"
                        aria-label={`Biểu đồ biến động giá ${productName} theo ngày`}
                    >
                        {/* Gridlines - hairline đặc, lùi về sau */}
                        {ticks.map(t => (
                            <g key={t}>
                                <line
                                    x1={PAD.left} y1={y(t)} x2={PAD.left + PLOT_W} y2={y(t)}
                                    stroke="var(--viz-grid)" strokeWidth="1"
                                />
                                <text
                                    x={PAD.left - 12} y={y(t)} textAnchor="end" dominantBaseline="middle"
                                    fontSize="12" fill="var(--viz-text-muted)"
                                    style={{ fontVariantNumeric: "tabular-nums" }}
                                >
                                    {fmtTr(t)}
                                </text>
                            </g>
                        ))}

                        <text
                            x={PAD.left - 12} y={PAD.top - 12} textAnchor="end"
                            fontSize="11" fill="var(--viz-text-muted)" fontWeight="600"
                        >
                            Triệu VNĐ
                        </text>

                        {/* Trục X */}
                        <line
                            x1={PAD.left} y1={PAD.top + PLOT_H} x2={PAD.left + PLOT_W} y2={PAD.top + PLOT_H}
                            stroke="var(--viz-axis)" strokeWidth="1"
                        />
                        {xLabels.map(({ i, day }) => (
                            <text
                                key={`${day}-${i}`}
                                x={x(i)} y={PAD.top + PLOT_H + 22} textAnchor="middle"
                                fontSize="12" fill="var(--viz-text-muted)"
                                style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                                {day}
                            </text>
                        ))}

                        {/* Crosshair */}
                        {hoverIdx !== null && (
                            <line
                                x1={x(hoverIdx)} y1={PAD.top} x2={x(hoverIdx)} y2={PAD.top + PLOT_H}
                                stroke="var(--viz-axis)" strokeWidth="1"
                            />
                        )}

                        {/* Đường giá - 2px, bo tròn đầu nối */}
                        {hasBuy && (
                            <path d={path("buy")} fill="none" stroke="var(--viz-buy)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                        )}
                        {hasSell && (
                            <path d={path("sell")} fill="none" stroke="var(--viz-sell)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                        )}

                        {/* Điểm cuối + nhãn trực tiếp (chỉ ở endpoint, không dán số lên mọi điểm) */}
                        {hasBuy && lastBuyIdx >= 0 && (
                            <>
                                <circle
                                    cx={x(lastBuyIdx)} cy={y(points[lastBuyIdx].buy)} r="4"
                                    fill="var(--viz-buy)" stroke="var(--viz-surface)" strokeWidth="2"
                                />
                                <text
                                    x={x(lastBuyIdx) + 12} y={y(points[lastBuyIdx].buy)} dominantBaseline="middle"
                                    fontSize="12" fontWeight="700" fill="var(--viz-text-secondary)"
                                    style={{ fontVariantNumeric: "tabular-nums" }}
                                >
                                    {fmtTr(points[lastBuyIdx].buy)}
                                </text>
                            </>
                        )}
                        {hasSell && lastSellIdx >= 0 && (
                            <>
                                <circle
                                    cx={x(lastSellIdx)} cy={y(points[lastSellIdx].sell)} r="4"
                                    fill="var(--viz-sell)" stroke="var(--viz-surface)" strokeWidth="2"
                                />
                                <text
                                    x={x(lastSellIdx) + 12} y={y(points[lastSellIdx].sell)} dominantBaseline="middle"
                                    fontSize="12" fontWeight="700" fill="var(--viz-text-secondary)"
                                    style={{ fontVariantNumeric: "tabular-nums" }}
                                >
                                    {fmtTr(points[lastSellIdx].sell)}
                                </text>
                            </>
                        )}

                        {/* Điểm được hover - vòng viền màu nền 2px */}
                        {hovered && hovered.buy > 0 && (
                            <circle cx={x(hoverIdx!)} cy={y(hovered.buy)} r="4.5" fill="var(--viz-buy)" stroke="var(--viz-surface)" strokeWidth="2" />
                        )}
                        {hovered && hovered.sell > 0 && (
                            <circle cx={x(hoverIdx!)} cy={y(hovered.sell)} r="4.5" fill="var(--viz-sell)" stroke="var(--viz-surface)" strokeWidth="2" />
                        )}

                        {/* Lớp bắt chuột phủ toàn bộ vùng vẽ */}
                        <rect
                            x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H}
                            fill="transparent"
                            onPointerMove={handleMove}
                            onPointerLeave={() => setHoverIdx(null)}
                        />
                    </svg>

                    {/* Tooltip - giá trị nổi bật, tên series phụ */}
                    {hovered && hoverIdx !== null && (
                        <div
                            className="pointer-events-none absolute z-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg px-4 py-3 text-sm"
                            style={{
                                left: `${(x(hoverIdx) / W) * 100}%`,
                                top: 8,
                                transform: x(hoverIdx) > W * 0.6 ? "translateX(calc(-100% - 14px))" : "translateX(14px)",
                                minWidth: 190,
                            }}
                        >
                            <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 tabular-nums">
                                {hovered.day}
                            </div>
                            {hovered.buy > 0 && (
                                <div className="flex items-center justify-between gap-4 mb-1">
                                    <span className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                        <svg width="14" height="4" aria-hidden="true">
                                            <line x1="0" y1="2" x2="14" y2="2" stroke="var(--viz-buy)" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                        Mua
                                    </span>
                                    <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                                        {fmtFull(hovered.buy)}
                                    </span>
                                </div>
                            )}
                            {hovered.sell > 0 && (
                                <div className="flex items-center justify-between gap-4">
                                    <span className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                        <svg width="14" height="4" aria-hidden="true">
                                            <line x1="0" y1="2" x2="14" y2="2" stroke="var(--viz-sell)" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                        Bán
                                    </span>
                                    <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                                        {fmtFull(hovered.sell)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
