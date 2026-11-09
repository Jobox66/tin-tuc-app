# Tin Tức App: việc tiếp theo, quyết định đã chốt, tài liệu kỹ thuật

> Cập nhật 06/11/2026. Code đã lên **v5.0** (commit `f323501`, 05/11). Các thay đổi ngày 06/11 (giá vàng ghi theo thay đổi, khung biến động trong ngày, route `/api/sync`, sửa nguồn tài chính) **chưa commit**.

## 1. Việc cần làm tiếp

| # | Việc                                                                                                                                                                            | Ai     | Ghi chú                                                                                                                                                                                                                                                                                                                               |
| :-: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | Vercel: thêm biến `SYNC_SECRET` (chưa cần Redeploy)                                                                                                                        | Anh    | Khoá ngẫu nhiên ≥ 24 ký tự, không đưa vào code hay chat. Cách làm ở mục 3.6. Đặt trước khi push để bản deploy ở bước 2 nhận luôn biến này                                                                                                                                                                  |
| 2 | Commit/push thay đổi ngày 06/11                                                                                                                                               | Anh    | Đã chạy lại trên máy: 32 test pass, `tsc`, `eslint` và `npm run build` không lỗi. 9 file sửa (có xoá `GoldIntradayTable.tsx`), 6 file mới: `src/app/api/sync/route.ts`, `src/lib/news-sync.ts`, `src/lib/gold-moves.ts`, `src/components/GoldDayMovesPanel.tsx`, 2 file test. Push xong Vercel tự deploy |
| 3 | cron-job.org: tạo job gọi `/api/sync` mỗi 5 phút                                                                                                                           | Anh    | Đây là đường lấy tin chính. Bấm "Test run" phải ra `200`                                                                                                                                                                                                                                                                   |
| 4 | Sửa trigger GitHub (`workflow_dispatch`), đặt 10–15 phút một lần                                                                                                        | Anh    | Cần để tóm tắt và giá vàng chạy đều. Từ 24/9 chưa có lượt dispatch nào, lịch `schedule` đang bị GitHub hoãn 4–8 tiếng. Cách làm ở mục 3.7                                                                                                                                                                 |
| 5 | Bấm thử trên trình duyệt: nút "Tải thêm bài cũ hơn" (trang cuối tab Tin Chung) và chọn ngày trong khung "Biến động trong ngày"                                | Anh    | Hai chỗ này mới kiểm qua server, chưa kiểm trên trình duyệt                                                                                                                                                                                                                                                                   |
| 6 | Kiểm tra sau khi anh làm xong bước 2–4: lượt chạy CI, nhịp lấy tin, dữ liệu sheet                                                                                    | Claude |                                                                                                                                                                                                                                                                                                                                        |
| 7 | Quyết định: Vietstock giữ `/0/tin-moi.rss` (đúng feed cũ, chỉ giữ ~4 tiếng bài) hay đổi sang `/144/chung-khoan.rss` (giữ ~2 ngày, chỉ có tin chứng khoán) | Anh    | Đang dùng `tin-moi`. Khi `/api/sync` chạy 5 phút một lần thì không sót bài                                                                                                                                                                                                                                               |
| 8 | Quyết định: xoá hay giữ 3 sheet cũ `International`, `IntlFinance`, `IntlTech`                                                                                        | Anh    | Không còn dùng từ khi bỏ nguồn nước ngoài                                                                                                                                                                                                                                                                                     |

> Lưu ý khi bình luận trực tiếp vào file này: trình soạn thảo bảng anh đang dùng từng không ghi bình luận xuống đĩa. Lưu xong anh mở lại file để chắc chắn, và mở lại bản mới trước khi sửa tiếp.

## 2. Quyết định đã chốt

| Chủ đề              | Quyết định                                                                                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lưu trữ              | Giữ Google Sheets, không chuyển sang Postgres (02/11)                                                                                                                                                                                  |
| Tin tức               | Chỉ báo tiếng Việt, 4 chuyên mục. Mỗi sheet giữ tối đa **5.000 bài** (cắt khi vượt 5.100), **không bao giờ xoá bài đã Lưu**                                                                              |
| Nguồn tài chính     | Bỏ Báo Đầu tư (feed rỗng); Vietstock chuyển sang đường dẫn RSS mới (06/11)                                                                                                                                                    |
| Lấy tin               | Lượt nhanh chạy trên **Vercel `/api/sync`**, cron-job.org gọi mỗi 5 phút. GitHub Actions lo tóm tắt, giá vàng, dọn trùng, cắt bớt và lấy tin dự phòng (06/11)                                                  |
| Tóm tắt              | Tách khỏi bước lấy tin: bài lên sheet ngay với tóm tắt RSS, Python tóm tắt sau                                                                                                                                                |
| Giá vàng: lưu       | Giữ **toàn bộ lịch sử**. Lấy ở **mọi lượt sync**. Cùng ngày, giá không đổi thì **ghi đè giờ**; giá đổi hoặc sang ngày mới thì **thêm dòng** (06/11). Không cần sheet `GoldDaily` |
| Giá vàng: hiển thị | Ngày quá khứ hiện **giá chốt cuối ngày**. Khung **bảng theo giờ** cho hôm nay và 7 ngày gần nhất. **Bỏ tab "Vàng Trong Ngày"** (06/11)                                                                |
| Trang web              | Cache 60s; lúc mở trang chỉ gửi 300 bài mới nhất mỗi tab + mọi bài đã Lưu, có nút "Tải thêm bài cũ hơn"                                                                                                               |
| Không áp dụng       | Tải RSS có điều kiện (ETag): không feed nào hỗ trợ                                                                                                                                                                               |

