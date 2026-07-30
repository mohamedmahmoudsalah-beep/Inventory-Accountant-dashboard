// EXAMPLE serverless cron function for Vercel: a daily email digest of every
// Card widget's value across every team/page, sent through Resend.
//
// Why an HTML digest instead of literally emailing the PDF export: turning a
// live dashboard page into a pixel-perfect PDF needs a real browser (headless
// Chromium) rendering React + recharts, which is heavy to run inside a
// serverless function on Vercel's free Hobby tier. A plain HTML table of
// "every Card's current number" covers the same need — "what happened
// overnight, without opening the dashboard" — without that infrastructure.
// The in-app "Export page to PDF" button (TopBar) still exists for anyone who
// wants the exact visual page whenever they're looking at it.
//
// Setup:
//   1. Sign up at https://resend.com (free tier: 3,000 emails/month, 100/day,
//      no credit card). Free accounts can send from Resend's own shared
//      "onboarding@resend.dev" address to any verified recipient right away —
//      good enough to start. Verifying your own domain (Resend dashboard ->
//      Domains, add a few DNS records at your registrar) lets you send from
//      e.g. reports@yourcompany.com instead, and removes the "verified
//      recipient" restriction so you can email anyone.
//   2. Create an API key: Resend dashboard -> API Keys -> Create API Key.
//   3. Rename this file to `cron-daily-report.js` (drop ".example").
//   4. Add these environment variables in Vercel (Project Settings ->
//      Environment Variables) — same place as the other server-only vars:
//        SUPABASE_URL              = (same value as the refresh-sheets cron)
//        SUPABASE_SERVICE_ROLE_KEY = (same value as the refresh-sheets cron)
//        RESEND_API_KEY            = the key from step 2
//        REPORT_FROM_EMAIL         = onboarding@resend.dev (or your verified
//                                    sender once you've set up a domain)
//        REPORT_RECIPIENTS         = comma-separated list, e.g.
//                                    "mohamed.mahmoudsalah@breadfast.com,manager@breadfast.com"
//        CRON_SECRET               = same value as the refresh-sheets cron
//   5. Add a second entry to the "crons" array in vercel.json (already done
//      in this repo) pointing at "/api/cron-daily-report". Vercel's free
//      Hobby tier allows a small number of cron jobs (2, as of writing) as
//      long as each fires at most once a day — this and the existing
//      refresh-sheets cron together fit that.
//   6. Deploy. The report goes out on its own schedule from then on.
//
// This only reports Card widgets (the "headline number" widget type) — Chart/
// Pivot/Matrix aren't included since they don't reduce to one number, and are
// better viewed live in the dashboard or the PDF export.

import { createClient } from "@supabase/supabase-js";

function parseNumeric(value) {
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  if (value === null || value === undefined) return 0;
  const str = String(value).trim();
  if (str === "") return 0;
  const cleaned = str.replace(/[^0-9.\-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function aggregateColumn(rows, column, agg, conditionColumn, conditionValue) {
  const filtered =
    conditionColumn && conditionValue !== undefined && conditionValue !== ""
      ? rows.filter((r) => String(r[conditionColumn]) === conditionValue)
      : rows;
  if (agg === "distinct") return new Set(filtered.map((r) => String(r[column] ?? ""))).size;
  const values = filtered.map((r) => parseNumeric(r[column]));
  if (values.length === 0) return 0;
  switch (agg) {
    case "sum": return values.reduce((a, b) => a + b, 0);
    case "avg": return values.reduce((a, b) => a + b, 0) / values.length;
    case "count": return values.length;
    case "max": return Math.max(...values);
    case "min": return Math.min(...values);
    default: return 0;
  }
}

function formatCompact(value) {
  if (!isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

async function loadAllRows(supabase, pageId) {
  const { data, error } = await supabase
    .from("page_row_chunks")
    .select("data")
    .eq("page_id", pageId)
    .order("chunk_index", { ascending: true });
  if (error) throw error;
  return (data ?? []).flatMap((c) => c.data ?? []);
}

function computeCardValue(rows, config, measures) {
  const filtered = config.filter
    ? rows.filter((r) => String(r[config.filter.column] ?? "") === config.filter.value)
    : rows;
  if (config.value?.kind === "column") {
    return aggregateColumn(filtered, config.value.column, config.value.agg);
  }
  const m = (measures ?? []).find((mm) => mm.id === config.value?.measureId);
  return m ? aggregateColumn(filtered, m.column, m.agg, m.conditionColumn, m.conditionValue) : 0;
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.REPORT_FROM_EMAIL;
  const recipients = (process.env.REPORT_RECIPIENTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured" });
  }
  if (!resendKey || !fromEmail || recipients.length === 0) {
    return res.status(500).json({ error: "RESEND_API_KEY / REPORT_FROM_EMAIL / REPORT_RECIPIENTS not configured — see setup notes at the top of this file" });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: teams, error: teamsError } = await supabase.from("teams").select("id, name").order("name");
  if (teamsError) return res.status(500).json({ error: teamsError.message });

  const { data: pages, error: pagesError } = await supabase.from("pages").select("id, team_id, name, measures");
  if (pagesError) return res.status(500).json({ error: pagesError.message });

  const { data: widgets, error: widgetsError } = await supabase
    .from("widgets")
    .select("page_id, kind, config")
    .eq("kind", "card");
  if (widgetsError) return res.status(500).json({ error: widgetsError.message });

  const sections = [];
  for (const team of teams ?? []) {
    const teamPages = (pages ?? []).filter((p) => p.team_id === team.id);
    const pageBlocks = [];
    for (const page of teamPages) {
      const cardWidgets = (widgets ?? []).filter((w) => w.page_id === page.id);
      if (cardWidgets.length === 0) continue;
      const rows = await loadAllRows(supabase, page.id);
      const measures = page.measures ?? [];
      const cardRows = cardWidgets.map((w) => {
        const config = w.config ?? {};
        const value = computeCardValue(rows, config, measures);
        return `<tr><td style="padding:4px 12px 4px 0;color:#555;">${config.title ?? "Untitled"}</td><td style="padding:4px 0;font-weight:600;">${formatCompact(value)}</td></tr>`;
      });
      pageBlocks.push(
        `<h3 style="margin:12px 0 4px;font-size:14px;color:#333;">${page.name}</h3><table>${cardRows.join("")}</table>`
      );
    }
    if (pageBlocks.length > 0) {
      sections.push(`<h2 style="margin:20px 0 4px;font-size:16px;">${team.name}</h2>${pageBlocks.join("")}`);
    }
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h1 style="font-size:18px;">Daily report — General Report Inventory Accountant team</h1>
      <p style="color:#777;font-size:12px;">${new Date().toLocaleString()}</p>
      ${sections.length > 0 ? sections.join("") : "<p>No Card widgets found to report on yet.</p>"}
    </div>
  `;

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: recipients,
      subject: `Daily report — ${new Date().toLocaleDateString()}`,
      html,
    }),
  });

  if (!sendRes.ok) {
    const errText = await sendRes.text();
    console.error("cron-daily-report: Resend send failed", errText);
    return res.status(500).json({ error: `Resend API error: ${errText}` });
  }

  return res.status(200).json({ sent: true, recipients, sections: sections.length });
}
