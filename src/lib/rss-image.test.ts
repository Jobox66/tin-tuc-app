import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstImgSrc, pickThumbnail } from './rss-image';

// Mau lay tu RSS that ngay 09/11/2026

test('Tuoi Tre: anh chi nam o <enclosure>', () => {
    const url = 'https://cdn2.tuoitre.vn/thumb_w/1200/471584752817336320/2026/11/9/abc-crop-1794189922249399210057.jpg';
    assert.equal(pickThumbnail({
        enclosure: { url, type: 'image/jpeg' },
        content: 'Quốc hội thông qua nghị quyết dự toán ngân sách nhà nước năm 2027...',
    }), url);
});

test('Vietstock: <img> nhay don, duong dan co dau cach -> ma hoa %20', () => {
    const html = "<img alt='' width='120' height='90' src='https://image.vietstock.vn/2026/11/07/Down 13_819791.jpg'/>Các cổ phiếu nóng...";
    assert.equal(pickThumbnail({ content: html }), 'https://image.vietstock.vn/2026/11/07/Down%2013_819791.jpg');
});

test('VnExpress / CafeF: <img> nhay kep trong description', () => {
    const v = 'https://i1-vnexpress.vnecdn.net/2026/11/09/x-1794186259.jpg?w=1200&h=0&q=100&dpr=1&fit=crop&s=71y';
    assert.equal(pickThumbnail({ content: `<a href="https://vnexpress.net/a-5142284.html"><img src="${v}"></a></br>Mưa từ đêm...` }), v);
    const c = 'https://cafefcdn.com/zoom/600_315/203337114487263232/2026/11/9/avatar1794188172509-17941881733972134186792.png';
    assert.equal(pickThumbnail({ content: `<a href="https://cafef.vn/x.chn"><img src="${c}"></a> Giá vàng hôm nay` }), c);
});

test('enclosure uu tien hon <img>; enclosure khong phai anh thi bo qua', () => {
    assert.equal(pickThumbnail({ enclosure: { url: 'https://a/x.jpg', type: 'image/jpeg' }, content: '<img src="https://a/y.jpg">' }), 'https://a/x.jpg');
    assert.equal(pickThumbnail({ enclosure: { url: 'https://a/podcast.mp3', type: 'audio/mpeg' }, content: '<img src="https://a/y.jpg">' }), 'https://a/y.jpg');
    // enclosure thieu type nhung duoi la anh -> van nhan
    assert.equal(pickThumbnail({ enclosure: { url: 'https://a/x.webp' } }), 'https://a/x.webp');
});

test('media:content va &amp; trong thuoc tinh', () => {
    assert.equal(pickThumbnail({ 'media:content': [{ $: { url: 'https://a/m.jpg?w=1&amp;h=2' } }] }), 'https://a/m.jpg?w=1&h=2');
    assert.equal(firstImgSrc('<IMG SRC = "https://a/b.png">'), 'https://a/b.png');
});

test('khong co anh hoac duong dan khong phai http(s) -> chuoi rong', () => {
    assert.equal(pickThumbnail({ content: 'Chỉ có chữ' }), '');
    assert.equal(pickThumbnail({}), '');
    assert.equal(firstImgSrc('<img src="data:image/gif;base64,R0lGOD">'), '');
    assert.equal(firstImgSrc('<img src="/relative.jpg">'), '');
});