## 3. Tài liệu kỹ thuật

### 3.1 Nguồn tin

| Mục        | Nguồn                                                                                                                                  | Sheet       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Tin Chung   | VNExpress ×4 + Tuổi Trẻ ×4, mỗi báo 4 chuyên mục *Thời sự · Thế giới · Kinh doanh · Khoa học công nghệ*             | `Sheet1`  |
| Tài Chính | Vietstock `https://vietstock.vn/0/tin-moi.rss` (danh sách feed chính thức: vietstock.vn/rss), CafeF `thi-truong-chung-khoan.rss` | `Finance` |

Tin Chung dùng feed theo chuyên mục thay vì feed "tin mới nhất". Lý do: feed tổng hợp của cả hai báo phần lớn là giải trí, thể thao, đời sống.

### 3.2 Luồng sync

```
cron-job.org ──(5 phút)──▶ Vercel /api/sync ──┐  đọc RSS, thêm bài (cột I = PENDING)
                                              ▼
GitHub Actions ──────────────────────▶ Google Sheets ◀── trang Next.js (cache 60s)
  lấy tin dự phòng · tóm tắt bài PENDING · giá vàng · dọn trùng · cắt bớt
```

1. **Lấy tin** (`src/lib/news-sync.ts`): đọc RSS song song, bỏ bài đã có (theo **mã bài**: VnExpress và Tuổi Trẻ đổi đường dẫn khi sửa tiêu đề nhưng giữ số ở cuối URL, xem `articleKey` trong `src/lib/sync-plan.ts`; báo khác so theo URL), **append** bài mới vào cuối sheet kèm tóm tắt và ảnh từ RSS, cột I = `PENDING`. Không có bài mới thì chỉ cập nhật heartbeat ở ô Z1.
2. **Tóm tắt** (chỉ chạy trên GitHub): Python xử lý các bài `PENDING`/`RETRY`, mới nhất trước, tối đa 120 bài/sheet/lượt. Kết quả ghi đúng ô B/E/I theo URL. Hỏng lần 1 thành `RETRY`, hỏng lần 2 thành `FAILED` (giữ tóm tắt RSS). Dòng cũ có cột I trống thì không tóm tắt lại.
3. **Dọn trùng + cắt bớt**: xoá bản trùng mã bài (khi Vercel và GitHub cùng thêm một bài, hoặc báo đổi đường dẫn), giữ bản đã Lưu, rồi bản đã tóm tắt, rồi dòng trên cùng. Trang web cũng tự ẩn bản trùng chưa kịp dọn. Sau đó, nếu vượt 5.100 bài thì xoá bài cũ nhất về 5.000, giữ bài đã Lưu.
4. **Giá vàng** chạy song song với phần tin (mục 3.3).
5. Bước nào lỗi thì workflow báo đỏ, nhưng phần đã thành công vẫn được ghi.

Thứ tự dòng trên sheet tin không còn là mới nhất trước; trang web tự sắp xếp theo timestamp.

### 3.3 Giá vàng

| Nguồn                    | Mặt hàng                                                                                                           | Ghi chú                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| BTMC (`api.btmc.vn`)    | 10 mặt hàng: vàng miếng SJC, nhẫn tròn trơn VRTL, bản vàng Đắc Lộc, đồng xu, trang sức, nguyên liệu | API trả ~1000 dòng kèm cả bạc; chỉ dòng có `karat` mới là vàng |
| 24h.com.vn (dự phòng)   | Vàng miếng SJC, vàng miếng VRTL                                                                                  | Chỉ dùng khi không gọi được BTMC                                     |
| PNJ (`edge-api.pnj.io`) | 20 mặt hàng: nhẫn trơn PNJ 999.9, vàng miếng SJC, nữ trang 8K–24K                                            | Giá niêm yết bằng nghìn đồng, đã nhân 1000                        |

