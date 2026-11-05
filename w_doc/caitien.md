# Kế hoạch cải tiến tốc độ thu thập tin

> Lập ngày 2026-11-02, cập nhật 2026-11-03 sau khi làm xong các mục Claude tự làm được. **STT = mức độ ưu tiên và cũng là thứ tự làm** (1 làm trước nhất).
> Quyết định của anh (02/11): **chưa chuyển khỏi Google Sheets**; được cắt bớt tin cũ nếu cần; **giá vàng phải giữ toàn bộ lịch sử**.
> Code mới **chưa commit**. Anh review và commit/push; bản v6 chỉ chạy thật sau khi push.

## Danh sách cải tiến

| STT | Hạng mục | Hiện trạng trước khi sửa | Đã làm / Dự kiến | Kết quả đo được | Ai làm | Trạng thái |
|:---:|---|---|---|---|---|---|
| 1 | **Tách nhịp lấy giá vàng khỏi nhịp lấy tin** | Lượt sync nào cũng append ~22 dòng giá vàng; nếu bật trigger 5 phút sẽ thành ~6.300 dòng/ngày | Chỉ lấy khi ô Z1 của `GoldPrice` đã cách ≥ 30 phút (bù 2 phút lệch nhịp). Đổi nhịp bằng biến `GOLD_MIN_INTERVAL_MINUTES`; `--force-gold` để ép lấy | Lượt chạy ngay sau đó bỏ qua đúng ("cách đây 1 phút"). Ở nhịp 30 phút: ~1.060 dòng/ngày | Claude | ✅ Xong |
| 2 | **Sửa bộ kích hoạt ngoài** (cron-job.org → `workflow_dispatch`) | Lượt `workflow_dispatch` cuối là 24/9; các lượt cách nhau **133–430 phút** | Xem lịch sử thực thi trên cron-job.org để biết mã HTTP (401 = token hết hạn, 403 = thiếu quyền `Actions: write`, 404 = sai repo/file, 422 = sai `ref`). Sửa xong đặt lịch 5–10 phút | Kỳ vọng: độ trễ tin từ **2–7 tiếng còn ~5–10 phút** | **Anh** | ☐ Chưa làm. **Làm sau khi đã push v6** (cần mục 1 chạy trước) |
| 3 | **Không chờ BTMC trên runner GitHub** | Thử 4 lần, không có timeout riêng → ước tính ~40s chờ mỗi lượt CI; giá vàng chạy tuần tự trước phần tin | Mọi lời gọi giá vàng có timeout (15s); BTMC chỉ thử 1 lần/giao thức, 6s; giá vàng chạy **song song** với phần tin | Giả lập BTMC không phản hồi: hỏng sau 2×6s, chuyển sang 24h.com.vn đúng; cả lượt vẫn chỉ **14,7s** | Claude | ✅ Xong |
| 4 | **Bỏ cache-buster `?t=` trên URL RSS** | Mọi feed bị gắn `?t=Date.now()` | Bỏ tham số; thêm timeout 15s cho feed (trước là 60s) | Đã đối chiếu 7 feed: bản có và không có `?t=` cho cùng bài đầu tiên. Feed chỉ mất 10–750ms nên **lợi về tốc độ rất nhỏ**; lợi chính là bớt tải cho báo | Claude | ✅ Xong |
| 5 | **Đổi cách ghi tin vào Sheets + giữ bài đã lưu khi cắt** | Ghi đè cả sheet mỗi lượt; cắt theo thời gian nên xoá cả bài đã Lưu; thao tác Lưu/Ẩn bấm trong lúc sync chạy bị ghi đè | Append bài mới vào cuối sheet; ghi tóm tắt theo URL; khi vượt 5.000 + 100 bài thì xoá bài cũ nhất về 5.000, **không xoá bài đã Lưu** | Chạy trên bản sao sheet thật: 0 bài trùng, dòng cũ giữ nguyên, xoá đúng bài cũ nhất, 3/3 bài đã Lưu được giữ | Claude | ✅ Xong |
| 6 | **Tách bước tóm tắt ra khỏi đường lấy tin** | Phải tóm tắt xong mới ghi bài lên sheet | **Lượt nhanh:** RSS → append ngay, cột I = `PENDING`. **Lượt chậm:** Python tóm tắt bài `PENDING`/`RETRY` (tối đa 120 bài/sheet/lượt), hỏng 2 lần → `FAILED` và giữ tóm tắt RSS. Dòng cũ (cột I trống) không bị tóm tắt lại | Tin lên sheet sau **3,2–4,1s**. Cả lượt có 11 bài mới mất **20,4s** (trước: trung vị 88s trên CI). Nhánh lỗi PENDING → RETRY → FAILED đã kiểm | Claude | ✅ Xong |
| 7 | **Giảm tải trang web** | Mỗi lượt mở trang đọc lại ~7MB từ Google rồi gửi cả ~6.800 bài xuống trình duyệt | Trang cache 60s (`revalidate = 60`, Lưu/Ẩn vẫn làm mới ngay); chỉ gửi 300 bài mới nhất mỗi tab + mọi bài đã Lưu; nút **"Tải thêm bài cũ hơn"** ở trang cuối tải phần còn lại | Đo `next start` cùng dữ liệu: bản cũ **9,6MB, TTFB ~1,7s** → bản mới **1,0MB, TTFB ~0,02s** | Claude | ✅ Xong (nút "Tải thêm" mới kiểm qua HTTP, **anh cần bấm thử trên trình duyệt**) |
| 8 | **Gộp lịch sử giá vàng theo ngày** | `GoldPrice` chỉ append, không xoá; lưới 26 cột; trang chỉ đọc 40.000 dòng gần nhất | Thêm sheet `GoldDaily` (mỗi mặt hàng 1 dòng/ngày) giữ vĩnh viễn; dữ liệu từng lần chỉ giữ ~14 ngày; dời Y1/Z1, thu lưới còn 8 cột | Mục 1 đã giảm áp lực, nên mục này **không còn gấp** | Claude viết code; **anh duyệt** trước khi chạy script ghi lên sheet thật | ☐ Chờ ý kiến anh |
| 9 | **Chuyển lượt quét tin nhanh sang Vercel** | Mỗi lượt GitHub Actions tốn ~39s dựng máy | Route `/api/sync` có khoá bí mật, cron-job.org gọi 2–5 phút; GitHub Actions chỉ còn tóm tắt + giá vàng | Nền đã sẵn: lượt nhanh giờ chỉ cần RSS + Sheets, không cần Python | Claude viết code; **anh** cấu hình Vercel + cron-job.org | ☐ Chờ ý kiến anh |
| 10 | **Cache pip/nltk trong workflow** | Mỗi lượt cài lại thư viện Python + tải lại `punkt` | `cache: 'pip'` theo `requirements.txt`, cache `~/nltk_data`, bỏ bước nâng cấp pip, chỉ tải `punkt` khi chưa có | YAML hợp lệ; pip đọc được `requirements.txt` (có BOM). **Chưa chạy trên CI**, phải xem thời gian bước cài ở lượt chạy đầu sau khi push | Claude | ✅ Xong (chờ xác nhận trên CI) |
| 11 | **Sửa 2 nguồn tài chính đã chết** 🆕 | Sheet `Finance` có 1.821 bài **đều từ CafeF**. Vietstock trả trang HTML thay vì RSS; Báo Đầu tư trả feed rỗng (lỗi có từ trước, không do v6) | Thay bằng feed tiếng Việt khác cùng chuyên mục, hoặc bỏ 2 nguồn này | — | **Anh quyết** nguồn thay thế; Claude kiểm feed rồi thêm | ☐ Chờ ý kiến anh |
| 12 | **Tải có điều kiện (ETag / If-Modified-Since)** | — | — | Đã kiểm 7 feed: **không feed nào gửi ETag hay Last-Modified**, nên không áp dụng được | — | ✖ Không áp dụng |
| 13 | **Thay Google Sheets bằng Postgres** | Đọc 5.000 dòng mất 1–1,7s, chưa phải nút thắt | — | — | — | ✖ Không làm (anh quyết 02/11) |

