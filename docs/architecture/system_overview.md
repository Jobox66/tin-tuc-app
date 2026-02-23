# System Overview - Tin Tức App

## 📋 Tổng quan

**Tin Tức App** là ứng dụng web quản lý và hiển thị tin tức.

## 🏗️ Kiến trúc

### Tech Stack
- **Frontend:** Next.js 16 (App Router), React, TypeScript
- **Styling:** TailwindCSS
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL 
- **ORM:** Prisma
- **Authentication:** NextAuth.js

### Folder Structure

```
/src
  /app          - Next.js pages (App Router)
  /components   - Reusable UI components
  /lib          - Shared libraries & configs
  /services     - Business logic layer
  /types        - TypeScript type definitions
  /utils        - Helper functions
/prisma         - Database schema & migrations
/docs           - Documentation
  /specs        - Feature specifications
  /architecture - Architecture documents
/.brain         - AI context storage
  brain.json    - Static project knowledge
  session.json  - Dynamic session state (gitignored)
/public         - Static assets
```

## 🗄️ Database Schema

### User Model
- `id`: Unique identifier (cuid)
- `email`: Email (unique)
- `name`: Full name (optional)
- `password`: Hashed password
- `role`: User role (user/admin)
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

## 🔐 Authentication Flow

NextAuth.js được sử dụng cho authentication với:
- Credentials provider (email/password)
- JWT session strategy
- Bcrypt password hashing

## 🚀 Deployment

(Sẽ cập nhật sau khi có deployment strategy)

## 📝 Next Steps

1. Implement authentication UI (login/register)
2. Create article management features
3. Add role-based access control
4. Implement article CRUD operations

---

**Last Updated:** 2026-01-19  
**Status:** Initial Setup Complete
