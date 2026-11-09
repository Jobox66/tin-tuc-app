import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDuplicateRemoval, planCleanup, NewsRowRef, SUMMARY_DONE, SUMMARY_PENDING } from './sync-plan';

const r = (row: number, url: string, extra: Partial<NewsRowRef> = {}): NewsRowRef =>
    ({ row, url, timestamp: 1000 + row, isSaved: false, status: '', ...extra });

test('planDuplicateRemoval: khong co trung thi khong xoa', () => {
    assert.deepEqual(planDuplicateRemoval([r(2, 'a'), r(3, 'b')]), []);
});

test('planDuplicateRemoval: giu dong o tren, xoa ban trung', () => {
    assert.deepEqual(planDuplicateRemoval([r(2, 'a'), r(3, 'b'), r(4, 'a'), r(5, 'a')]).sort(), [4, 5]);
});

test('planDuplicateRemoval: uu tien giu ban DA LUU, roi ban da tom tat', () => {
    assert.deepEqual(planDuplicateRemoval([r(2, 'a'), r(3, 'a', { isSaved: true })]), [2]);
    assert.deepEqual(planDuplicateRemoval([r(2, 'a', { status: SUMMARY_PENDING }), r(3, 'a', { status: SUMMARY_DONE })]), [2]);
});

test('planCleanup: don trung xong moi tinh tran - trung khong bi tinh hai lan', () => {
    // 4 dong, 1 dong trung -> con 3 = dung tran 3 -> chi xoa ban trung
    const rows = [r(2, 'a'), r(3, 'b'), r(4, 'c'), r(5, 'a')];
    assert.deepEqual(planCleanup(rows, 3, 0), [5]);
    // tran 2 -> xoa ban trung + bai cu nhat con lai
    assert.deepEqual(planCleanup(rows, 2, 0).sort(), [2, 5]);
});
