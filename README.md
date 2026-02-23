# Tin Tức App

Web application quản lý và hiển thị tin tức, được xây dựng với Next.js và PostgreSQL.

## 🚀 Tech Stack

- **Frontend:** Next.js 16 (App Router) + TypeScript
- **Styling:** TailwindCSS
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** NextAuth.js
- **Code Quality:** ESLint

## 📁 Cấu trúc thư mục

```
tin-tuc-app/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   ├── lib/             # Utilities & configs
│   ├── services/        # Business logic
│   ├── types/           # TypeScript types
│   └── utils/           # Helper functions
├── prisma/              # Database schema
├── docs/                # Documentation
│   ├── specs/          # Feature specifications
│   └── architecture/   # Architecture docs
├── public/              # Static assets
└── .brain/             # AI context storage

```

## 🛠️ Cài đặt

### Yêu cầu
- Node.js 18+ 
- PostgreSQL 15+
- npm hoặc yarn

### Bước 1: Clone và cài dependencies

```bash
cd tin-tuc-app
npm install
```

### Bước 2: Cấu hình database

1. Tạo database PostgreSQL:
```sql
CREATE DATABASE tin_tuc_db;
```

2. Copy `.env.example` thành `.env.local`:
```bash
cp .env.example .env.local
```

3. Cập nhật `DATABASE_URL` trong `.env.local`:
```
DATABASE_URL="postgresql://your_user:your_password@localhost:5432/tin_tuc_db"
```

### Bước 3: Chạy database migration

```bash
npx prisma migrate dev --name init
npx prisma generate
```

## 🏃 Chạy ứng dụng

### Development mode:
```bash
npm run dev
```

Mở browser tại: **http://localhost:3000**

### Build production:
```bash
npm run build
npm start
```

## 📚 Scripts

| Command | Mô tả |
|---------|-------|
| `npm run dev` | Chạy development server |
| `npm run build` | Build production |
| `npm start` | Chạy production server |
| `npm run lint` | Check linting errors |
| `npx prisma studio` | Mở Prisma Studio (database GUI) |
| `npx prisma migrate dev` | Tạo migration mới |
| `npx prisma generate` | Generate Prisma Client |

## 🔐 Environment Variables

Xem file `.env.example` để biết danh sách đầy đủ các biến môi trường cần thiết.

## 📖 Documentation

- [Architecture Overview](./docs/architecture/system_overview.md)
- [Feature Specs](./docs/specs/)

## 🤝 Contributing

Khi thêm tính năng mới:
1. Gõ `/plan` để thiết kế
2. Gõ `/code` để implement
3. Gõ `/test` để kiểm thử
4. Gõ `/save-brain` để lưu knowledge

## 📝 License

Private project