- **BTMC chỉ truy cập được từ trong nước.** Từ runner GitHub, kết nối luôn timeout, nên sync tự chuyển sang 24h.com.vn. Phải dùng dòng `BTMC SJC` (`bao_tin_minh_chau`), **không** dùng dòng `SJC`: dòng `SJC` là giá do công ty SJC tự niêm yết, lệch 40–60 nghìn. Nguồn dự phòng chỉ bù được vàng miếng SJC và VRTL. Mỗi lời gọi BTMC thử 1 lần/giao thức, tối đa 6 giây.
- **Nguồn bắt buộc / tuỳ chọn:** thiếu PNJ thì workflow báo đỏ. Thiếu BTMC chỉ cảnh báo, và lý do được ghi vào ô **Y1** của `GoldPrice`.
- **Ghi theo thay đổi** (`planGoldWrites` trong `src/lib/sync-plan.ts`): cùng ngày, giá mua/bán không đổi thì ghi đè cột A (giờ) và F–H (giá thế giới, timestamp, tỷ giá) lên dòng mới nhất của mặt hàng. Giá đổi hoặc sang ngày mới thì thêm dòng. Thực tế chỉ cần 2–44 dòng/ngày.
- **Lần lấy mới nhất** = các dòng có mốc giờ lớn nhất, không phải dòng cuối sheet.
- **Giá thế giới quy về VNĐ/chỉ**: `USD/oz × (3,75 / 31,1035) × tỷ giá`. Tỷ giá lấy từ Vietcombank (giá bán ra), dự phòng open.er-api.com, và được lưu ở cột H tại thời điểm lấy giá. Giá trong nước tính theo **chỉ (3,75g)**.
- **Mặt hàng tiêu biểu** (`BRAND_REPRESENTATIVE` trong `gold-price.ts`): SJC: `VÀNG MIẾNG SJC`, BTMC: `VÀNG MIẾNG VRTL`, PNJ: `Nhẫn Trơn PNJ 999.9`.
- **Giao diện tab Giá Vàng**, từ trên xuống:
  1. Khung "Biến động trong ngày": bảng theo giờ, 7 ngày, giá mua/bán, ▲▼ khi đổi. Dữ liệu gộp sẵn ở `src/lib/gold-moves.ts`.
  2. Biểu đồ lịch sử: giá chốt cuối ngày của 3 nhà, cộng giá thế giới vẽ nét đứt.
  3. Bảng giá hiện tại theo từng nhà.

Cột của sheet `GoldPrice`:

| A                                    | B     | C    | D   | E    | F      | G         | H                |
| ------------------------------------ | ----- | ---- | --- | ---- | ------ | --------- | ---------------- |
| thời điểm (`HH:MM:SS D/M/YYYY`) | hãng | tên | mua | bán | USD/oz | timestamp | tỷ giá USD/VND |

Ô Y1 là nhật ký lỗi nguồn, ô Z1 là heartbeat.

### 3.4 Cấu trúc sheet tin (`Sheet1`, `Finance`)

| A          | B         | C   | D     | E    | F         | G        | H         | I                      |
| ---------- | --------- | --- | ----- | ---- | --------- | -------- | --------- | ---------------------- |
| tiêu đề | tóm tắt | URL | ngày | ảnh | timestamp | đã ẩn | đã lưu | trạng thái tóm tắt |

Ô Z1 là heartbeat. Ghi tin bằng `values.append` (tự nới lưới), ghi theo lô 1.000 dòng.

### 3.5 Tham số

| Tham số                                               | Giá trị                   | Nơi đặt                           |
| ------------------------------------------------------ | --------------------------- | ------------------------------------ |
| `MAX_ITEMS_PER_SHEET` / `TRIM_SLACK`               | 5.000 / 100                 | `src/scripts/sync-news.ts`         |
| `MAX_SUMMARIES_PER_RUN`                              | 120 bài/sheet/lượt       | `src/scripts/sync-news.ts`         |
| `GOLD_MIN_INTERVAL_MINUTES`                          | 0 = lấy ở mọi lượt     | biến môi trường                  |
| `SUMMARIZER_TIMEOUT_MS` / `SUMMARIZER_CONCURRENCY` | 30 giây / 4 bài song song | `src/lib/aggregator.ts`            |
| Timeout RSS / giá vàng / BTMC                        | 15s / 15s / 6s              | `aggregator.ts`, `gold-price.ts` |
| `INITIAL_NEWS_LIMIT`                                 | 300 bài/tab lúc mở trang | `src/lib/news-feed.ts`             |
| Cache trang                                            | 60 giây (`revalidate`)   | `src/app/page.tsx`                 |
| Khung biến động                                     | 7 ngày (`MOVE_DAYS`)     | `src/lib/gold-moves.ts`            |

Lệnh hữu ích:

- `npm run sync:local -- --today`: chỉ lấy bài đăng trong hôm nay.
- `--force-gold`: lấy giá vàng bỏ qua nhịp.
- `BTMC_API_HOST=10.255.255.1`: giả lập BTMC timeout như trên runner GitHub.
- `SYNC_SHEET_GENERAL` / `SYNC_SHEET_FINANCE` / `SYNC_SHEET_GOLD`: trỏ sync sang tab tạm để chạy thử mà không đụng dữ liệu thật.

### 3.6 Cấu hình `/api/sync` trên Vercel

