# BI Dashboard - Business Intelligence Platform

## 🚀 Quick Start

```bash
# 1. Enter project directory
cd bi-dashboard

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# 4. Setup database
npx prisma generate
npx prisma db push

# 5. Run development server
npm run dev
```

## 🔧 Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite database path |
| `NEXTAUTH_SECRET` | Random secret string (generate with `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Your app URL (http://localhost:3000) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Service Account Email |
| `GOOGLE_PRIVATE_KEY` | Google Service Account Private Key |

## 📁 Project Structure

```
src/
├── app/              # Next.js App Router
│   ├── api/         # API Routes
│   ├── (dashboard)/ # Protected Dashboard Pages
│   └── login/       # Login Page
├── components/       # React Components
│   ├── charts/      # Chart Components
│   ├── dashboard/   # Dashboard Components
│   ├── data-sources/# Data Source Connectors
│   ├── layout/      # Layout Components
│   └── ui/          # UI Components
├── lib/             # Utilities & APIs
│   ├── auth/        # Auth Config & RBAC
│   ├── db/          # Prisma Client
│   ├── google/      # Google APIs
│   └── utils.ts     # Utilities
├── types/           # TypeScript Types
├── i18n/            # Internationalization
├── hooks/           # Custom React Hooks
└── messages/        # Translation Files
```

## 🛠️ Tech Stack

- **Next.js 14** - React Framework with App Router
- **TypeScript** - Type Safety
- **Tailwind CSS** - Utility-first Styling
- **Prisma** - Database ORM (SQLite)
- **NextAuth.js** - Authentication (Google OAuth)
- **Recharts** - Interactive Charts
- **next-intl** - i18n (Arabic/English)
- **next-themes** - Dark/Light Mode

## ✨ Features

### Implemented (MVP)
- ✅ Authentication with Google OAuth
- ✅ Role-Based Access Control (Admin, Manager, Employee, Viewer)
- ✅ Business Units Management
- ✅ Google Sheets Integration
- ✅ Google Drive Integration
- ✅ Dataset Management
- ✅ Dashboard Builder (Basic)
- ✅ Interactive Charts (Bar, Line, Pie, Table, KPI)
- ✅ Dark & Light Mode
- ✅ Arabic & English Support (RTL/LTR)
- ✅ Responsive Design

### Coming Soon
- 🔄 Data Transformations (Power Query-like)
- 🤖 AI Assistant
- 📊 Advanced Dashboard Builder (Drag & Drop)
- 📤 Export (Excel, CSV, PDF, PNG)
- 🔗 Advanced Sharing & Permissions
- 📝 Audit Logs
- 🔔 Notifications
- 🗑️ Recycle Bin
- 📜 Version History
- 🔌 Plugin System

## 📝 Google Setup Guide

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable APIs: Google Sheets API, Google Drive API
4. Create OAuth 2.0 credentials for web app
5. Create Service Account and download JSON key
6. Share your Google Sheets with the Service Account email

## 📈 Roadmap

| Phase | Features | Status |
|-------|----------|--------|
| 1 | Core Dashboard, Auth, Google Sheets | ✅ Done |
| 2 | Data Transformations, Advanced Charts | 🔄 Next |
| 3 | AI Assistant, Smart Insights | 📋 Planned |
| 4 | Plugins, Version History, Audit | 📋 Planned |

## 🐛 Troubleshooting

**Issue: Google Sheets API returns 403**
- Make sure you shared the sheet with the Service Account email
- Verify the Service Account has Sheets API access

**Issue: Database errors**
- Run `npx prisma generate` after schema changes
- Delete `prisma/dev.db` and run `npx prisma db push` to reset

**Issue: NextAuth errors**
- Make sure `NEXTAUTH_SECRET` is set
- Check `NEXTAUTH_URL` matches your actual URL

## 📄 License

MIT License - Internal Use Only
