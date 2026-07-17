# Team Insights Dashboard

A Power BI–style dashboard: connect a Google Sheet per department, build charts/tables with filters, refresh on demand, export any chart or table to Excel, and ask an AI assistant questions about the data.

This is a **real, working frontend** you can push to GitHub and deploy today. A few pieces (real login, real multi-user roles) are wired as clearly-marked demos so you can ship the UI first and harden the backend when you're ready — see "Making it production-ready" below.

## Run it locally

```bash
npm install
npm run dev
```

Open the local URL it prints. Demo accounts (see `src/lib/auth.tsx`):
- `admin@example.com` → admin (can add departments, connect sheets, edit charts)
- `manager@example.com` → viewer (read-only)

## Connecting a Google Sheet

1. In Google Sheets: **Share → General access → Anyone with the link → Viewer**.
2. Copy the share link.
3. In the app, as an admin, click **Connect Google Sheet** on any department page and paste the link.
4. Click **Refresh data** any time your team updates the sheet.

The app reads the sheet as published CSV — no Google Cloud project or OAuth setup needed for this part. The first row of the sheet becomes your column headers.

## Deploying (free, no Lovable subscription needed)

1. Push this folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) or [netlify.com](https://netlify.com), sign in with GitHub, and import the repo. Both auto-detect Vite and deploy for free.
3. Once deployed, you'll get a free URL (e.g. `yourapp.vercel.app`). To use your own domain (bought from GoDaddy, Namecheap, etc.), add it under the project's **Domains** settings and follow the DNS instructions — this is free on both platforms.

## Wiring up the AI assistant

The assistant calls `/api/assistant` from the frontend (see `src/lib/assistant.ts`) — it never calls Anthropic directly, because an API key in frontend code would be visible to anyone via devtools.

To enable it on Vercel:
1. Rename `api/assistant.example.js` to `api/assistant.js`.
2. In your Vercel project → Settings → Environment Variables, add `ANTHROPIC_API_KEY` (from [console.anthropic.com](https://console.anthropic.com)).
3. Redeploy. Vercel automatically turns files in `/api` into serverless functions.

(On Netlify, move the same logic into `netlify/functions/assistant.js` using Netlify's handler signature, and add a redirect from `/api/assistant` to it in `netlify.toml`.)

## Making it production-ready

Two things in this build are intentionally simple so you could get a working app fast. Before sharing this outside your own team, consider upgrading them:

**1. Real authentication.** `src/lib/auth.tsx` currently checks emails against a list hard-coded in the frontend — anyone who reads the JS bundle can see the allow-list, and there's no password/identity verification. Swap this for real auth once you need it to be secure, e.g.:
   - [Supabase Auth](https://supabase.com/auth) with Google sign-in and a `profiles` table storing each user's role, or
   - Any other auth provider (Auth0, Clerk, Firebase Auth).

**2. Enforcing roles server-side.** Right now "admin vs viewer" only hides buttons in the UI. A determined user could still call the underlying functions. Once you add real auth, pair it with a real backend (Supabase Postgres + Row Level Security, or your own API) so permissions are enforced on the server, not just in the interface.

Everything else — the sheet connection, charts, filters, tables, Excel export, and the assistant proxy pattern — is production-ready as-is.

## Project structure

```
src/
  components/     UI components (Sidebar, TopBar, FilterBar, ChartCard, DataTable, AIAssistant, ...)
  lib/             auth.tsx (login), sheets.ts (Google Sheet fetching), exportExcel.ts, assistant.ts
  data/            sample demo data shown before a sheet is connected
  types/           shared TypeScript types
api/
  assistant.example.js   serverless proxy to the Anthropic API (rename to enable)
```
