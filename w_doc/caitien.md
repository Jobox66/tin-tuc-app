# Tin Tức App: việc tiếp theo, quyết định đã chốt, tài liệu kỹ thuật

> Cập nhật 06/11/2026. Code đã lên **v5.0** (commit `f323501`, 05/11). Các thay đổi ngày 06/11 (giá vàng ghi theo thay đổi, khung biến động trong ngày, route `/api/sync`, sửa nguồn tài chính) **chưa commit**.

## 1. Việc cần làm tiếp

| # | Việc | Ai | Ghi chú |
|:---:|---|---|---|
| 1 | Vercel: thêm biến `SYNC_SECRET` (chưa cần Redeploy) | Anh | Khoá ngẫu nhiên ≥ 24 ký tự, không đưa vào code hay chat. Cách làm ở mục 3.6. Đặt trước khi push để bản deploy ở bước 2 nhận luôn biến này |
| 2 | Commit/push thay đổi ngày 06/11 | Anh | Đã chạy lại trên máy: 32 test pass, `tsc`, `eslint` và `npm run build` không lỗi. 9 file sửa (có xoá `GoldIntradayTable.tsx`), 6 file mới: `src/app/api/sync/route.ts`, `src/lib/news-sync.ts`, `src/lib/gold-moves.ts`, `src/components/GoldDayMovesPanel.tsx`, 2 file test. Push xong Vercel tự deploy |
| 3 | cron-job.org: tạo job gọi `/api/sync` mỗi 5 phút | Anh | Đây là đường lấy tin chính. Bấm "Test run" phải ra `200` |
| 4 | Sửa trigger GitHub (`workflow_dispatch`), đặt 10–15 phút một lần | Anh | Cần để tóm tắt và giá vàng chạy đều. Từ 24/9 chưa có lượt dispatch nào, lịch `schedule` đang bị GitHub hoãn 4–8 tiếng. Cách làm ở mục 3.7 |
| 5 | Bấm thử trên trình duyệt: nút "Tải thêm bài cũ hơn" (trang cuối tab Tin Chung) và chọn ngày trong khung "Biến động trong ngày" | Anh | Hai chỗ này mới kiểm qua server, chưa kiểm trên trình duyệt |
| 6 | Kiểm tra sau khi anh làm xong bước 2–4: lượt chạy CI, nhịp lấy tin, dữ liệu sheet | Claude | |
| 7 | Quyết định: Vietstock giữ `/0/tin-moi.rss` (đúng feed cũ, chỉ giữ ~4 tiếng bài) hay đổi sang `/144/chung-khoan.rss` (giữ ~2 ngày, chỉ có tin chứng khoán) | Anh | Đang dùng `tin-moi`. Khi `/api/sync` chạy 5 phút một lần thì không sót bài |
| 8 | Quyết định: xoá hay giữ 3 sheet cũ `International`, `IntlFinance`, `IntlTech` | Anh | Không còn dùng từ khi bỏ nguồn nước ngoài |

> Lưu ý khi bình luận trực tiếp vào file này: trình soạn thảo bảng anh đang dùng từng không ghi bình luận xuống đĩa. Lưu xong anh mở lại file để chắc chắn, và mở lại bản mới trước khi sửa tiếp.

## 2. Quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Lưu trữ | Giữ Google Sheets, không chuyển sang Postgres (02/11) |
| Tin tức | Chỉ báo tiếng Việt, 4 chuyên mục. Mỗi sheet giữ tối đa **5.000 bài** (cắt khi vượt 5.100), **không bao giờ xoá bài đã Lưu** |
| Nguồn tài chính | Bỏ Báo Đầu tư (feed rỗng); Vietstock chuyển sang đường dẫn RSS mới (06/11) |
| Lấy tin | Lượt nhanh chạy trên **Vercel `/api/sync`**, cron-job.org gọi mỗi 5 phút. GitHub Actions lo tóm tắt, giá vàng, dọn trùng, cắt bớt và lấy tin dự phòng (06/11) |
| Tóm tắt | Tách khỏi bước lấy tin: bài lên sheet ngay với tóm tắt RSS, Python tóm tắt sau |
| Giá vàng: lưu | Giữ **toàn bộ lịch sử**. Lấy ở **mọi lượt sync**. Cùng ngày, giá không đổi thì **ghi đè giờ**; giá đổi hoặc sang ngày mới thì **thêm dòng** (06/11). Không cần sheet `GoldDaily` |
| Giá vàng: hiển thị | Ngày quá khứ hiện **giá chốt cuối ngày**. Khung **bảng theo giờ** cho hôm nay và 7 ngày gần nhất. **Bỏ tab "Vàng Trong Ngày"** (06/11) |
| Trang web | Cache 60s; lúc mở trang chỉ gửi 300 bài mới nhất mỗi tab + mọi bài đã Lưu, có nút "Tải thêm bài cũ hơn" |
| Không áp dụng | Tải RSS có điều kiện (ETag): không feed nào hỗ trợ |

