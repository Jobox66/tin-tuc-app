import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    vnDateTimeToEpoch, isGoldFetchDue, planTrim, toDeleteRanges,
    selectPendingSummaries, nextSummaryStatus, NewsRowRef,
    SUMMARY_PENDING, SUMMARY_RETRY, SUMMARY_DONE, SUMMARY_FAILED,
} from './sync-plan';

const MIN = 60_000;

test('vnDateTimeToEpoch: doc dung dinh dang vi-VN (gio truoc ngay) theo gio VN', () => {
    assert.equal(vnDateTimeToEpoch('08:28:07 23/9/2026'), Date.parse('2026-09-23T08:28:07+07:00'));
    assert.equal(vnDateTimeToEpoch('8:05:00 1/11/2026'), Date.parse('2026-11-01T08:05:00+07:00'));
    assert.equal(vnDateTimeToEpoch(undefined), null);
    assert.equal(vnDateTimeToEpoch(''), null);
    assert.equal(vnDateTimeToEpoch('khong phai ngay'), null);
    assert.equal(vnDateTimeToEpoch('23/9/2026'), null);
});

test('vnDateTimeToEpoch: khop voi chuoi ma toLocaleString(vi-VN) that su sinh ra', () => {
    // Day la cach sync ghi o Z1 - neu ICU doi dinh dang thi test nay phai do
    for (const iso of ['2026-11-03T00:00:05Z', '2026-01-09T16:59:59Z', '2026-12-31T23:30:00Z']) {
        const ms = Date.parse(iso);
        const text = new Date(ms).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        assert.equal(vnDateTimeToEpoch(text), ms, `chuoi "${text}"`);
    }
});

test('isGoldFetchDue: nhip 30 phut, co bu 2 phut', () => {
    const now = Date.parse('2026-11-03T10:00:00+07:00');
    const every30 = 30 * MIN;
    assert.equal(isGoldFetchDue(null, now, every30), true, 'chua co moc -> lay');
    assert.equal(isGoldFetchDue(now - 10 * MIN, now, every30), false);
    assert.equal(isGoldFetchDue(now - 27 * MIN, now, every30), false);
    assert.equal(isGoldFetchDue(now - 28 * MIN, now, every30), true, '28 + 2 phut bu = 30');
    assert.equal(isGoldFetchDue(now - 45 * MIN, now, every30), true);
    assert.equal(isGoldFetchDue(now + 60 * MIN, now, every30), true, 'moc o tuong lai -> khong ket vinh vien');
    assert.equal(isGoldFetchDue(now - 1 * MIN, now, 0), true, 'nhip 0 = luot nao cung lay');
});

const ref = (row: number, timestamp: number, isSaved = false, status = ''): NewsRowRef =>
    ({ row, url: `https://x/${row}`, timestamp, isSaved, status });

test('planTrim: chua vuot tran + slack thi khong xoa gi', () => {
    const rows = Array.from({ length: 105 }, (_, i) => ref(i + 2, 1000 + i));
    assert.deepEqual(planTrim(rows, 100, 5), []);
    assert.deepEqual(planTrim(rows, 100, 10), []);
});

test('planTrim: xoa bai cu nhat ve dung tran, KHONG xoa bai da luu', () => {
    // dong 2..11, timestamp giam dan theo dong (moi nhat o tren) -> cu nhat o duoi
    const rows = Array.from({ length: 10 }, (_, i) => ref(i + 2, 10_000 - i));
    rows[9].isSaved = true;   // dong 11 - cu nhat nhung da luu
    const del = planTrim(rows, 7, 0);
    assert.equal(del.length, 3);
    assert.ok(!del.includes(11), 'bai da luu bi xoa');
    assert.deepEqual([...del].sort((a, b) => a - b), [8, 9, 10]);
});

test('planTrim: timestamp hong bi coi la cu nhat', () => {
    const rows = [ref(2, 500), ref(3, NaN), ref(4, 900), ref(5, 0)];
    assert.deepEqual(planTrim(rows, 2, 0).sort((a, b) => a - b), [3, 5]);
});

test('planTrim: toan bai da luu thi khong xoa duoc gi', () => {
    const rows = [ref(2, 1, true), ref(3, 2, true), ref(4, 3, true)];
    assert.deepEqual(planTrim(rows, 1, 0), []);
});

test('toDeleteRanges: gom khoang lien tiep, xep tu duoi len, chi so 0-based', () => {
    assert.deepEqual(toDeleteRanges([2, 3, 4, 7, 9, 10]), [
        { startIndex: 8, endIndex: 10 },
        { startIndex: 6, endIndex: 7 },
        { startIndex: 1, endIndex: 4 },
    ]);
    assert.deepEqual(toDeleteRanges([]), []);
    assert.deepEqual(toDeleteRanges([5, 5, 5]), [{ startIndex: 4, endIndex: 5 }]);
});

test('toDeleteRanges: ap lan luot cac khoang len luoi cho ra dung cac dong con lai', () => {
    // Mo phong cach Sheets ap tung lenh deleteDimension trong batch theo thu tu
    const grid = Array.from({ length: 20 }, (_, i) => i + 1); // grid[idx] = so dong goc
    const del = [2, 3, 4, 7, 9, 10, 15, 20];
    for (const r of toDeleteRanges(del)) grid.splice(r.startIndex, r.endIndex - r.startIndex);
    const expected = Array.from({ length: 20 }, (_, i) => i + 1).filter(n => !del.includes(n));
    assert.deepEqual(grid, expected);
});

test('selectPendingSummaries: chi PENDING/RETRY, moi nhat truoc, co gioi han', () => {
    const rows = [
        ref(2, 100, false, SUMMARY_PENDING),
        ref(3, 300, false, SUMMARY_DONE),
        ref(4, 200, false, SUMMARY_RETRY),
        ref(5, 400, false, ''),              // dong cu, khong tom tat lai
        ref(6, 500, false, SUMMARY_FAILED),
        ref(7, 250, false, SUMMARY_PENDING),
    ];
    assert.deepEqual(selectPendingSummaries(rows, 10).map(r => r.row), [7, 4, 2]);
    assert.deepEqual(selectPendingSummaries(rows, 2).map(r => r.row), [7, 4]);
    assert.deepEqual(selectPendingSummaries(rows, 0), []);
});

test('nextSummaryStatus: thanh cong -> DONE, hong lan 1 -> RETRY, lan 2 -> FAILED', () => {
    assert.equal(nextSummaryStatus(SUMMARY_PENDING, true), SUMMARY_DONE);
    assert.equal(nextSummaryStatus(SUMMARY_RETRY, true), SUMMARY_DONE);
    assert.equal(nextSummaryStatus(SUMMARY_PENDING, false), SUMMARY_RETRY);
    assert.equal(nextSummaryStatus(SUMMARY_RETRY, false), SUMMARY_FAILED);
});
