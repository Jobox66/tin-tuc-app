/**
 * Bien dong gia vang TRONG NGAY cho khung "Biến động trong ngày".
 * Thuan, khong goi mang, khong import googleapis -> dung duoc o ca server lan
 * trinh duyet (xem ranh gioi client/server o gold-price.ts).
 *
 * Moi diem la MOT MUC GIA, gio di kem la LAN CUOI he thong thay muc gia do
 * (cach ghi theo thay doi tu 06/11/2026). Du lieu cu (moi lan lay mot dong) duoc
 * gop lai theo cung quy tac nen hien thi giong het.
 */
import { BRAND_REPRESENTATIVE, BRAND_SECTIONS, dayToTimestamp } from './gold-price';

export interface GoldMovePoint {
    time: string;   // "14:05:12"
    ts: number;     // de sap xep / so sanh
    buy: number;
    sell: number;
}

export interface GoldDayMoves {
    day: string;                              // "6/11/2026"
    brands: Record<string, GoldMovePoint[]>;  // theo mat hang tieu bieu moi nha, tang dan theo gio
}

export interface GoldMoveRowInput {
    date: string;       // "HH:MM:SS D/M/YYYY"
    brand: string;
    name: string;
    buyPrice: string;
    sellPrice: string;
}

/** So ngay gan nhat co khung bien dong */
export const MOVE_DAYS = 7;

const toNumber = (v: string) => parseInt(String(v).replace(/\D/g, ''), 10) || 0;
const dayOf = (d: string) => d.split(' ').find(p => p.includes('/')) || '';
const timeOf = (d: string) => d.split(' ').find(p => p.includes(':')) || '';

/** Moc gio day du de sap xep (cung he quy chieu voi dayToTimestamp) */
function stampOf(date: string): number {
    const [h = 0, m = 0, s = 0] = timeOf(date).split(':').map(Number);
    return dayToTimestamp(dayOf(date)) + ((h * 3600) + (m * 60) + s) * 1000;
}

/**
 * `maxDays` ngay gan nhat CO DU LIEU, ngay moi nhat truoc.
 * Chi lay mat hang tieu bieu cua moi nha; gop cac muc gia lien tiep giong nhau,
 * giu gio muon nhat.
 */
export function buildDayMoves(rows: GoldMoveRowInput[], maxDays: number = MOVE_DAYS): GoldDayMoves[] {
    const byDay = new Map<string, Record<string, GoldMovePoint[]>>();

    for (const row of rows) {
        const brand = row.brand;
        if (!(BRAND_SECTIONS as readonly string[]).includes(brand)) continue;
        if (BRAND_REPRESENTATIVE[brand] !== row.name) continue;
        const day = dayOf(row.date);
        if (!day) continue;

        let brands = byDay.get(day);
        if (!brands) { brands = {}; byDay.set(day, brands); }
        (brands[brand] ||= []).push({
            time: timeOf(row.date),
            ts: stampOf(row.date),
            buy: toNumber(row.buyPrice),
            sell: toNumber(row.sellPrice),
        });
    }

    const days = Array.from(byDay.keys())
        .sort((a, b) => dayToTimestamp(b) - dayToTimestamp(a))
        .slice(0, Math.max(0, maxDays));

    return days.map(day => {
        const brands: Record<string, GoldMovePoint[]> = {};
        for (const [brand, points] of Object.entries(byDay.get(day)!)) {
            const sorted = [...points].sort((a, b) => a.ts - b.ts);
            const merged: GoldMovePoint[] = [];
            for (const p of sorted) {
                const last = merged[merged.length - 1];
                if (last && last.buy === p.buy && last.sell === p.sell) merged[merged.length - 1] = p;
                else merged.push(p);
            }
            brands[brand] = merged;
        }
        return { day, brands };
    });
}

export interface GoldMoveCell {
    value: number;
    delta: number | null;   // so voi dong lien truoc (som hon); null = khong so duoc
}

export interface GoldMoveTableRow {
    time: string;
    ts: number;
    cells: Record<string, GoldMoveCell | null>;   // null = nha do khong co du lieu luc nay
}

/**
 * Bang theo gio cua mot ngay, MOI NHAT TRUOC.
 * Moi dong la mot moc gio co it nhat mot nha doi gia (hoac moc cuoi cung).
 * Gia cua mot nha tai moc t = muc gia dau tien co "lan cuoi thay" >= t.
 */
export function buildMoveTable(moves: GoldDayMoves, side: 'buy' | 'sell'): GoldMoveTableRow[] {
    const brands = BRAND_SECTIONS.filter(b => (moves.brands[b]?.length ?? 0) > 0);
    const times = new Map<number, string>();
    brands.forEach(b => moves.brands[b].forEach(p => times.set(p.ts, p.time)));
    const ordered = Array.from(times.entries()).sort((a, b) => a[0] - b[0]);

    const valueAt = (brand: string, ts: number): number | null => {
        const hit = moves.brands[brand].find(p => p.ts >= ts);
        return hit ? hit[side] : null;
    };

    const rows: GoldMoveTableRow[] = [];
    let prev: Record<string, number | null> = {};
    for (const [ts, time] of ordered) {
        const cells: Record<string, GoldMoveCell | null> = {};
        const current: Record<string, number | null> = {};
        for (const b of BRAND_SECTIONS) {
            const v = moves.brands[b]?.length ? valueAt(b, ts) : null;
            current[b] = v;
            if (v === null || v <= 0) { cells[b] = null; continue; }
            const before = prev[b];
            cells[b] = { value: v, delta: before != null && before > 0 ? v - before : null };
        }
        rows.push({ time, ts, cells });
        prev = current;
    }
    return rows.reverse();
}
