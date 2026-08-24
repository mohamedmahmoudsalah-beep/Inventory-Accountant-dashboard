import type { ChartType, DataRow, PivotAgg } from "../types";

interface AskContext {
  departmentName: string;
  rows: DataRow[];
  columns: string[];
}

/** One widget in an AI-proposed dashboard plan, keyed by column NAME (not
 *  id) — App.tsx's applyAutoBuildWidgets resolves names against the page's
 *  actual columns and builds the real Chart/Pivot/Matrix/Card/Text config. */
export type AutoWidgetSpec =
  | { kind: "card"; title: string; valueColumn: string; agg: PivotAgg }
  | { kind: "chart"; title: string; chartType: ChartType; xColumn: string; yColumn: string }
  | { kind: "pivot"; title: string; groupColumns: string[]; valueColumn: string; agg: PivotAgg }
  | { kind: "matrix"; title: string; rowColumn: string; colColumn: string; valueColumn: string; agg: PivotAgg }
  | { kind: "text"; title: string; body: string };

export interface AutoBuildResult {
  /** Non-empty only when the AI needs the user to clarify an ambiguous
   *  column before it can build anything — see autoBuildDashboard's doc. */
  clarifyingQuestions: string[];
  widgets: AutoWidgetSpec[];
  /** Egyptian-Arabic explanation of what was built and why — empty when
   *  clarifyingQuestions is non-empty (nothing was built yet). */
  summary: string;
}

// IMPORTANT: this calls YOUR OWN backend endpoint, not Anthropic directly.
// Never put an Anthropic API key in frontend code — it would be visible to
// anyone who opens devtools. Deploy the matching serverless function from
// /api/assistant.example.js (see README.md "Wiring up the AI assistant")
// to Vercel/Netlify, which keeps your key on the server.
const ASSISTANT_ENDPOINT = "/api/assistant";

export async function askAssistant(question: string, context: AskContext): Promise<string> {
  // Keep the payload small: send column names and a capped row sample
  // rather than the entire dataset.
  const sample = context.rows.slice(0, 50);

  const res = await fetch(ASSISTANT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      departmentName: context.departmentName,
      columns: context.columns,
      sampleRows: sample,
      totalRows: context.rows.length,
    }),
  });

  if (!res.ok) {
    let reason = `status ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.error) reason = errBody.error;
    } catch {
      // response wasn't JSON — keep the status-code fallback above
    }
    throw new Error(reason);
  }

  const data = await res.json();
  return data.answer as string;
}

/** Asks the AI to design a small dashboard from this page's columns/sample
 *  data, and either gets back a build plan or a short list of clarifying
 *  questions (only when a column name is genuinely ambiguous).
 *
 *  Two-turn flow, driven by the caller (AIAssistant.tsx):
 *   1. Call with no `clarification`. If `clarifyingQuestions` comes back
 *      non-empty, `widgets` will be empty — show the questions, collect the
 *      user's answer, and call again.
 *   2. Call again passing that Q&A as `clarification`; this time `widgets`
 *      and `summary` come back filled in and nothing more is asked. */
export async function autoBuildDashboard(
  context: AskContext,
  clarification?: { question: string; answer: string }[]
): Promise<AutoBuildResult> {
  const sample = context.rows.slice(0, 50);

  const res = await fetch(ASSISTANT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "auto-build",
      departmentName: context.departmentName,
      columns: context.columns,
      sampleRows: sample,
      totalRows: context.rows.length,
      clarification: clarification ?? [],
    }),
  });

  if (!res.ok) {
    let reason = `status ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.error) reason = errBody.error;
    } catch {
      // response wasn't JSON — keep the status-code fallback above
    }
    throw new Error(reason);
  }

  const data = await res.json();
  return {
    clarifyingQuestions: Array.isArray(data.clarifyingQuestions) ? data.clarifyingQuestions : [],
    widgets: Array.isArray(data.widgets) ? data.widgets : [],
    summary: typeof data.summary === "string" ? data.summary : "",
  };
}
