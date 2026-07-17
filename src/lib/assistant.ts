import type { DataRow } from "../types";

interface AskContext {
  departmentName: string;
  rows: DataRow[];
  columns: string[];
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
    throw new Error(`Assistant backend returned ${res.status}`);
  }

  const data = await res.json();
  return data.answer as string;
}
