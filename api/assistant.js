// EXAMPLE serverless function for Vercel — uses Google's Gemini API, which
// has a genuinely free tier (no credit card required, unlike Anthropic's
// API which is pay-as-you-go with no permanent free tier). Good fit for a
// small internal team's usage.
//
// Setup:
//   1. Rename this file to `assistant.js` (Vercel auto-detects files in /api).
//   2. Go to https://aistudio.google.com/apikey (Google AI Studio), sign in
//      with any Google account, and click "Create API key." No credit card,
//      no billing setup needed for the free tier.
//   3. In Vercel → Settings → Environment Variables, add:
//        GEMINI_API_KEY = the key you just copied
//   4. Deploy. The frontend already calls POST /api/assistant — nothing
//      else to change there.
//
// Free-tier limits (Google can change these — check https://ai.google.dev/gemini-api/docs/rate-limits
// for the current numbers): "gemini-3.5-flash-lite" below is comfortably
// enough for a small team asking occasional questions, and has Google's
// highest free daily quota in the current lineup. If you want noticeably
// smarter answers at the cost of a lower daily cap, "gemini-3.5-flash" is
// the step up — just change the `model` value below.
//
// Note (Aug 2026): Google has been retiring gemini-2.5-* models for new
// API keys well ahead of their listed shutdown dates (they start returning
// "model ... is no longer available to new users" 404s) — so this project
// intentionally pins to the 3.5 family instead of 2.5. If this ever breaks
// again, check https://ai.google.dev/gemini-api/docs/models for the
// current model list and swap the string below; nothing else in this file
// needs to change.
//
// One tradeoff to know about: on the free tier, Google's terms allow using
// your prompts/responses to improve their models (this doesn't apply once
// billing is enabled on the project, or on Vertex AI). For an internal
// inventory-accounting tool this is usually a non-issue, but keep it in
// mind if the sample data sent here ever includes anything sensitive.
//
// If you deploy on Netlify instead, move this into /netlify/functions/assistant.js
// and adapt the export to Netlify's (event) => {...} handler signature.

// "Auto-build dashboard" (mode: "auto-build") reuses this same endpoint and
// key, but asks Gemini to return a strict JSON build plan instead of free
// text — see buildAutoBuildPrompt below for the exact schema. Two-turn flow:
//   1. First call (no `clarification`): the model either returns a full
//      widget plan, or — only when a column name is genuinely ambiguous —
//      an empty `widgets` array plus 1+ `clarifyingQuestions` in Egyptian
//      Arabic and nothing gets built yet.
//   2. If step 1 asked questions, the frontend collects the person's answer
//      and calls again with `clarification` filled in; the model then
//      returns the real plan, taking those answers into account.
// The frontend (src/lib/assistant.ts → autoBuildDashboard) turns the
// returned widget specs into real Chart/Pivot/Matrix/Card/Text configs.
function buildAutoBuildPrompt({ departmentName, columns, sampleRows, totalRows, clarification }) {
  const clarificationBlock =
    Array.isArray(clarification) && clarification.length > 0
      ? `\nThe user already answered these clarifying questions from a previous turn:\n${clarification
          .map((c) => `Q: ${c.question}\nA: ${c.answer}`)
          .join("\n")}\nUse these answers now. Do not ask about the same columns again — build the full dashboard this time, using or skipping those columns based on what the user just told you.`
      : "";

  return `You are a data analyst assistant that designs a dashboard for a business inventory-accounting tool called "${departmentName}".

Columns available (use the EXACT spelling given, nothing else): ${columns.join(", ")}
Total rows: ${totalRows} (sample of ${sampleRows.length} rows below, JSON):
${JSON.stringify(sampleRows)}
${clarificationBlock}

Your job: propose a small, USEFUL dashboard (4 to 8 widgets) built ONLY from the columns listed above. Prefer a mix: at least one Card (a key total/KPI) and one or two Charts are usually right; add a Pivot table when grouping by a category makes sense; only add a Matrix when there are genuinely two useful grouping dimensions at once; only add a Text widget if there's a genuinely useful note to add (rare).

If — and only if — a column's name is genuinely ambiguous (an unclear abbreviation, a generic code like "Col_7" or "Field3", or a name that could plausibly mean two very different business things) and you cannot confidently decide whether/how to use it, add ONE short, specific clarifying question about it — in Egyptian Arabic dialect — to "clarifyingQuestions", and leave "widgets" completely empty this turn. Do NOT ask about ordinary, self-explanatory business columns (Date, Quantity, Product, Price, Warehouse, SKU, etc.) — only genuinely unclear ones. If nothing is ambiguous, return an empty "clarifyingQuestions" array and build the full plan right away.

Respond with ONLY valid JSON (no markdown fences, no commentary outside the JSON), matching exactly this shape:
{
  "clarifyingQuestions": string[],
  "widgets": [
    { "kind": "card", "title": string, "valueColumn": string, "agg": "sum" | "avg" | "count" | "max" | "min" | "distinct" },
    { "kind": "chart", "title": string, "chartType": "bar" | "line" | "area" | "pie" | "scatter" | "radar" | "treemap", "xColumn": string, "yColumn": string },
    { "kind": "pivot", "title": string, "groupColumns": string[], "valueColumn": string, "agg": "sum" | "avg" | "count" | "max" | "min" | "distinct" },
    { "kind": "matrix", "title": string, "rowColumn": string, "colColumn": string, "valueColumn": string, "agg": "sum" | "avg" | "count" | "max" | "min" | "distinct" },
    { "kind": "text", "title": string, "body": string }
  ],
  "summary": string
}

Each entry in "widgets" must be one of exactly those five shapes (only include the fields that shape needs). "summary" must be written in Egyptian Arabic dialect, 3-6 sentences: explain what you built and why each part is useful for someone tracking this specific data, and explicitly mention any column(s) you skipped because their meaning wasn't clear (referencing the matching clarifying question). If "clarifyingQuestions" is non-empty, leave "widgets" as an empty array and "summary" as an empty string — the real plan comes on the next turn once the user answers.`;
}

