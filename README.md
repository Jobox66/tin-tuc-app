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
│   │   ├── page.tsx          # Trang chủ - hiển thị tin tức 5 mục
│   │   └── actions.ts        # Server actions (save/hide bài viết)
│   ├── components/
│   │   └── NewsFeed.tsx      # Component hiển thị tin tức với 5 tab
│   ├── lib/
│   │   ├── aggregator.ts     # RSS fetcher + nguồn tin (13 nguồn)
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

## 📰 Nguồn tin (13 nguồn RSS)

### 🇻🇳 Tin Việt Nam

| Mục | Nguồn | Sheet |
|-----|-------|-------|
| **Tin Chung** | VNExpress, Tuổi Trẻ | `Sheet1` |
| **Tài Chính** | Vietstock, CafeF, Báo Đầu Tư | `Finance` |

### 🌍 Tin Quốc Tế

| Mục | Nguồn | Sheet |
|-----|-------|-------|
| **Quốc Tế** | BBC World, Reuters, CNN, Al Jazeera, The Guardian, AP News | `International` |
| **Tài Chính QT** | CNBC, Bloomberg, MarketWatch, Financial Times | `IntlFinance` |
| **Công Nghệ** | TechCrunch, The Verge, Ars Technica | `IntlTech` |

---

## ⚙️ Cách hoạt động

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│ RSS Feeds   │────▶│ aggregator   │────▶│ summarizer   │────▶│ Google   │
│ (13 nguồn)  │     │ (TypeScript) │     │ (Python NLP) │     │ Sheets   │
└─────────────┘     └──────────────┘     └──────────────┘     └────┬─────┘
                                                                   │
                    ┌──────────────┐     ┌──────────────┐          │
                    │ Vercel       │◀────│ Next.js App  │◀─────────┘
                    │ (Deploy)     │     │ (page.tsx)   │
                    └──────────────┘     └──────────────┘
```

### Luồng Sync (mỗi 30 phút):
1. GitHub Actions trigger `sync-news.ts`
2. Với mỗi category (5 mục), tuần tự:
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
```

### Bước 4: Tạo Google Sheets

Tạo 1 Google Spreadsheet với **5 sheet tab**:
- `Sheet1` — Tin Chung (VN)
- `Finance` — Tài Chính (VN)
- `International` — Tin Quốc Tế
- `IntlFinance` — Tài Chính Quốc Tế
- `IntlTech` — Công Nghệ

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

## 🔐 Cấu hình Performance & Error Handling (v4)

| Config | Giá trị | Mục đích |
|--------|---------|----------|
| `maxItemsPerSource` | 15 | Giới hạn số bài lấy từ mỗi nguồn RSS |
| `maxNewItems` | 10 | Dừng sớm khi đã có đủ bài mới |
| `timeout` (summarizer) | 30 giây | Tránh treo khi URL không phản hồi |
| Try/catch per category | ✅ | 1 category lỗi không ảnh hưởng category khác |
| Heartbeat-only update | ✅ | Không ghi lại toàn bộ sheet khi không có tin mới |


## 📝 License

Private project · Built by DucTN
