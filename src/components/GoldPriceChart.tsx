"use client";

import { useMemo, useState } from "react";

/**
 * Line chart biến động giá vàng - SVG thuần, không thêm dependency.
 *
 * Palette lấy 4 slot categorical đã chạy validator, pass cả light lẫn dark
 * (CVD ΔE 9.1 light / 8.4 dark, normal-vision 22.9 / 19.8).
 * Light mode có 2 màu dưới ngưỡng contrast 3:1 nên bắt buộc kèm nhãn trực tiếp
 * + bảng số bên dưới - cả hai đều có.
 *
 * Giá thế giới là USD/oz (~4.303), giá trong nước là VNĐ (~14.270.000). Không
 * thể dùng chung một trục, và hai trục y sẽ bịa ra tương quan không có thật.
 * Nên chế độ "Chỉ số" quy tất cả về base 100 tại ngày đầu - một trục duy nhất.
 */

export interface ChartSeries {
    key: string;
    label: string;
    color: "buy" | "sell" | "third" | "world";
    unit: "vnd" | "usd";
    points: { day: string; value: number }[];
}

interface GoldPriceChartProps {
    series: ChartSeries[];
    days: string[];
    mode: "index" | "vnd";
}

const W = 920;
const H = 380;
const PAD = { top: 28, right: 118, bottom: 48, left: 84 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const COLOR_VAR: Record<ChartSeries["color"], string> = {
    buy: "var(--viz-s1)",
    sell: "var(--viz-s2)",
    third: "var(--viz-s3)",
    world: "var(--viz-s4)",
};

const fmtVnd = (v: number) => v.toLocaleString("en-US");
const fmtUsd = (v: number) => `$${v.toLocaleString("en-US")}`;

function niceStep(range: number, target: number): number {
    const raw = range / target;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return step * mag;
}

export default function GoldPriceChart({ series, days, mode }: GoldPriceChartProps) {
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const chart = useMemo(() => {
        if (days.length === 0 || series.length === 0) return null;

        // Giá trị vẽ: chỉ số base 100 (ngày đầu có dữ liệu) hoặc VNĐ tuyệt đối
        const plotted = series.map(s => {
            const byDay = new Map(s.points.map(p => [p.day, p.value]));
            const base = s.points.find(p => p.value > 0)?.value || 0;
            const values = days.map(d => {
                const raw = byDay.get(d);
                if (raw === undefined || raw <= 0) return null;
                return mode === "index" ? (base > 0 ? (raw / base) * 100 : null) : raw;
            });
            return { ...s, values, raw: days.map(d => byDay.get(d) ?? null) };
        });

        const flat = plotted.flatMap(s => s.values).filter((v): v is number => v !== null);
        if (flat.length === 0) return null;

        let min = Math.min(...flat);
        let max = Math.max(...flat);
        if (min === max) { min *= 0.99; max *= 1.01; }
        else { const pad = (max - min) * 0.16; min -= pad; max += pad; }

        const step = niceStep(max - min, 4);
        const tickMin = Math.floor(min / step) * step;
        const tickMax = Math.ceil(max / step) * step;
        const ticks: number[] = [];
        for (let t = tickMin; t <= tickMax + step / 2; t += step) ticks.push(t);

        const x = (i: number) => PAD.left + (days.length === 1 ? PLOT_W / 2 : (i / (days.length - 1)) * PLOT_W);
        const y = (v: number) => PAD.top + PLOT_H - ((v - tickMin) / (tickMax - tickMin)) * PLOT_H;

        const withGeometry = plotted.map(s => {
            const segs: string[] = [];
            let open = false;
            let lastIdx = -1;
            s.values.forEach((v, i) => {
                if (v === null) { open = false; return; }
                segs.push(`${open ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`);
                open = true;
                lastIdx = i;
            });
            const pointCount = s.values.filter(v => v !== null).length;
            return { ...s, path: segs.join(" "), lastIdx, pointCount };
        });

        const maxLabels = 6;
        const stride = Math.max(1, Math.ceil(days.length / maxLabels));
        const xLabels = days
            .map((day, i) => ({ i, day }))
            .filter(({ i }) => i % stride === 0 || i === days.length - 1);

        return { plotted: withGeometry, ticks, x, y, xLabels, tickMin, tickMax };
    }, [series, days, mode]);

    if (!chart) {
        return (
            <p className="text-zinc-500 py-12 text-center bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
                Chưa có dữ liệu để vẽ biểu đồ.
            </p>
        );
    }

    const { plotted, ticks, x, y, xLabels } = chart;

    const handleMove = (e: React.PointerEvent<SVGRectElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        const idx = days.length === 1 ? 0 : Math.round(ratio * (days.length - 1));
        setHoverIdx(Math.min(days.length - 1, Math.max(0, idx)));
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
                    --viz-s1: #2a78d6;
                    --viz-s2: #eb6834;
                    --viz-s3: #1baf7a;
                    --viz-s4: #eda100;
                }
                @media (prefers-color-scheme: dark) {
                    :root:where(:not([data-theme="light"])) .gold-viz {
                        --viz-surface: #18181b;
                        --viz-grid: #2f2f33;
                        --viz-axis: #3f3f45;
                        --viz-text-secondary: #c3c2b7;
                        --viz-text-muted: #9a9a94;
                        --viz-s1: #3987e5;
                        --viz-s2: #d95926;
                        --viz-s3: #199e70;
                        --viz-s4: #c98500;
                    }
                }
                :root[data-theme="dark"] .gold-viz {
                    --viz-surface: #18181b;
                    --viz-grid: #2f2f33;
                    --viz-axis: #3f3f45;
                    --viz-text-secondary: #c3c2b7;
                    --viz-text-muted: #9a9a94;
                    --viz-s1: #3987e5;
                    --viz-s2: #d95926;
                    --viz-s3: #199e70;
                    --viz-s4: #c98500;
                }
            `}</style>

            {/* Legend - kênh nhận diện luôn có mặt, không bắt người đọc dò màu */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-5 text-sm">
                {plotted.map(s => (
                    <span key={s.key} className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 font-medium">
                        <svg width="20" height="4" aria-hidden="true">
                            <line x1="0" y1="2" x2="20" y2="2" stroke={COLOR_VAR[s.color]} strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        {s.label}
                        {s.pointCount <= 1 && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-500">
                                chỉ 1 ngày
                            </span>
                        )}
                    </span>
                ))}
            </div>

            <div className="overflow-x-auto">
                <div className="relative" style={{ minWidth: 640 }}>
                    <svg
                        viewBox={`0 0 ${W} ${H}`}
                        style={{ width: "100%", height: "auto", display: "block" }}
                        role="img"
                        aria-label="Biểu đồ biến động giá vàng theo ngày"
                    >
                        {ticks.map(t => (
                            <g key={t}>
                                <line x1={PAD.left} y1={y(t)} x2={PAD.left + PLOT_W} y2={y(t)} stroke="var(--viz-grid)" strokeWidth="1" />
                                <text
                                    x={PAD.left - 12} y={y(t)} textAnchor="end" dominantBaseline="middle"
                                    fontSize="12" fill="var(--viz-text-muted)" style={{ fontVariantNumeric: "tabular-nums" }}
                                >
                                    {mode === "index" ? t.toFixed(0) : (t / 1_000_000).toFixed(2)}
                                </text>
                            </g>
                        ))}

                        <text x={PAD.left - 12} y={PAD.top - 12} textAnchor="end" fontSize="11" fill="var(--viz-text-muted)" fontWeight="600">
                            {mode === "index" ? "Chỉ số (ngày đầu = 100)" : "Triệu VNĐ"}
                        </text>

                        <line x1={PAD.left} y1={PAD.top + PLOT_H} x2={PAD.left + PLOT_W} y2={PAD.top + PLOT_H} stroke="var(--viz-axis)" strokeWidth="1" />
                        {xLabels.map(({ i, day }) => (
                            <text
                                key={`${day}-${i}`} x={x(i)} y={PAD.top + PLOT_H + 22} textAnchor="middle"
                                fontSize="12" fill="var(--viz-text-muted)" style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                                {day}
                            </text>
                        ))}

                        {hoverIdx !== null && (
                            <line x1={x(hoverIdx)} y1={PAD.top} x2={x(hoverIdx)} y2={PAD.top + PLOT_H} stroke="var(--viz-axis)" strokeWidth="1" />
                        )}

                        {plotted.map(s => (
                            <path key={s.key} d={s.path} fill="none" stroke={COLOR_VAR[s.color]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                        ))}

                        {/* Chuỗi chỉ có 1 điểm sẽ không thành nét - vẽ chấm để không biến mất */}
                        {plotted.filter(s => s.pointCount === 1 && s.lastIdx >= 0).map(s => (
                            <circle
                                key={`dot-${s.key}`} cx={x(s.lastIdx)} cy={y(s.values[s.lastIdx]!)} r="4.5"
                                fill={COLOR_VAR[s.color]} stroke="var(--viz-surface)" strokeWidth="2"
                            />
                        ))}

                        {/* Nhãn trực tiếp ở điểm cuối - bắt buộc với 4 series và với cảnh báo contrast */}
                        {plotted.filter(s => s.lastIdx >= 0).map(s => (
                            <g key={`end-${s.key}`}>
                                <circle cx={x(s.lastIdx)} cy={y(s.values[s.lastIdx]!)} r="4" fill={COLOR_VAR[s.color]} stroke="var(--viz-surface)" strokeWidth="2" />
                                <text
                                    x={x(s.lastIdx) + 12} y={y(s.values[s.lastIdx]!)} dominantBaseline="middle"
                                    fontSize="12" fontWeight="700" fill="var(--viz-text-secondary)"
                                    style={{ fontVariantNumeric: "tabular-nums" }}
                                >
                                    {mode === "index"
                                        ? s.values[s.lastIdx]!.toFixed(1)
                                        : (s.values[s.lastIdx]! / 1_000_000).toFixed(2)}
                                </text>
                            </g>
                        ))}

                        {hoverIdx !== null && plotted.map(s => {
                            const v = s.values[hoverIdx];
                            if (v === null) return null;
                            return (
                                <circle key={`h-${s.key}`} cx={x(hoverIdx)} cy={y(v)} r="4.5" fill={COLOR_VAR[s.color]} stroke="var(--viz-surface)" strokeWidth="2" />
                            );
                        })}

                        <rect
                            x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} fill="transparent"
                            onPointerMove={handleMove}
                            onPointerLeave={() => setHoverIdx(null)}
                        />
                    </svg>

                    {/* Tooltip: luôn hiện GIÁ THẬT, kể cả khi trục đang là chỉ số */}
                    {hoverIdx !== null && (
                        <div
                            className="pointer-events-none absolute z-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg px-4 py-3 text-sm"
                            style={{
                                left: `${(x(hoverIdx) / W) * 100}%`,
                                top: 8,
                                transform: x(hoverIdx) > W * 0.55 ? "translateX(calc(-100% - 14px))" : "translateX(14px)",
                                minWidth: 230,
                            }}
                        >
                            <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 tabular-nums">
                                {days[hoverIdx]}
                            </div>
                            {plotted.map(s => {
                                const raw = s.raw[hoverIdx];
                                if (raw === null || raw === undefined) return null;
                                return (
                                    <div key={`t-${s.key}`} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
                                        <span className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                            <svg width="14" height="4" aria-hidden="true">
                                                <line x1="0" y1="2" x2="14" y2="2" stroke={COLOR_VAR[s.color]} strokeWidth="2" strokeLinecap="round" />
                                            </svg>
                                            {s.label}
                                        </span>
                                        <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                                            {s.unit === "usd" ? fmtUsd(raw) : fmtVnd(raw)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
