# Database Schema Documentation

## Overview
Database: PostgreSQL
ORM: Prisma

## Models

### User
Bảng lưu thông tin người dùng và quản trị viên.

| Column | Type | Attributes | Description |
|--------|------|------------|-------------|
| `id` | String | `@id @default(cuid())` | Unique identifier (CUID) |
| `email` | String | `@unique` | Email address (Login credential) |
| `name` | String? | | Full name |
| `password` | String | | Hashed password |
| `role` | String | `@default("user")` | Role: "user" or "admin" |
| `createdAt` | DateTime | `@default(now())` | Creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

## Upcoming Models (Planned)

### Article (News Content)
- `title`: String
- `slug`: String (unique)
- `content`: Text/JSON
- `thumbnail`: String (URL)
- `categoryId`: Relation to Category

### Category
- `name`: String
- `slug`: String
