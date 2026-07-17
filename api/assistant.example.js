// EXAMPLE serverless function for Vercel.
//
// Setup:
//   1. Rename this file to `assistant.js` (Vercel auto-detects files in /api).
//   2. In your Vercel project settings, add an environment variable:
//        ANTHROPIC_API_KEY = sk-ant-...   (get one at console.anthropic.com)
//   3. Deploy. The frontend already calls POST /api/assistant.
//
// If you deploy on Netlify instead, move this into /netlify/functions/assistant.js
// and adapt the export to Netlify's (event) => {...} handler signature.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const answer = data.content?.[0]?.text ?? "I couldn't generate a response.";
    return res.status(200).json({ answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Assistant request failed" });
  }
}
