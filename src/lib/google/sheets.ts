import { google } from "googleapis";

function getAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
  return auth;
}

export async function getSheetData(spreadsheetId: string, range: string) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = response.data.values || [];
  if (rows.length === 0) return { headers: [], data: [] };

  const headers = rows[0];
  const data = rows.slice(1).map((row, index) => {
    const obj: Record<string, any> = { _id: index };
    headers.forEach((header, i) => {
      const value = row[i] || "";
      // Try to parse numbers
      const numValue = parseFloat(value.replace(/,/g, ""));
      obj[header] = isNaN(numValue) || value === "" ? value : numValue;
    });
    return obj;
  });

  return { headers, data };
}

export async function getSheetInfo(spreadsheetId: string) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "properties(title,locale),sheets(properties(title,gridProperties))",
  });

  return response.data;
}