`SYNC_SECRET` là mật khẩu riêng giữa cron-job.org và route `/api/sync`. Không có nó, ai biết đường dẫn cũng gọi được route để bắt server đọc RSS và ghi sheet. Route so khớp **chính xác** header `Authorization: Bearer <khoá>`. Thiếu biến này, hoặc khoá ngắn hơn 24 ký tự, thì route trả `503` cho mọi lời gọi.

**Bước 1. Tạo khoá (tại máy anh)**

Mở PowerShell hoặc terminal trong VS Code, chạy:

```powershell
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Kết quả là một chuỗi 32 ký tự gồm chữ, số, `-` và `_`, ví dụ dạng `Xk3_9aQ...`. Lưu chuỗi này vào trình quản lý mật khẩu, vì bước 4 còn cần dùng lại. Nếu bật **Sensitive** ở bước 2 thì Vercel sẽ không cho xem lại khoá.

- Không dán khoá vào code, file `.env` trong repo, chat hay commit message.
- Lỡ làm lộ khoá thì tạo khoá mới, sửa lại ở bước 2 và bước 4. Khoá cũ hết hiệu lực ngay sau khi Vercel deploy lại.

**Bước 2. Thêm biến trên Vercel**

1. Vào https://vercel.com, đăng nhập, rồi bấm vào project **tin-tuc-app** trong danh sách.
2. Chọn tab **Settings** ở thanh trên cùng, rồi mục **Environment Variables** ở menu bên trái.
3. Điền form thêm biến:
   - **Key:** `SYNC_SECRET`. Gõ đúng chữ hoa, không có dấu cách.
   - **Value:** dán khoá ở bước 1. Kiểm tra không có dấu cách hay xuống dòng ở đầu hoặc cuối, vì chỉ lệch một ký tự là route trả `401`.
   - **Environments:** chỉ tick **Production**. Bản Preview không cần, vì không có cron gọi; ở đó route sẽ trả `503`, như vậy là đúng.
   - **Sensitive:** nên bật. Khi bật, giá trị bị ẩn vĩnh viễn và chỉ sửa được bằng cách ghi đè.
4. Bấm **Save**. Danh sách biến bên dưới sẽ có thêm `SYNC_SECRET`. Các biến `GOOGLE_*` đã có sẵn, không cần đụng tới.

**Bước 3. Cho bản deploy nhận biến**

Biến mới chỉ có tác dụng với **lần deploy sau khi lưu**. Bản đang chạy chưa đọc được biến này.

- **Nếu chưa push code 06/11:** không cần làm gì. Lần push tới, Vercel tự build và nhận luôn biến. Đây là lý do việc số 1 ở mục 1 nằm trước việc commit.
- **Nếu đã push rồi:** vào tab **Deployments**, tìm dòng trên cùng có nhãn **Production**, bấm nút **⋯** ở cuối dòng, chọn **Redeploy**, rồi bấm **Redeploy** để xác nhận. Đợi trạng thái chuyển sang **Ready**, thường mất 1–2 phút.

**Bước 4. Kiểm tra biến đã có tác dụng**

Lấy tên miền ở tab **Overview** của project, mục **Domains**, có dạng `xxx.vercel.app`. Chạy lệnh dưới đây trong PowerShell. Lệnh **không gửi khoá** nên không lộ gì:

```powershell
curl.exe -s -o NUL -w "%{http_code}`n" https://<tên-miền>/api/sync
```

| Kết quả | Ý nghĩa                                                                     | Xử lý                                                                                      |
| --------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `401`   | Đúng. Biến đã có tác dụng, route từ chối lời gọi không có khoá | Sang bước 5                                                                                |
| `503`   | Bản deploy chưa có biến, hoặc khoá ngắn hơn 24 ký tự                | Làm lại bước 3 (Redeploy), kiểm tra Key đúng `SYNC_SECRET` và đã tick Production |
| `404`   | Bản deploy chưa có code 06/11                                              | Push code rồi đợi deploy xong                                                             |

**Bước 5. Tạo job trên cron-job.org**

1. Đăng nhập https://console.cron-job.org, bấm **Create cronjob**.
2. Tab **Common**:
   - **Title:** `tin-tuc /api/sync`
   - **URL:** `https://<tên-miền>/api/sync`
   - **Execution schedule:** chọn **Every 5 minutes**
3. Tab **Advanced**:
   - **Request method:** `GET`
   - **Headers:** bấm **Add**, điền Key = `Authorization`, Value = `Bearer <khoá>`. Chữ `Bearer` viết hoa chữ B, theo sau là **đúng một dấu cách**, rồi đến khoá.
   - **Timeout:** đặt 30 giây nếu có tuỳ chọn này, vì route được phép chạy tối đa 30 giây.
4. Bấm **Test run** trước khi lưu. Phải nhận `200` với nội dung dạng `{"ok":true,"results":[{"name":"...","added":0},...],"ms":...}`. `added` bằng 0 là bình thường khi không có bài mới.
5. Bấm **Create**. Trong tab **Notifications**, nên bật báo lỗi qua email khi job thất bại.

