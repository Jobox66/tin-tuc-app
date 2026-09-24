# 📰 Tin Tức App

Web application tổng hợp tin tức đa lĩnh vực từ nhiều nguồn RSS, tự động tóm tắt bằng AI (NLP), lưu trữ trên Google Sheets và hiển thị qua giao diện Next.js.

> **Live:** Deploy trên Vercel · **Sync:** GitHub Actions chạy tự động mỗi 30 phút

---

## 🚀 Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| **Frontend** | Next.js 16 (App Router) + TypeScript + TailwindCSS |
| **Data Storage** | Google Sheets (via Google Sheets API v4) |
| **RSS Parser** | `rss-parser` (Node.js) |
| **AI Summarizer** | Python (`newspaper3k` + NLTK) — tự động tóm tắt bài viết |
| **CI/CD** | GitHub Actions (sync tự động) + Vercel (deploy) |

---

## 📁 Cấu trúc thư mục

```
tin-tuc-app/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── page.tsx          # Trang chủ - hiển thị tin tức 2 mục + giá vàng
│   │   └── actions.ts        # Server actions (save/hide bài viết)
│   ├── components/
│   │   └── NewsFeed.tsx      # Component hiển thị tin tức (2 tab tin + tab giá vàng)
│   ├── lib/
│   │   ├── aggregator.ts     # RSS fetcher + nguồn tin (11 nguồn)
│   │   └── google-sheets.ts  # Google Sheets API (CRUD + heartbeat)
│   └── scripts/
│       ├── sync-news.ts      # Script sync chính (chạy qua GitHub Actions)
│       └── summarizer.py     # Python AI summarizer (newspaper3k + NLTK)
├── .github/workflows/
│   └── sync.yml              # GitHub Actions: sync mỗi 30 phút
├── .env                      # Biến môi trường (local)
└── package.json
```

---

## 📰 Nguồn tin (11 nguồn RSS)

| Mục | Nguồn | Sheet |
|-----|-------|-------|
| **Tin Chung** | VNExpress ×4 + Tuổi Trẻ ×4 — mỗi báo lấy 4 chuyên mục: *Thời sự · Thế giới · Kinh doanh · Khoa học công nghệ* | `Sheet1` |
| **Tài Chính** | Vietstock, CafeF, Báo Đầu Tư | `Finance` |

> **Tin Chung dùng feed chuyên mục thay vì `tin-moi-nhat`.** Feed tổng hợp của cả hai
> báo phần lớn là giải trí, thể thao, đời sống — bám chuyên mục giúp giữ nội dung tập trung.

---

## 🥇 Giá vàng (2 nguồn API)

| Nguồn | Mặt hàng | Ghi chú |
|-------|----------|---------|
| **BTMC** (`api.btmc.vn`) | 10 mặt hàng: vàng miếng SJC, **nhẫn tròn trơn VRTL**, bản vàng Đắc Lộc, đồng xu VRTL, trang sức Rồng Thăng Long, nguyên liệu | API trả ~1000 dòng gồm cả bạc — chỉ dòng có `karat` mới là vàng |
| **24h.com.vn** *(dự phòng)* | 2 mặt hàng: vàng miếng SJC, vàng miếng VRTL | Chỉ dùng khi không gọi được BTMC |
| **PNJ** (`edge-api.pnj.io`) | 20 mặt hàng: **nhẫn trơn PNJ 999.9**, vàng miếng SJC, Kim Bảo, Phúc Lộc Tài, nữ trang 8K–24K | Giá niêm yết bằng **nghìn đồng**, đã nhân 1000 trước khi lưu |

Mỗi lần sync ghi nối (append) ~30 dòng vào sheet `GoldPrice`, giữ nguyên lịch sử.
Một nguồn lỗi không ảnh hưởng nguồn còn lại.

