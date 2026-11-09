# 📰 Tin Tức App

Ứng dụng web tổng hợp tin tức tiếng Việt và giá vàng, dùng Google Sheets làm nơi lưu trữ và hiển thị bằng Next.js.

- **Tin Chung:** VNExpress, Tuổi Trẻ (chuyên mục Thời sự, Thế giới, Kinh doanh, Khoa học công nghệ)
- **Tài Chính:** Vietstock, CafeF
- **Giá vàng:** SJC, PNJ, Bảo Tín Minh Châu cùng giá thế giới quy đổi VNĐ/chỉ. Có biểu đồ lịch sử và bảng biến động trong ngày.
- Bài báo được tóm tắt tự động bằng Python (`newspaper3k` + NLTK).

| Thành phần | Công nghệ |
|---|---|
| Giao diện | Next.js 16 (App Router), TypeScript, TailwindCSS, deploy trên Vercel |
| Lưu trữ | Google Sheets API v4 (service account) |
| Lấy tin nhanh | Route `/api/sync` trên Vercel, do cron-job.org gọi định kỳ |
| Tóm tắt, giá vàng, dọn dữ liệu | GitHub Actions (`.github/workflows/sync.yml`) |

Tài liệu kỹ thuật chi tiết (nguồn dữ liệu, luồng sync, cấu hình Vercel/cron) và các việc đang làm nằm ở [`w_doc/caitien.md`](w_doc/caitien.md).

## Cài đặt

**Yêu cầu:** Node.js 20+, Python 3.10+, một Google Service Account có quyền dùng Google Sheets API.

```bash
npm install
python -m pip install -r requirements.txt
python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab')"
```

Tạo file `.env`:

```env
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Tạo một Google Spreadsheet có 3 tab `Sheet1` (Tin Chung), `Finance` (Tài Chính), `GoldPrice` (giá vàng). Chia sẻ spreadsheet cho email service account với quyền **Editor**.

## Chạy

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy giao diện tại http://localhost:3000 |
| `npm run sync:local` | Chạy một lượt sync đầy đủ tại máy (đọc `.env`) |
| `npm test` | Unit test |
| `npm run build` && `npm start` | Build và chạy bản production |

---

Private project · Built by DucTN