| Mã | Ý nghĩa                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------- |
| 200 | Xong; `results[].added` là số bài mới mỗi mục                                                                 |
| 401 | Sai hoặc thiếu header `Authorization`: kiểm tra chữ `Bearer `, dấu cách, khoá có bị thừa ký tự không |
| 503 | Server chưa có `SYNC_SECRET` (hoặc ngắn hơn 24 ký tự), mọi lời gọi đều bị từ chối                    |
| 500 | Một mục lỗi (phần thành công vẫn đã ghi); xem Vercel → tab **Logs**, lọc theo `/api/sync`          |

| Mã | Ý nghĩa                                                                                          |
| --- | -------------------------------------------------------------------------------------------------- |
| 200 | Xong; `results[].added` là số bài mới mỗi mục                                              |
| 401 | Sai hoặc thiếu header `Authorization`                                                          |
| 503 | Server chưa có `SYNC_SECRET` (hoặc ngắn hơn 24 ký tự), mọi lời gọi đều bị từ chối |
| 500 | Một mục lỗi (phần thành công vẫn đã ghi); xem Logs của Vercel                            |

### 3.7 Kích hoạt GitHub Actions đúng nhịp

GitHub hoãn lịch `schedule` của repo công khai rất nặng (đo được 2–8 tiếng/lượt), còn `workflow_dispatch` gọi qua API thì không bị hoãn. Lịch `*/10` trong `sync.yml` chỉ để dự phòng. Workflow để `cancel-in-progress: false`, nên lượt mới xếp hàng chờ chứ không giết lượt đang ghi.

Lượt GitHub lo những việc Vercel không làm: tóm tắt bằng Python, lấy giá vàng, dọn trùng và cắt bớt. Nếu nó chạy thưa thì bài sẽ nằm ở `PENDING` lâu và giá vàng bị hụt giờ.

**Bước 0. Tìm và gỡ trigger cũ**

Từ 24/09/2026 không còn lượt `workflow_dispatch` nào, nghĩa là trigger cũ đã chết. Hai nguyên nhân hay gặp:

- **Token hết hạn.** Fine-grained token mặc định chỉ sống 30 ngày, hết hạn thì mọi lời gọi trả `401`.
- **cron-job.org tự tắt job** sau nhiều lần thất bại liên tiếp.

Cách xử lý:

1. Mở https://console.cron-job.org và https://script.google.com (mục **Triggers**, biểu tượng đồng hồ) để tìm job cũ gọi `.../actions/workflows/sync.yml/dispatches`.
2. Nếu tìm thấy, xem lịch sử chạy (**History** hoặc **Executions**). Nếu thấy `401` thì đúng là token hết hạn.
3. **Xoá job cũ.** Chỉ giữ **một** trigger, vì hai trigger chạy cùng lúc sẽ làm lượt chạy xếp hàng gấp đôi.
4. Vào GitHub, chọn **Settings**, rồi **Developer settings**, rồi **Personal access tokens**. Xoá token cũ nếu còn (nút **Delete**).

**Bước 1. Tạo token mới (fine-grained PAT)**

1. Đăng nhập GitHub bằng tài khoản `Jobox66`.
2. Bấm ảnh đại diện góc phải trên, chọn **Settings**.
3. Ở menu trái, kéo xuống cuối và bấm **Developer settings**.
4. Chọn **Personal access tokens**, rồi **Fine-grained tokens**, rồi **Generate new token**.
5. Điền form:
   - **Token name:** `tin-tuc-sync-trigger`
   - **Expiration:** chọn **Custom** với hạn dài nhất GitHub cho phép (thường là 1 năm). Ghi ngày hết hạn vào lịch để thay token trước khi trigger chết lần nữa.
   - **Resource owner:** `Jobox66`
   - **Repository access:** chọn **Only select repositories**, rồi chọn `tin-tuc-app`
   - **Permissions → Repository permissions:** tìm **Actions** và chọn **Read and write**. Dòng **Metadata: Read-only** do GitHub tự thêm. **Không bật quyền nào khác:** token này chỉ được bấm "chạy workflow", không đọc hay sửa được code.
6. Bấm **Generate token**. Chuỗi `github_pat_...` **chỉ hiện một lần**: chép vào trình quản lý mật khẩu ngay. Không dán vào code, chat hay commit.

**Bước 2. Thử token tại máy (không bắt buộc, nhưng nên làm)**

*2.1. Mở Git Bash đúng thư mục*