> ### ⚠️ `api.btmc.vn` chỉ truy cập được từ trong nước
>
> Từ runner GitHub Actions, host này **timeout ở cả cổng 80 lẫn 443**
> (`ConnectTimeoutError`). Ba dịch vụ proxy nước ngoài cũng không chạm tới, kể cả
> trang `btmc.vn`. Trong khi đó PNJ, `api.gold-api.com` và cả Vietcombank (cũng là
> site Việt Nam) đều gọi bình thường — nên đây là hạn chế riêng của host đó.
>
> **Cách xử lý:** khi BTMC không gọi được, sync tự chuyển sang `24h.com.vn` — trang
> này gọi được từ cả hai phía và niêm yết lại đúng giá BTMC. Đối chiếu cùng thời
> điểm: **lệch 0 đồng**. Dùng dòng `BTMC SJC` chứ không phải dòng `SJC`, vì dòng
> `SJC` là giá do chính công ty SJC niêm yết (lệch 40–60k) — dùng nhầm sẽ làm chuỗi
> lịch sử nhảy giữa hai loại báo giá.
>
> Nguồn dự phòng chỉ bù được **vàng miếng SJC và VRTL**. Nhẫn tròn trơn BTMC, trang
> sức và đồng xu chỉ có khi sync chạy từ trong nước. Vàng nhẫn vẫn còn qua
> `Nhẫn Trơn PNJ 999.9`.
>
> Ép test nhánh dự phòng: `BTMC_API_HOST=khong-ton-tai.invalid npm run sync:local`
>
> Nguồn chia hai nhóm: **bắt buộc** (`PNJ`) thiếu là workflow đỏ; **tuỳ chọn**
> (`BTMC`) thiếu thì cảnh báo và ghi lý do vào ô **Y1** của sheet `GoldPrice`,
> nhưng không làm đỏ — nếu lượt nào cũng đỏ thì cảnh báo mất tác dụng.

Phân loại mặt hàng (`classifyGoldType`) suy ra từ tên sản phẩm nên áp dụng được
ngược lại cho cả dữ liệu cũ: `Vàng nhẫn` · `Vàng miếng` · `Trang sức` · `Nguyên liệu` · `Khác`.

### Tab Giá Vàng trên giao diện
Một trang duy nhất, không còn chia tab con:

1. **Biến động lịch sử** — line chart 3 nhà (mặt hàng tiêu biểu) + **giá vàng thế giới**,
   kèm bảng số theo ngày bên dưới
2. **Bảng giá hiện tại** — phân khu `SJC` · `PNJ` · `Bảo Tín Minh Châu` · `Khác`

Tab riêng **Vàng Trong Ngày** hiển thị dạng bảng, mỗi dòng là **một lần hệ thống lấy
dữ liệu** (không gộp theo ngày như tab Giá Vàng):

- Chọn ngày · chuyển giá mua/giá bán
- Chênh lệch so với **lần lấy liền trước** hiện ngay dưới mỗi giá
- 3 thẻ biên độ dao động trong ngày của từng nhà
- Cột **Số mặt hàng** tô đỏ khi lần lấy đó thiếu so với mức đầy đủ — dấu hiệu có nguồn
  đang lỗi. So với mức đầy đủ của toàn bộ dữ liệu chứ không phải của riêng ngày đang
  xem, vì khi một nguồn chết cả ngày thì mốc trong ngày cũng thấp theo và lỗi bị che.

Dữ liệu giới hạn `MAX_INTRADAY_DAYS = 7` ngày gần nhất và chỉ gồm mặt hàng tiêu biểu —
nếu chạy sync 10 phút/lần thì một ngày có tới ~144 lần lấy, gửi hết xuống client sẽ phình.

Mặt hàng đại diện trên biểu đồ (sửa ở `BRAND_REPRESENTATIVE` trong `gold-price.ts`):

| Nhà | Mặt hàng đại diện |
|-----|-------------------|
| SJC | `VÀNG MIẾNG SJC` |
| BTMC | `VÀNG MIẾNG VRTL` |
| PNJ | `Nhẫn Trơn PNJ 999.9` |

> **Giá thế giới được quy về VNĐ/chỉ** để vẽ chung một trục với giá trong nước:
> `VNĐ/chỉ = USD/oz × (3,75 / 31,1035) × tỷ giá`. Tỷ giá lấy từ **Vietcombank (giá bán ra)**,
> dự phòng `open.er-api.com`, và được lưu vào **cột H** của sheet `GoldPrice` ngay tại
> thời điểm chụp — nên lịch sử quy đổi theo đúng tỷ giá của từng ngày, không dùng
> tỷ giá hôm nay áp ngược về quá khứ. Đường thế giới vẽ **nét đứt** để phân biệt với
> giá niêm yết; tooltip và bảng vẫn hiện giá USD gốc.
>
> Khoảng cách giữa nét đứt và các đường còn lại chính là mức chênh của vàng trong nước.
> Đo ngày 23/9/2026: SJC +6,4% · PNJ +6,4% · BTMC +7,2%.