## Kết quả kiểm thử (03/11)

| Kiểm thử | Cách làm | Kết quả |
|---|---|---|
| Unit test các hàm quyết định | `npm test` (16 test: đọc giờ VN, nhịp vàng, chọn dòng cắt, gom khoảng xoá, chọn bài chờ tóm tắt, chuyển trạng thái, chọn bài gửi xuống trang) | ✅ 16/16 |
| Type-check, lint, build | `tsc --noEmit`, `npm run lint`, `npm run build` | ✅ (lint còn đúng 1 cảnh báo `<img>` có từ trước) |
| Chạy cả luồng sync trên bản sao sheet thật | Nhân bản `Sheet1`, `Finance`, `GoldPrice` thành tab `_test_...`, chạy 5 lượt bằng RSS + summarizer Python thật, đối chiếu từng dòng | ✅ 0 bài trùng, dòng cũ giữ nguyên, 11/11 bài mới tóm tắt xong |
| Cắt tỉa giữ bài đã Lưu | Đánh dấu Lưu 3 bài cũ nhất trên tab tạm, cắt về 4.800 | ✅ 3/3 bài đã Lưu được giữ, xoá đúng bài cũ nhất |
| Trang web | `next start` bản mới và bản cũ (HEAD), cùng dữ liệu; gọi server action "tải thêm" qua HTTP | ✅ 600 bài lúc mở trang; action trả đủ 5.000 bài; từ chối yêu cầu đọc sheet ngoài danh sách |
| Dọn dẹp | Xoá tab tạm, tắt server thử, gỡ bản cũ | ✅ File chỉ còn 6 sheet gốc |
| **Chưa kiểm** | Bấm nút "Tải thêm" trên trình duyệt thật; thời gian chạy thật trên runner GitHub; cache pip/nltk | ⏳ Sau khi anh push |