- **Trong VS Code** (đang mở repo): mở terminal bằng ``Ctrl+` ``. Bấm mũi tên **˅** cạnh dấu **+** ở góc phải khung terminal, chọn **Git Bash**. Terminal tự đứng ở thư mục repo.
- **Hoặc ngoài VS Code**: nhấp phải vào thư mục repo trong File Explorer, chọn **Open Git Bash here**. Trên Windows 11 phải bấm **Show more options** trước.

Kiểm tra đang đứng đúng chỗ và đủ công cụ:

```bash
pwd                          # phải ra /d/1.tangocduc/Code/_tintuc/tin-tuc-app
ls scripts/trigger-sync.sh   # phải in lại đúng tên file, không báo "No such file"
curl --version | head -1     # phải có dòng "curl 8.x ..."
node --version               # phải có v20 trở lên (dùng ở bước 2.4)
```

Nếu `pwd` ra chỗ khác, chạy `cd /d/1.tangocduc/Code/_tintuc/tin-tuc-app`. Trong Git Bash, ổ `D:` viết là `/d`, và dùng dấu `/` chứ không phải `\`.

*2.2. Nạp token vào biến tạm*

```bash
read -s -p "Dán token: " GITHUB_TOKEN; echo; export GITHUB_TOKEN
```

**Không sửa file nào và không dán token vào code.** Token dán thẳng vào **cửa sổ terminal Git Bash**, theo hai lượt riêng:

1. **Lượt 1, chạy lệnh:** chép nguyên dòng lệnh ở trên, **giữ nguyên** chữ `GITHUB_TOKEN` và không thay bằng token. Dán vào terminal rồi bấm **Enter**. Terminal sẽ dừng lại và hiện:
   ```
   $ read -s -p "Dán token: " GITHUB_TOKEN; echo; export GITHUB_TOKEN
   Dán token: █
   ```
2. **Lượt 2, dán token:** con trỏ đang nhấp nháy sau chữ `Dán token:`. Lúc này mới dán token `github_pat_...` rồi bấm **Enter**.
   - Cách dán: **Ctrl+V** nếu dùng terminal trong VS Code. Nếu dùng cửa sổ Git Bash riêng thì bấm **Shift+Insert** hoặc **nhấp chuột phải**; trong cửa sổ đó Ctrl+V không dán được.
   - Khi dán **sẽ không thấy ký tự nào hiện ra**. Đó là do `-s` ẩn token, không phải lỗi. Đừng dán lần hai, cứ bấm Enter.
3. Terminal xuống dòng và quay về dấu `$`, tức là token đã nằm trong biến `GITHUB_TOKEN`. Các lệnh sau (bước 2.3, 2.4) tự lấy token từ biến này. Anh không phải dán lại, miễn là vẫn dùng **cùng cửa sổ terminal** đó.

Token chỉ tồn tại trong cửa sổ terminal đang mở, không ghi vào file nào và không lưu vào lịch sử lệnh. Đóng terminal là token mất.

Kiểm tra đã dán đủ, chỉ in độ dài chứ không in token:

```bash
echo ${#GITHUB_TOKEN}        # fine-grained token dài khoảng 93 ký tự; ra 0 là chưa dán được
```

*2.3. Xem token còn hạn đến bao giờ*

Lệnh dưới chỉ **đọc** thông tin repo, không kích hoạt gì:

```bash
curl -s -o /dev/null -D - -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/Jobox66/tin-tuc-app \
  | grep -i -E '^(HTTP|github-authentication-token-expiration)'
```

- Kết quả đúng là `HTTP/1.1 200 OK` kèm dòng `github-authentication-token-expiration: 2027-...`. Ngày đó chính là hạn của token, nên ghi vào lịch.
- Nếu ra `401`, token sai hoặc đã hết hạn.

*2.4. Kích hoạt thử một lượt*

```bash
bash scripts/trigger-sync.sh
```

Dùng `bash scripts/...` thay vì `./scripts/...`, vì trên Windows file script không có quyền thực thi. Bảng kết quả ở cuối bước này.

*2.5. Xem lượt vừa kích hoạt trên GitHub*

**Mục đích:** bước 2.4 chỉ cho biết GitHub *đã nhận* lời gọi (mã `204`). Bước này xác nhận GitHub *thật sự tạo ra một lượt chạy* và lượt đó chạy xong không lỗi.

**Lệnh làm gì:**

- Phần `curl`: hỏi API công khai của GitHub danh sách các lượt chạy của workflow `sync.yml`.
  - `event=workflow_dispatch` lọc chỉ lấy lượt do trigger ngoài gọi, bỏ các lượt `schedule`.
  - `per_page=5` lấy 5 lượt mới nhất.
  - Repo công khai nên **không cần token**. Lệnh chạy được cả khi đã `unset GITHUB_TOKEN` hay ở cửa sổ terminal khác.
- Phần `node -e`: API trả về một khối JSON rất dài. Đoạn này chỉ lọc ra mỗi lượt một dòng: giờ tạo (đổi sang giờ Việt Nam), trạng thái và kết quả.

**Cách chạy:** lệnh dài 2 dòng, nối bằng dấu `\` ở cuối dòng 1. Chép **cả 2 dòng một lần**, dán vào Git Bash rồi bấm Enter:

```bash
curl -s "https://api.github.com/repos/Jobox66/tin-tuc-app/actions/workflows/sync.yml/runs?event=workflow_dispatch&per_page=5" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('Tong so luot dispatch:',j.total_count);for(const r of j.workflow_runs)console.log(new Date(r.created_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}),r.status,r.conclusion||'')})"
```

**Kết quả hiện tại** (chạy ngày 09/11/2026, *trước* khi sửa trigger), dùng để so sánh:

```
Tong so luot dispatch: 20
11:13:51 24/9/2026 completed success     ← lượt dispatch cuối cùng, trigger chết từ đây
10:47:31 17/9/2026 completed cancelled
10:45:46 17/9/2026 completed cancelled
17:30:01 17/4/2026 completed success
17:06:52 17/4/2026 completed success
```

**Kết quả mong đợi** sau khi chạy bước 2.4 (giờ là ví dụ):

```
Tong so luot dispatch: 21                ← tăng thêm 1 so với trước
14:05:12 9/11/2026 in_progress           ← lượt vừa kích hoạt, nằm trên cùng
11:13:51 24/9/2026 completed success
...
```

**Cách đọc từng dòng:** `giờ tạo` · `status` · `conclusion`

| `status`      | `conclusion` | Ý nghĩa                                                                                                        | Làm gì                                                                                    |
| --------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `queued`      | (trống)       | Đang xếp hàng, có thể đang chờ lượt trước chạy xong                                                  | Đợi 1–2 phút rồi chạy lại lệnh                                                      |
| `in_progress` | (trống)       | Đang chạy; một lượt mất khoảng 2 phút                                                                    | Đợi khoảng 2 phút rồi chạy lại lệnh                                                 |
| `completed`   | `success`    | Chạy xong, không lỗi                                                                                          | Xong bước 2, sang bước 3                                                                |
| `completed`   | `failure`    | Workflow chạy nhưng có bước lỗi. Lỗi nằm ở code hoặc nguồn dữ liệu, **không phải ở token** | Mở tab Actions trên GitHub, bấm vào lượt đó xem bước nào đỏ, hoặc báo Claude |
| `completed`   | `cancelled`  | Bị huỷ (bấm tay, hoặc quá 20 phút)                                                                         | Báo Claude                                                                                 |

**Nếu dòng trên cùng vẫn là `24/9/2026`** (tổng vẫn là 20):

- GitHub cần vài giây để tạo lượt chạy. Đợi 10–20 giây rồi chạy lại lệnh.
- Vẫn không có thì xem lại bước 2.4 có in `OK - da kich hoat sync` không. Nếu bước 2.4 báo lỗi thì lượt chạy chưa từng được tạo.

**Xem mọi lượt, cả `schedule`** (để so nhịp chạy trước và sau khi sửa trigger), dùng lệnh này. Nó in thêm cột loại kích hoạt (`schedule` hoặc `workflow_dispatch`) và lấy 15 lượt:

```bash
curl -s "https://api.github.com/repos/Jobox66/tin-tuc-app/actions/workflows/sync.yml/runs?per_page=15" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{for(const r of JSON.parse(s).workflow_runs)console.log(new Date(r.created_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}),r.event,r.status,r.conclusion||'')})"
```

Trigger chạy đúng thì giờ giữa các dòng `workflow_dispatch` cách nhau khoảng 10 phút. Hiện tại chỉ có `schedule`, các dòng cách nhau 3–7 tiếng.

**Giới hạn:** API công khai không cần token cho phép **60 lần gọi mỗi giờ** cho mỗi IP, nên chạy lại vài chục lần cũng không sao. Nếu thấy lỗi `workflow_runs is not iterable` thì đã hết lượt gọi; đợi tới giờ sau rồi chạy lại.

*2.6. Xoá token khỏi terminal*

```bash
unset GITHUB_TOKEN
```

Hoặc đóng hẳn cửa sổ terminal.

*Kiểm tra `/api/sync` trên Vercel bằng Git Bash* (tương đương bước 4 ở mục 3.6):

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<tên-miền>/api/sync
```

