import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planGoldWrites, dayOfVnDateTime, GoldTailRow } from './sync-plan';
import { buildDayMoves, buildMoveTable, GoldMoveRowInput } from './gold-moves';
import { BRAND_REPRESENTATIVE } from './gold-price';

const SJC = BRAND_REPRESENTATIVE.SJC;
const PNJ = BRAND_REPRESENTATIVE.PNJ;

// ===== planGoldWrites: vi du anh dua ra =====
const tailRow = (row: number, date: string, name: string, buy: string, sell: string, brand = 'SJC'): GoldTailRow =>
    ({ row, date, brand, name, buy, sell });
const item = (name: string, buy: number, sell: number, brand = 'SJC') => ({ brand, name, buy, sell });

test('dayOfVnDateTime', () => {
    assert.equal(dayOfVnDateTime('08:00:00 6/11/2026'), '6/11/2026');
    assert.equal(dayOfVnDateTime(''), '');
});

test('planGoldWrites: 8h 13.500 -> 9h van 13.500 thi GHI DE dong cu', () => {
    const tail = [tailRow(10, '08:00:00 6/11/2026', SJC, '13500', '13700')];
    const plan = planGoldWrites(tail, [item(SJC, 13500, 13700)], '09:00:00 6/11/2026');
    assert.deepEqual(plan.overwrite.map(o => o.row), [10]);
    assert.equal(plan.append.length, 0);
});

test('planGoldWrites: 10h len 13.600 thi THEM dong moi', () => {
    const tail = [tailRow(10, '09:00:00 6/11/2026', SJC, '13500', '13700')];
    const plan = planGoldWrites(tail, [item(SJC, 13600, 13800)], '10:00:00 6/11/2026');
    assert.equal(plan.overwrite.length, 0);
    assert.equal(plan.append.length, 1);
});

test('planGoldWrites: chi doi gia MUA cung tinh la doi', () => {
    const tail = [tailRow(10, '09:00:00 6/11/2026', SJC, '13500', '13700')];
    assert.equal(planGoldWrites(tail, [item(SJC, 13400, 13700)], '10:00:00 6/11/2026').append.length, 1);
});

test('planGoldWrites: sang NGAY MOI thi them dong du gia khong doi (giu diem cua ngay cu)', () => {
    const tail = [tailRow(10, '23:50:00 5/11/2026', SJC, '13500', '13700')];
    const plan = planGoldWrites(tail, [item(SJC, 13500, 13700)], '00:05:00 6/11/2026');
    assert.equal(plan.overwrite.length, 0);
    assert.equal(plan.append.length, 1);
});

test('planGoldWrites: so voi dong MOI NHAT cua tung mat hang, khong nham giua cac mat hang', () => {
    const tail = [
        tailRow(10, '08:00:00 6/11/2026', SJC, '13500', '13700'),
        tailRow(11, '08:00:00 6/11/2026', PNJ, '13000', '13300', 'PNJ'),
        tailRow(12, '09:00:00 6/11/2026', SJC, '13600', '13800'),   // muc moi hon cua SJC
    ];
    const plan = planGoldWrites(tail, [item(SJC, 13600, 13800), item(PNJ, 13000, 13300, 'PNJ'), item('MAT HANG MOI', 1, 2)], '10:00:00 6/11/2026');
    assert.deepEqual(plan.overwrite.map(o => o.row).sort(), [11, 12]);
    assert.deepEqual(plan.append.map(a => a.name), ['MAT HANG MOI']);
});

test('planGoldWrites: gia doc tu sheet la chuoi van so dung voi so', () => {
    const tail = [tailRow(10, '08:00:00 6/11/2026', SJC, '15,180,000', '15380000')];
    assert.equal(planGoldWrites(tail, [item(SJC, 15180000, 15380000)], '09:00:00 6/11/2026').overwrite.length, 1);
});

// ===== buildDayMoves / buildMoveTable =====
const row = (date: string, brand: string, buy: number, sell: number, name = BRAND_REPRESENTATIVE[brand]): GoldMoveRowInput =>
    ({ date, brand, name, buyPrice: String(buy), sellPrice: String(sell) });