## 3. Tài liệu kỹ thuật

### 3.1 Nguồn tin

| Mục | Nguồn | Sheet |
|---|---|---|
| Tin Chung | VNExpress ×4 + Tuổi Trẻ ×4, mỗi báo 4 chuyên mục *Thời sự · Thế giới · Kinh doanh · Khoa học công nghệ* | `Sheet1` |
| Tài Chính | Vietstock `https://vietstock.vn/0/tin-moi.rss` (danh sách feed chính thức: vietstock.vn/rss), CafeF `thi-truong-chung-khoan.rss` | `Finance` |

Tin Chung dùng feed theo chuyên mục thay vì feed "tin mới nhất". Lý do: feed tổng hợp của cả hai báo phần lớn là giải trí, thể thao, đời sống.

### 3.2 Luồng sync

```
cron-job.org ──(5 phút)──▶ Vercel /api/sync ──┐  đọc RSS, thêm bài (cột I = PENDING)
                                              ▼
GitHub Actions ──────────────────────▶ Google Sheets ◀── trang Next.js (cache 60s)
  lấy tin dự phòng · tóm tắt bài PENDING · giá vàng · dọn trùng · cắt bớt
```

1. **Lấy tin** (`src/lib/news-sync.ts`): đọc RSS song song, bỏ bài đã có (theo URL), **append** bài mới vào cuối sheet kèm tóm tắt và ảnh từ RSS, cột I = `PENDING`. Không có bài mới thì chỉ cập nhật heartbeat ở ô Z1.
2. **Tóm tắt** (chỉ chạy trên GitHub): Python xử lý các bài `PENDING`/`RETRY`, mới nhất trước, tối đa 120 bài/sheet/lượt. Kết quả ghi đúng ô B/E/I theo URL. Hỏng lần 1 thành `RETRY`, hỏng lần 2 thành `FAILED` (giữ tóm tắt RSS). Dòng cũ có cột I trống thì không tóm tắt lại.
3. **Dọn trùng + cắt bớt**: xoá bản trùng URL (khi Vercel và GitHub cùng thêm một bài). Sau đó, nếu vượt 5.100 bài thì xoá bài cũ nhất về 5.000, giữ bài đã Lưu.
4. **Giá vàng** chạy song song với phần tin (mục 3.3).
5. Bước nào lỗi thì workflow báo đỏ, nhưng phần đã thành công vẫn được ghi.

Thứ tự dòng trên sheet tin không còn là mới nhất trước; trang web tự sắp xếp theo timestamp.

### 3.3 Giá vàng

| Nguồn | Mặt hàng | Ghi chú |
|---|---|---|
| BTMC (`api.btmc.vn`) | 10 mặt hàng: vàng miếng SJC, nhẫn tròn trơn VRTL, bản vàng Đắc Lộc, đồng xu, trang sức, nguyên liệu | API trả ~1000 dòng kèm cả bạc; chỉ dòng có `karat` mới là vàng |
| 24h.com.vn (dự phòng) | Vàng miếng SJC, vàng miếng VRTL | Chỉ dùng khi không gọi được BTMC |
| PNJ (`edge-api.pnj.io`) | 20 mặt hàng: nhẫn trơn PNJ 999.9, vàng miếng SJC, nữ trang 8K–24K | Giá niêm yết bằng nghìn đồng, đã nhân 1000 |

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

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| thời điểm (`HH:MM:SS D/M/YYYY`) | hãng | tên | mua | bán | USD/oz | timestamp | tỷ giá USD/VND |

Ô Y1 là nhật ký lỗi nguồn, ô Z1 là heartbeat.

### 3.4 Cấu trúc sheet tin (`Sheet1`, `Finance`)

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| tiêu đề | tóm tắt | URL | ngày | ảnh | timestamp | đã ẩn | đã lưu | trạng thái tóm tắt |

