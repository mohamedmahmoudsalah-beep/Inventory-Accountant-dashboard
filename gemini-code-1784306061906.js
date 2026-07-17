// npm install express cors googleapis
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
app.use(cors());
app.use(express.json());

// ملف المفتاح اللي بتنزله من Google Cloud
const SERVICE_ACCOUNT_FILE = './service-account-key.json'; 

const auth = new google.auth.GoogleAuth({
  keyFile: SERVICE_ACCOUNT_FILE,
  scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/spreadsheets.readonly'],
});

app.get('/api/folder-data/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. نجيب كل الشيتات اللي جوه الفولدر
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet'`,
      fields: 'files(id, name)',
    });

    const files = response.data.files;
    let combinedData = [];

    // 2. نقرأ الداتا من كل شيت وندمجهم
    for (const file of files) {
      const sheetData = await sheets.spreadsheets.values.get({
        spreadsheetId: file.id,
        range: 'Sheet1!A1:Z', // عدل النطاق حسب شيتاتك
      });

      const rows = sheetData.data.values;
      if (rows && rows.length > 0) {
        const headers = rows[0];
        const dataRows = rows.slice(1).map(row => {
          let rowData = { sourceFile: file.name }; // إضافة اسم الملف كمصدر
          headers.forEach((header, index) => {
            rowData[header] = row[index] || '';
          });
          return rowData;
        });
        combinedData = combinedData.concat(dataRows);
      }
    }

    res.json({ success: true, data: combinedData });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3001, () => console.log('Server running on port 3001'));