test('buildDayMoves: chi mat hang tieu bieu, ngay moi nhat truoc, toi da N ngay', () => {
    const rows = [
        row('08:00:00 4/11/2026', 'SJC', 1, 2),
        row('08:00:00 5/11/2026', 'SJC', 1, 2),
        row('08:00:00 6/11/2026', 'SJC', 1, 2),
        row('08:00:00 6/11/2026', 'SJC', 9, 9, 'KHONG PHAI TIEU BIEU'),
        row('08:00:00 6/11/2026', 'Khác', 9, 9, 'X'),
    ];
    const moves = buildDayMoves(rows, 2);
    assert.deepEqual(moves.map(m => m.day), ['6/11/2026', '5/11/2026']);
    assert.equal(moves[0].brands.SJC.length, 1);
    assert.equal(moves[0].brands['Khác'], undefined);
});

test('buildDayMoves: du lieu CU (moi lan lay 1 dong) duoc gop, giu gio muon nhat cua moi muc gia', () => {
    const rows = [
        row('08:00:00 6/11/2026', 'SJC', 13500, 13700),
        row('09:00:00 6/11/2026', 'SJC', 13500, 13700),
        row('10:00:00 6/11/2026', 'SJC', 13600, 13800),
        row('11:00:00 6/11/2026', 'SJC', 13600, 13800),
    ];
    const pts = buildDayMoves(rows)[0].brands.SJC;
    assert.deepEqual(pts.map(p => [p.time, p.sell]), [['09:00:00', 13700], ['11:00:00', 13800]]);
});

test('buildDayMoves: ngay 10/11 xep sau 9/11 dung thu tu thoi gian (khong so chuoi)', () => {
    const moves = buildDayMoves([row('08:00:00 9/11/2026', 'SJC', 1, 2), row('08:00:00 10/11/2026', 'SJC', 1, 2)]);
    assert.deepEqual(moves.map(m => m.day), ['10/11/2026', '9/11/2026']);
});

test('buildMoveTable: moi nhat truoc, tinh chenh lech, nha khong doi thi delta 0', () => {
    const moves = buildDayMoves([
        row('09:00:00 6/11/2026', 'SJC', 13500, 13700),
        row('14:00:00 6/11/2026', 'SJC', 13600, 13800),
        row('10:00:00 6/11/2026', 'PNJ', 13000, 13300),
        row('14:00:00 6/11/2026', 'PNJ', 13100, 13400),
    ])[0];
    const table = buildMoveTable(moves, 'sell');
    assert.deepEqual(table.map(r => r.time), ['14:00:00', '10:00:00', '09:00:00']);

    // 09:00: SJC 13700 (muc dau), PNJ: muc dau tien co "lan cuoi thay" >= 09:00 la 13300
    assert.deepEqual(table[2].cells.SJC, { value: 13700, delta: null });
    assert.deepEqual(table[2].cells.PNJ, { value: 13300, delta: null });
    // 10:00: SJC da sang muc 13800 (lan cuoi thay 14:00 >= 10:00)
    assert.deepEqual(table[1].cells.SJC, { value: 13800, delta: 100 });
    assert.deepEqual(table[1].cells.PNJ, { value: 13300, delta: 0 });
    // 14:00: PNJ len 13400
    assert.deepEqual(table[0].cells.PNJ, { value: 13400, delta: 100 });
    assert.deepEqual(table[0].cells.SJC, { value: 13800, delta: 0 });
    assert.equal(table[0].cells.BTMC, null, 'nha khong co du lieu -> null');
});

test('buildMoveTable: nha ngung co du lieu tu som thi cac moc sau de trong', () => {
    const moves = buildDayMoves([
        row('09:00:00 6/11/2026', 'SJC', 1, 100),
        row('15:00:00 6/11/2026', 'PNJ', 1, 200),
    ])[0];
    const table = buildMoveTable(moves, 'sell');
    assert.equal(table[0].time, '15:00:00');
    assert.equal(table[0].cells.SJC, null);
});