`401` là đúng, `503` là chưa có biến `SYNC_SECRET`, `404` là chưa deploy code mới.

Kết quả của `bash scripts/trigger-sync.sh` (bước 2.4):

| Script báo                   | Ý nghĩa                                          | Xử lý                                                                                     |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `OK - da kich hoat sync...` | Token dùng được                                | Mở tab **Actions** của repo: phải có lượt mới với nhãn `workflow_dispatch` |
| `401`                       | Token sai, dán thiếu ký tự, hoặc hết hạn    | Dán lại hoặc tạo token mới                                                             |
| `403`                       | Token thiếu quyền Actions: Read and write        | Sửa token, thêm quyền đó                                                               |
| `404`                       | Token không được cấp cho repo `tin-tuc-app` | Sửa **Repository access** của token                                                 |
| `422`                       | Nhánh `master` không có `workflow_dispatch` | Kiểm tra `sync.yml` trên nhánh `master` đã có dòng `workflow_dispatch:`        |

**Bước 3. Đặt lịch: chọn MỘT trong hai cách**

**Cách A: cron-job.org (khuyên dùng).** Cùng chỗ với job `/api/sync`, nên dễ theo dõi.

1. Bấm **Create cronjob**.
2. Tab **Common**:
   - **Title:** `tin-tuc GitHub sync`
   - **URL:** `https://api.github.com/repos/Jobox66/tin-tuc-app/actions/workflows/sync.yml/dispatches`
   - **Execution schedule:** **Every 10 minutes**. Có thể chọn 15 phút nếu muốn thưa hơn. Một lượt chạy khoảng 2 phút, nên 10 phút là đủ khoảng trống.