### Sheet `GoldPrice`

| Cột | A | B | C | D | E | F | G | H |
|-----|---|---|---|---|---|---|---|---|
| | thời điểm | hãng | tên | mua | bán | USD/oz | timestamp | **tỷ giá USD/VND** |

Giá trong nước niêm yết theo **chỉ (3,75g)**, không phải lượng — đã đối chiếu với
giá thế giới quy đổi để xác nhận.

## ⚙️ Cách hoạt động

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│ RSS Feeds   │────▶│ aggregator   │────▶│ summarizer   │────▶│ Google   │
│ (11 nguồn)  │     │ (TypeScript) │     │ (Python NLP) │     │ Sheets   │
└─────────────┘     └──────────────┘     └──────────────┘     └────┬─────┘
                                                                   │
                    ┌──────────────┐     ┌──────────────┐          │
                    │ Vercel       │◀────│ Next.js App  │◀─────────┘
                    │ (Deploy)     │     │ (page.tsx)   │
                    └──────────────┘     └──────────────┘
```

### Luồng Sync (mỗi 30 phút):
1. GitHub Actions trigger `sync-news.ts`
2. Với mỗi category (2 mục), tuần tự:
   - Đọc tin hiện tại từ Google Sheets
   - Fetch RSS feeds → lấy tối đa **15 bài/nguồn**
   - Lọc bỏ bài đã tồn tại (theo URL)
   - Gọi Python summarizer cho bài mới (tối đa **10 bài mới/category**, timeout **30 giây/bài**)
   - Merge + sắp xếp theo thời gian → ghi lại Google Sheets
3. Nếu không có tin mới → chỉ update heartbeat (cell Z1)
4. Mỗi category có try/catch riêng → 1 category lỗi không ảnh hưởng category khác

---

## 🛠️ Cài đặt

### Yêu cầu
- Node.js 20+
- Python 3.10+ (cho summarizer)
- Tài khoản Google Service Account (truy cập Google Sheets API)

### Bước 1: Clone và cài dependencies

```bash
cd tin-tuc-app
npm install
```

### Bước 2: Cài Python dependencies

```bash
python -m pip install newspaper3k lxml_html_clean nltk
python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab')"
```

### Bước 3: Cấu hình `.env`

```env
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Tuy chon
BTMC_API_KEY=...        # override key API gia vang neu BTMC doi key
PYTHON_PATH=python3     # mac dinh dung .venv trong project
```

### Bước 4: Tạo Google Sheets

Tạo 1 Google Spreadsheet với **3 sheet tab**:
- `Sheet1` — Tin Chung
- `Finance` — Tài Chính
- `GoldPrice` — Lịch sử giá vàng

> ⚠️ Chia sẻ spreadsheet cho Service Account email ở trên với quyền **Editor**.

---

## 🏃 Chạy ứng dụng

### Development:
```bash
npm run dev
```
Mở browser tại: **http://localhost:3000**

### Sync tin tức (local):
```bash
npm run sync:local    # Dùng .env file
```

### Build production:
```bash
npm run build
npm start
```

---

## 📚 Scripts

| Command | Mô tả |
|---------|-------|
| `npm run dev` | Chạy development server |
| `npm run build` | Build production |
| `npm start` | Chạy production server |
| `npm run lint` | Check linting errors |
| `npm run sync` | Sync tin tức (CI/CD, không cần .env file) |
| `npm run sync:local` | Sync tin tức (local, dùng .env file) |
| `npm run sync:local -- --today` | Backfill: chỉ lấy bài đăng trong ngày hôm nay |

---

## 🔄 GitHub Actions (CI/CD)

File: `.github/workflows/sync.yml`

- **Schedule:** Mỗi 30 phút (`*/30 * * * *`)
- **Manual trigger:** Hỗ trợ `workflow_dispatch`
- **Steps:** Setup Node.js 20 → Setup Python 3.10 → Install deps → Run sync
- **Secrets cần cấu hình:**
  - `GOOGLE_SHEET_ID`
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
  - `GOOGLE_PRIVATE_KEY`

---

## 🔐 Cấu hình Performance & Error Handling (v5)

| Config | Giá trị | Mục đích |
|--------|---------|----------|
| `maxItemsPerSource` | 100 | Quét hết feed (VNExpress/Tuổi Trẻ trả 50-60 bài) |
| `maxNewItems` | **0 = không giới hạn** | Mỗi lượt lấy bằng hết bài chưa có trong sheet |
| `MAX_ITEMS_PER_SHEET` | 5000 | Trần số bài giữ lại mỗi sheet (trước là 500) |
| `SUMMARIZER_TIMEOUT_MS` | 30 giây | Tránh treo khi URL không phản hồi |
| `SUMMARIZER_CONCURRENCY` | 4 | Tóm tắt song song 4 bài (trước tuần tự, chặn event loop) |
| Chia suất vòng tròn | ✅ | Khi có đặt `maxNewItems`, chia đều cho mọi nguồn |
| Nới lưới tự động | ✅ | `values.update` không tự mở rộng sheet quá 1000 dòng - phải nới trước khi ghi |
| Ghi theo lô 1000 dòng | ✅ | Vài nghìn dòng tóm tắt trong 1 request dễ vượt giới hạn payload |
| Try/catch per category | ✅ | 1 category lỗi không ảnh hưởng category khác |
| Heartbeat-only update | ✅ | Không ghi lại toàn bộ sheet khi không có tin mới |
| Ghi trước - xoá sau | ✅ | Lỗi giữa chừng không để lại sheet trống |


## ⏱️ Kích hoạt sync đúng nhịp (bộ kích hoạt ngoài)

**Vì sao cần:** GitHub hoãn cron của repo public rất nặng. Đo thực tế trên chính repo này
với lịch `*/30`:

| Ngày | Khoảng cách thực tế giữa các lượt |
|------|-----------------------------------|
| 8/8/2026 | 35 · 50 · 54 · 59 phút |
| 17–18/9/2026 | 141 · 193 · 244 · **303** phút |

Đặt lịch dày hơn chỉ tăng cơ hội, không ép được. `workflow_dispatch` gọi qua API thì
**không bị hoãn**, nên lịch `*/10` trong `sync.yml` chỉ đóng vai trò dự phòng.

### Bước 1 — Tạo token

GitHub → *Settings* → *Developer settings* → *Personal access tokens* → **Fine-grained tokens**

- **Repository access:** chỉ chọn `tin-tuc-app`
- **Permissions:** chỉ bật `Actions` = **Read and write**
- Không cần bất kỳ quyền nào khác

### Bước 2 — Thử tại máy trước

```bash
GITHUB_TOKEN=github_pat_xxx ./scripts/trigger-sync.sh
```

Trả về `OK - da kich hoat sync tren nhanh master.` là dùng được.
Script báo rõ từng mã lỗi (401 token sai · 403 thiếu quyền · 404 sai repo · 422 sai nhánh).

### Bước 3 — Cắm vào dịch vụ cron

**Cách A — cron-job.org** (miễn phí, nhanh nhất)

| Trường | Giá trị |
|--------|---------|
| URL | `https://api.github.com/repos/Jobox66/tin-tuc-app/actions/workflows/sync.yml/dispatches` |
| Method | `POST` |
| Schedule | mỗi 10 phút (hoặc tuỳ ý, tối thiểu nên ≥ 5 phút) |
| Header | `Authorization: Bearer <PAT>` |
| Header | `Accept: application/vnd.github+json` |
| Body | `{"ref":"master"}` |

Thành công = HTTP **204** (không có nội dung trả về).

**Cách B — Google Apps Script** (không cần đăng ký dịch vụ thứ ba, và anh đã dùng Google Sheets)

Mở Apps Script từ chính spreadsheet, dán đoạn dưới, rồi đặt *Trigger* kiểu
**Time-driven → Minutes timer → Every 10 minutes**:

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

Lưu token vào *Project Settings* → *Script properties* → khoá `GH_TOKEN`.
Đừng viết thẳng token vào code.

> **Lưu ý:** `concurrency.cancel-in-progress` để `false`, nên nếu lượt trước chưa xong thì
> lượt mới xếp hàng chờ chứ không giết ngang — tránh ghi dở sheet. Mỗi lượt ~2 phút nên
> nhịp 10 phút không bao giờ dồn ứ.

---

## 📝 License

Private project · Built by DucTN
