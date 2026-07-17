import { google } from 'googleapis';

export default async function handler(req, res) {
  // تفعيل الـ CORS عشان الـ Frontend يعرف يكلم الـ API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { folderId } = req.query;

  if (!folderId) {
    return res.status(400).json({ success: false, error: 'Folder ID is required' });
  }

  try {
    // هتحط بيانات الـ Service Account بتاعك في الـ Environment Variables على Vercel للأمان
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly'
      ],
    });

    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. جلب كل الشيتات جوه الفولدر
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet'`,
      fields: 'files(id, name)',
    });

    const files = response.data.files;
    let combinedData = [];

    // 2. دمج البيانات من كل الشيتات
    for (const file of files) {
      const sheetData = await sheets.spreadsheets.values.get({
        spreadsheetId: file.id,
        range: 'Sheet1!A1:Z', 
      });

      const rows = sheetData.data.values;
      if (rows && rows.length > 0) {
        const headers = rows[0];
        const dataRows = rows.slice(1).map(row => {
          let rowData = { sourceFile: file.name };
          headers.forEach((header, index) => {
            rowData[header] = row[index] || '';
          });
          return rowData;
        });
        combinedData = combinedData.concat(dataRows);
      }
    }

    return res.status(200).json({ success: true, data: combinedData });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