/** Best-effort JSON parse: Gemini's JSON mode should already return clean
 *  JSON, but this strips accidental ```json fences just in case a model
 *  update ever adds them back, rather than hard-failing on that alone. */
function parseJsonLoose(text) {
  if (!text) return null;
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not set in this project's environment variables." });
  }

  const { question, departmentName, columns, sampleRows, totalRows, mode, clarification } = req.body;
  const isAutoBuild = mode === "auto-build";

  const prompt = isAutoBuild
    ? buildAutoBuildPrompt({ departmentName, columns, sampleRows, totalRows, clarification })
    : `You are a helpful data analyst assistant embedded in a team dashboard.
Department: ${departmentName}
Columns: ${columns.join(", ")}
Total rows: ${totalRows} (showing a sample of ${sampleRows.length} below)
Sample data (JSON): ${JSON.stringify(sampleRows)}

Answer the user's question clearly and concisely. If relevant, suggest which
chart type (bar/line/pie) and which columns would best visualize the answer.

User question: ${question}`;

  const model = "gemini-3.5-flash-lite";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: isAutoBuild
            ? { maxOutputTokens: 1500, responseMimeType: "application/json" }
            : { maxOutputTokens: 700 },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Surface the real reason (bad key, rate limit, model name typo, ...)
      // instead of a generic "couldn't generate a response" that hides it.
      console.error("Gemini API error:", data);
      return res.status(response.status).json({ error: data.error?.message ?? "Gemini API request failed." });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (isAutoBuild) {
      const parsed = parseJsonLoose(text);
      if (!parsed) {
        console.error("Auto-build: Gemini response wasn't valid JSON:", text);
        return res.status(502).json({ error: "AI didn't return a usable plan — try again." });
      }
      return res.status(200).json({
        clarifyingQuestions: Array.isArray(parsed.clarifyingQuestions) ? parsed.clarifyingQuestions : [],
        widgets: Array.isArray(parsed.widgets) ? parsed.widgets : [],
        summary: typeof parsed.summary === "string" ? parsed.summary : "",
      });
    }

    return res.status(200).json({ answer: text || "I couldn't generate a response." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Assistant request failed" });
  }
}
