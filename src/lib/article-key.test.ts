import { test } from 'node:test';
import assert from 'node:assert/strict';
import { articleKey, planDuplicateRemoval, type NewsRowRef } from './sync-plan';
import { buildInitialFeed, dedupeArticles } from './news-feed';
import type { NewsItem } from './google-sheets';

// Ca that do 09/11/2026: cung mot bai VnExpress, 3 lan doi tieu de -> 3 URL
const V1 = 'https://vnexpress.net/ha-noi-mua-giong-nhieu-tuyen-duong-un-tac-5142256.html';
const V2 = 'https://vnexpress.net/ha-noi-mua-giong-nguy-co-tac-duong-5142256.html';
const V3 = 'https://vnexpress.net/ha-noi-mua-lon-gio-cao-diem-thanh-hoa-mua-tren-400-mm-5142256.html';

test('articleKey: VnExpress doi slug nhung cung ma bai -> cung khoa', () => {
    assert.equal(articleKey(V1), 'vnexpress.net#5142256');
    assert.equal(articleKey(V2), articleKey(V1));
    assert.equal(articleKey(V3), articleKey(V1));
    assert.equal(articleKey('https://vnexpress.net/gia-xang-dau-moi-nhat-hom-nay-29-10-5138351.html'),
        articleKey('https://vnexpress.net/gia-xang-dau-cung-tang-5138351.html'));
    // query/fragment khong lam doi khoa
    assert.equal(articleKey(V1 + '?utm_source=rss#box'), articleKey(V1));
});

test('articleKey: Tuoi Tre (.htm) theo ma bai; bai khac ma thi khac khoa', () => {
    assert.equal(articleKey('https://tuoitre.vn/a-b-c-100261028184722795.htm'), 'tuoitre.vn#100261028184722795');
    assert.equal(articleKey('https://tuoitre.vn/x-y-100261028184722795.htm'), 'tuoitre.vn#100261028184722795');
    assert.notEqual(articleKey('https://vnexpress.net/a-5142256.html'), articleKey('https://vnexpress.net/a-5142257.html'));
    // Cung ma so nhung khac bao -> khac bai
    assert.notEqual(articleKey('https://vnexpress.net/a-5142256.html'), articleKey('https://tuoitre.vn/a-5142256.htm'));
});

test('articleKey: bao chua kiem chung (CafeF, Vietstock...) giu nguyen URL', () => {
    const cafef = 'https://cafef.vn/co-phieu-tang-manh-188251109101010123.chn';
    const vs = 'https://vietstock.vn/2026/11/abc-737-1234567.htm';
    assert.equal(articleKey(cafef), cafef);
    assert.equal(articleKey(vs), vs);
    assert.equal(articleKey('  ' + vs + ' '), vs);
});

test('planDuplicateRemoval: gom theo ma bai, giu bai da Luu > DONE > dong tren', () => {
    const r = (row: number, url: string, extra: Partial<NewsRowRef> = {}): NewsRowRef =>
        ({ row, url, timestamp: 1, isSaved: false, status: 'DONE', ...extra });
    // 3 phien ban, khong co bai Luu -> giu dong tren cung (DONE)
    assert.deepEqual(planDuplicateRemoval([r(5055, V1), r(5063, V2), r(5065, V3, { status: 'PENDING' })]).sort(), [5063, 5065]);
    // Phien ban moi nhat da duoc Luu -> giu no
    assert.deepEqual(planDuplicateRemoval([r(10, V1), r(11, V2), r(12, V3, { isSaved: true })]).sort(), [10, 11]);
    // Bai khac ma -> khong dung toi
    assert.deepEqual(planDuplicateRemoval([r(2, 'https://vnexpress.net/a-1111111.html'), r(3, 'https://vnexpress.net/a-2222222.html')]), []);
});

const item = (url: string, extra: Partial<NewsItem> = {}): NewsItem => ({
    title: url, summary: '', url, date: '', thumbnail: '', timestamp: 1, isHidden: false, isSaved: false, ...extra,
});

test('dedupeArticles: moi bai hien mot lan, uu tien ban da Luu, giu thu tu', () => {
    const other = item('https://tuoitre.vn/k-100261028184722795.htm');
    assert.deepEqual(dedupeArticles([item(V1), other, item(V2), item(V3)]).map(i => i.url), [V1, other.url]);
    assert.deepEqual(dedupeArticles([item(V1), item(V2, { isSaved: true }), item(V3)]).map(i => i.url), [V2]);
});

test('buildInitialFeed: dong trung ma bai chi chiem mot suat', () => {
    const feed = buildInitialFeed([item(V1, { timestamp: 5 }), item(V2, { timestamp: 5 }), item('https://vnexpress.net/b-7777777.html', { timestamp: 4 })], 2);
    assert.deepEqual(feed.items.map(i => i.url), [V1, 'https://vnexpress.net/b-7777777.html']);
    assert.equal(feed.hasMore, false);
});
