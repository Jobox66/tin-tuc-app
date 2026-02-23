# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.1.0] - 2026-01-19
### Added
- Initial Next.js 16 project setup with TypeScript and TailwindCSS.
- PostgreSQL database connection with Prisma ORM (v6).
- Authentication implementation plan (NextAuth.js).
- `User` model in database schema.
- Project documentation structure (`docs/`, `.brain/`).
- News Management implementation plan.

### Changed
- Downgraded Prisma from v7.2.0 to v6 to ensure stability and compatibility.
- Configured `.env` to use IPv4 (`127.0.0.1`) for reliable database connection.

### Fixed
- Fixed `npx` command not found issue by refreshing environment variables.
- Fixed database connection authentication errors.
