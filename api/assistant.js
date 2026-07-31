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
// for the current numbers): "gemini-2.5-flash" below is comfortably enough
// for a small team asking occasional questions. If you ever hit the daily
// cap, "gemini-2.5-flash-lite" has an even higher free daily limit at
// slightly lower quality — just change the `model` value below.
//
// One tradeoff to know about: on the free tier, Google's terms allow using
// your prompts/responses to improve their models (this doesn't apply once
// billing is enabled on the project, or on Vertex AI). For an internal
// inventory-accounting tool this is usually a non-issue, but keep it in
// mind if the sample data sent here ever includes anything sensitive.
//
// If you deploy on Netlify instead, move this into /netlify/functions/assistant.js
// and adapt the export to Netlify's (event) => {...} handler signature.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not set in this project's environment variables." });
  }

  const { question, departmentName, columns, sampleRows, totalRows } = req.body;

  const prompt = `You are a helpful data analyst assistant embedded in a team dashboard.
Department: ${departmentName}
Columns: ${columns.join(", ")}
Total rows: ${totalRows} (showing a sample of ${sampleRows.length} below)
Sample data (JSON): ${JSON.stringify(sampleRows)}

Answer the user's question clearly and concisely. If relevant, suggest which
chart type (bar/line/pie) and which columns would best visualize the answer.

User question: ${question}`;

  const model = "gemini-2.5-flash";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 700 },
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

    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "I couldn't generate a response.";
    return res.status(200).json({ answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Assistant request failed" });
  }
}