## Việc tiếp theo cần anh

| Thứ tự | Việc | Ghi chú |
|:---:|---|---|
| 1 | Review và commit/push v6 | 9 file sửa + 4 file mới (`sync-plan.ts`, `news-feed.ts` và 2 file test). Lượt chạy đầu sẽ thêm tiêu đề `summaryStatus` vào ô I1 của 2 sheet tin |
| 2 | Mở trang sau khi Vercel deploy, đi tới trang cuối và bấm **"Tải thêm bài cũ hơn"** | Tôi chưa kiểm được trên trình duyệt |
| 3 | Sửa trigger cron-job.org (mục 2) | Làm sau bước 1 để giá vàng không bị lấy theo nhịp 5 phút |
| 4 | Quyết định mục 8, 9, 11 | Nguồn thay cho Vietstock / Báo Đầu tư; có làm `GoldDaily` không; có chuyển lượt nhanh sang Vercel không |
| 5 | Các tham số đang dùng mặc định | Nhịp giá vàng **30 phút**; trần **5.000** bài/sheet; **300** bài/tab lúc mở trang; trang cache **60s**. Đổi số nào thì báo tôi |

## Số đo làm căn cứ

| Chỉ số | Giá trị | Nguồn |
|---|---|---|
| Khoảng cách giữa các lượt sync (60 lượt, 22/10–02/11) | 133–430 phút, tất cả do `schedule` | API GitHub |
| Lượt `workflow_dispatch` | 20, lượt cuối 24/9 | API GitHub |
| Chờ runner nhận việc | 2–3s, máy chủ không quá tải | API GitHub (25 lượt) |
| Dựng máy + cài thư viện | trung vị ~39s | API GitHub (25 lượt) |
| Bước `Run News Sync` (code cũ) | trung vị 88s (61–141s) | API GitHub (25 lượt) |
| Lượt sync v6 tại máy (11 bài mới, có tóm tắt) | 20,4s; tin lên sheet sau 4,1s | Chạy trên bản sao sheet |
| BTMC từ máy anh (trong nước) | 26ms–2,4s | Đo 03/11 |
| Timeout kết nối mặc định của `fetch` (Node) | ~10–11s | Đo tại máy |
| Thời gian tải 7 feed RSS | 10–750ms, không feed nào có ETag/Last-Modified | Đo 03/11 |
| Trang web (bản cũ → bản mới) | 9,6MB → 1,0MB; TTFB ~1,7s → ~0,02s | `next start`, cùng dữ liệu |
| `GoldPrice` | ~10.300 dòng, từ 17/4, 20–30 dòng/lần lấy | Đo tại máy, chỉ đọc |
| Tổng ô lưới cả file | ~549.000 ô = 5,5% giới hạn 10 triệu ô | Đo tại máy, chỉ đọc |

## Các nhận định đã kiểm và loại bỏ

| Nhận định | Lý do loại |
|---|---|
| "Trigger ngoài đã xử lý xong" | Không có lượt `workflow_dispatch` nào kể từ 24/9 |
| "Cài đặt môi trường mất 2–4 phút" | Trung vị ~39s trên 25 lượt |
| "Concurrency đang âm thầm bỏ các lượt" | Từ 21/9 chỉ có 1 lượt bị huỷ |
| "5.000 dòng tin làm chậm việc quét tin" | Đọc mất 1–1,7s; 5.000 dòng chỉ làm chậm trang web, đã sửa ở mục 7 |
| "Bỏ cache-buster giúp quét nhanh hơn rõ rệt" | Feed chỉ mất 10–750ms dù có hay không có `?t=`; lợi ích chính là bớt tải cho báo |
