import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialFeed, sortNewsDesc } from './news-feed';
import type { NewsItem } from './google-sheets';

const item = (n: number, extra: Partial<NewsItem> = {}): NewsItem => ({
    title: `t${n}`, summary: '', url: `https://x/${n}`, date: '', thumbnail: '',
    timestamp: n, isHidden: false, isSaved: false, ...extra,
});

test('sortNewsDesc: moi nhat truoc, timestamp hong xuong cuoi, khong sua mang goc', () => {
    const input = [item(1), item(NaN), item(3), item(2)];
    const out = sortNewsDesc(input);
    assert.deepEqual(out.map(i => i.title), ['t3', 't2', 't1', 'tNaN']);
    assert.equal(input[0].title, 't1');
});

test('buildInitialFeed: lay N bai moi nhat, bao con bai cu hon', () => {
    const items = Array.from({ length: 10 }, (_, i) => item(i + 1));
    const feed = buildInitialFeed(items, 3);
    assert.deepEqual(feed.items.map(i => i.timestamp), [10, 9, 8]);
    assert.equal(feed.hasMore, true);
});

test('buildInitialFeed: luon kem MOI bai da luu, ke ca bai cu va bai da an', () => {
    const items = [
        ...Array.from({ length: 10 }, (_, i) => item(i + 1)),
        item(0.5, { isSaved: true }),
        item(0.4, { isSaved: true, isHidden: true }),
    ];
    const feed = buildInitialFeed(items, 2);
    assert.deepEqual(feed.items.map(i => i.timestamp), [10, 9, 0.5, 0.4]);
    assert.equal(feed.items.filter(i => i.isSaved).length, 2);
});

test('buildInitialFeed: bai da an khong tinh vao suat N', () => {
    const items = [item(5, { isHidden: true }), item(4), item(3), item(2, { isHidden: true })];
    const feed = buildInitialFeed(items, 2);
    assert.deepEqual(feed.items.map(i => i.timestamp), [4, 3]);
    assert.equal(feed.hasMore, false, 'chi con bai da an -> khong co gi de tai them');
});

test('buildInitialFeed: it hon N bai thi gui het, khong co nut tai them', () => {
    const feed = buildInitialFeed([item(1), item(2)], 300);
    assert.equal(feed.items.length, 2);
    assert.equal(feed.hasMore, false);
});