Ô Z1 là heartbeat. Ghi tin bằng `values.append` (tự nới lưới), ghi theo lô 1.000 dòng.

### 3.5 Tham số

| Tham số | Giá trị | Nơi đặt |
|---|---|---|
| `MAX_ITEMS_PER_SHEET` / `TRIM_SLACK` | 5.000 / 100 | `src/scripts/sync-news.ts` |
| `MAX_SUMMARIES_PER_RUN` | 120 bài/sheet/lượt | `src/scripts/sync-news.ts` |
| `GOLD_MIN_INTERVAL_MINUTES` | 0 = lấy ở mọi lượt | biến môi trường |
| `SUMMARIZER_TIMEOUT_MS` / `SUMMARIZER_CONCURRENCY` | 30 giây / 4 bài song song | `src/lib/aggregator.ts` |
| Timeout RSS / giá vàng / BTMC | 15s / 15s / 6s | `aggregator.ts`, `gold-price.ts` |
| `INITIAL_NEWS_LIMIT` | 300 bài/tab lúc mở trang | `src/lib/news-feed.ts` |
| Cache trang | 60 giây (`revalidate`) | `src/app/page.tsx` |
| Khung biến động | 7 ngày (`MOVE_DAYS`) | `src/lib/gold-moves.ts` |

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

| Kết quả | Ý nghĩa | Xử lý |
|---|---|---|
| `401` | Đúng. Biến đã có tác dụng, route từ chối lời gọi không có khoá | Sang bước 5 |
| `503` | Bản deploy chưa có biến, hoặc khoá ngắn hơn 24 ký tự | Làm lại bước 3 (Redeploy), kiểm tra Key đúng `SYNC_SECRET` và đã tick Production |
| `404` | Bản deploy chưa có code 06/11 | Push code rồi đợi deploy xong |

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

| Mã | Ý nghĩa |
|---|---|
| 200 | Xong; `results[].added` là số bài mới mỗi mục |
| 401 | Sai hoặc thiếu header `Authorization`: kiểm tra chữ `Bearer `, dấu cách, khoá có bị thừa ký tự không |
| 503 | Server chưa có `SYNC_SECRET` (hoặc ngắn hơn 24 ký tự), mọi lời gọi đều bị từ chối |
| 500 | Một mục lỗi (phần thành công vẫn đã ghi); xem Vercel → tab **Logs**, lọc theo `/api/sync` |

| Mã | Ý nghĩa |
|---|---|
| 200 | Xong; `results[].added` là số bài mới mỗi mục |
| 401 | Sai hoặc thiếu header `Authorization` |
| 503 | Server chưa có `SYNC_SECRET` (hoặc ngắn hơn 24 ký tự), mọi lời gọi đều bị từ chối |
| 500 | Một mục lỗi (phần thành công vẫn đã ghi); xem Logs của Vercel |

### 3.7 Kích hoạt GitHub Actions đúng nhịp

GitHub hoãn lịch `schedule` của repo công khai rất nặng (đo được 2–8 tiếng/lượt), còn `workflow_dispatch` gọi qua API thì không bị hoãn. Lịch `*/10` trong `sync.yml` chỉ để dự phòng. Workflow để `cancel-in-progress: false`, nên lượt mới xếp hàng chờ chứ không giết lượt đang ghi.

1. **Token:** GitHub → Settings → Developer settings → Fine-grained tokens. Chỉ chọn repo `tin-tuc-app`, chỉ bật quyền `Actions` = Read and write.
2. **Thử tại máy:** `GITHUB_TOKEN=github_pat_xxx ./scripts/trigger-sync.sh`. Script báo rõ từng mã lỗi: 401 token sai, 403 thiếu quyền, 404 sai repo, 422 sai nhánh.
3. **cron-job.org:**
   - URL: `https://api.github.com/repos/Jobox66/tin-tuc-app/actions/workflows/sync.yml/dispatches`
   - Method `POST`, mỗi 10–15 phút
   - Headers: `Authorization: Bearer <PAT>` và `Accept: application/vnd.github+json`
   - Body: `{"ref":"master"}`
   - Thành công là HTTP **204**.
4. **Hoặc Google Apps Script** (Time-driven → Every 10 minutes). Token lưu ở Script properties với khoá `GH_TOKEN`, không viết vào code:

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

Secrets cần có trên GitHub: `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`.