3. Tab **Advanced**:
   - **Request method:** `POST`
   - **Headers:** bấm **Add** 4 lần:| Key                      | Value                                                                           |
     | ------------------------ | ------------------------------------------------------------------------------- |
     | `Authorization`        | `Bearer github_pat_...` (chữ `Bearer`, đúng một dấu cách, rồi token) |
     | `Accept`               | `application/vnd.github+json`                                                 |
     | `X-GitHub-Api-Version` | `2022-11-28`                                                                  |
     | `Content-Type`         | `application/json`                                                            |
   - **Request body:** `{"ref":"master"}`
4. Bấm **Test run**. Phải nhận **`204`**, không có nội dung trả về; 204 là thành công, không phải lỗi. Mở tab Actions trên GitHub để thấy lượt mới.

   **Nếu báo `400 Bad request`** ("the server could not understand the request..."): bấm vào lần chạy để xem phần **Response**, vì nội dung GitHub trả về cho biết lỗi nằm ở đâu.

   | Response | Nguyên nhân | Sửa |
   |---|---|---|
   | `"Problems parsing JSON"` | **Token đúng** (GitHub đã qua bước kiểm token), nhưng body không phải JSON hợp lệ | Xoá ô **Request body**, **gõ tay** lại `{"ref":"master"}` bằng dấu nháy thẳng `"`. Không dán từ Word, Zalo hay trang web, vì chúng hay đổi thành nháy cong `“ ”`. Ô body không được để trống. |
   | Trang HTML, hoặc không có nội dung | **Tên header** sai định dạng, request bị chặn trước khi tới GitHub | Mở lại 4 header: ô **Key** chỉ chứa đúng tên (`Authorization`), không có dấu `:`, không có dấu cách ở đầu hay cuối. `Bearer github_pat_...` nằm ở ô **Value**. Xoá các dòng header thừa hoặc dòng để trống. |
   Các mã khác: `401` là token sai hoặc hết hạn; `403` là token thiếu quyền Actions; `404` là sai URL, sai repo, hoặc method đang là `GET` thay vì `POST`; `422` là sai tên nhánh.
5. Tab **Notifications**: bật email khi job thất bại. Ngày token hết hạn, job sẽ báo `401` ngay thay vì chết âm thầm như lần trước.
6. Bấm **Create**.

**Cách B: Google Apps Script.**

1. Vào https://script.google.com và bấm **New project**. Đặt tên `tin-tuc-trigger`.
2. Xoá nội dung mẫu, dán đoạn code bên dưới, rồi bấm **Save**.
3. Bấm biểu tượng bánh răng (**Project Settings**), kéo xuống **Script Properties** và bấm **Add script property**: Property = `GH_TOKEN`, Value = token. Bấm **Save script properties**. Token nằm ở đây, **không viết vào code**.
4. Quay lại **Editor**, chọn hàm `triggerSync` và bấm **Run**. Lần đầu Google sẽ hỏi cấp quyền: chọn tài khoản, rồi **Advanced**, rồi **Go to tin-tuc-trigger**, rồi **Allow**. Ô **Execution log** phải in `204`.
5. Bấm biểu tượng đồng hồ (**Triggers**), rồi **Add Trigger**:

   - Function: `triggerSync`
   - Event source: **Time-driven**
   - Type: **Minutes timer**
   - Interval: **Every 10 minutes**
   - Failure notification: **Notify me immediately**

   Bấm **Save**.

```javascript
function triggerSync() {
  const res = UrlFetchApp.fetch(
    'https://api.github.com/repos/Jobox66/tin-tuc-app/actions/workflows/sync.yml/dispatches',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + PropertiesService.getScriptProperties().getProperty('GH_TOKEN'),
        Accept: 'application/vnd.github+json',
      },
      payload: JSON.stringify({ ref: 'master' }),
      muteHttpExceptions: true,
    }
  );
  console.log(res.getResponseCode()); // 204 = OK
}
```

**Bước 4. Xác nhận đã chạy đều**

Sau khoảng 1 giờ, vào tab **Actions** của repo, chọn workflow **Tintuc Sync** và lọc **Event** = `workflow_dispatch`. Nếu trigger chạy đúng, sẽ thấy khoảng 6 lượt cách nhau ~10 phút, đều có dấu ✓ xanh. Sau đó báo Claude (việc số 6 ở mục 1) để kiểm tra nhịp chạy và dữ liệu trên sheet.

**Khi token sắp hết hạn:** tạo token mới theo bước 1, rồi sửa header `Authorization` trên cron-job.org (hoặc `GH_TOKEN` trong Script Properties). Cuối cùng mới xoá token cũ.

Secrets cần có trên GitHub: `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`.
