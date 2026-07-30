// EXAMPLE serverless function for Vercel.
//
// Setup:
//   1. Rename this file to `assistant.js` (Vercel auto-detects files in /api).
//   2. In your Vercel project settings, add an environment variable:
//        ANTHROPIC_API_KEY = sk-ant-...
//      Get one at console.anthropic.com — Settings → API Keys. Note this is
//      a separate, pay-as-you-go API account from a normal claude.ai
//      subscription; it bills per request (Claude Sonnet is inexpensive for
//      short answers like this, but it isn't included with a claude.ai plan).
//   3. Deploy. The frontend already calls POST /api/assistant.
//
// If you deploy on Netlify instead, move this into /netlify/functions/assistant.js
// and adapt the export to Netlify's (event) => {...} handler signature.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set in this project's environment variables." });
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

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Surface the real reason (bad key, no credit, rate limit, ...)
      // instead of a generic "couldn't generate a response" that hides it.
      console.error("Anthropic API error:", data);
      return res.status(response.status).json({ error: data.error?.message ?? "Anthropic API request failed." });
    }

    const answer = data.content?.[0]?.text ?? "I couldn't generate a response.";
    return res.status(200).json({ answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Assistant request failed" });
  }
}
