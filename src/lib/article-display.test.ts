import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceLabel, shortArticleDate } from './article-display';

test('sourceLabel: bao quen -> ten bao, bo www', () => {
    assert.equal(sourceLabel('https://vnexpress.net/abc-4977000.html'), 'VnExpress');
    assert.equal(sourceLabel('https://www.tuoitre.vn/x-2026111710.htm'), 'Tuổi Trẻ');
    assert.equal(sourceLabel('https://cafef.vn/a.chn'), 'CafeF');
    assert.equal(sourceLabel('https://kinhdoanh.vnexpress.net/a.html'), 'VnExpress');
});

test('sourceLabel: host la -> ten mien; URL hong -> rong', () => {
    assert.equal(sourceLabel('https://www.example.org/a'), 'example.org');
    assert.equal(sourceLabel('khong-phai-url'), '');
});

test('shortArticleDate: gio truoc ngay, bo giay, them so 0', () => {
    assert.equal(shortArticleDate('10:51:00 17/11/2026', 2026), '10:51 · 17/11');
    assert.equal(shortArticleDate('8:05:09 3/9/2026', 2026), '08:05 · 03/09');
});

test('shortArticleDate: khac nam thi giu nam; sai dang tra nguyen van', () => {
    assert.equal(shortArticleDate('23:59:59 31/12/2025', 2026), '23:59 · 31/12/2025');
    assert.equal(shortArticleDate('Mon, 17 Nov 2026'), 'Mon, 17 Nov 2026');
});
