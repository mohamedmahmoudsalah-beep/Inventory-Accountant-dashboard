import { google } from "googleapis";

function getAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return auth;
}

export async function listFiles(folderId?: string, query?: string) {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  let q = "mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='text/csv'";
  if (folderId) {
    q += ` and '${folderId}' in parents`;
  }
  if (query) {
    q += ` and name contains '${query}'`;
  }

  const response = await drive.files.list({
    q,
    fields: "files(id, name, mimeType, modifiedTime, size, webViewLink)",
    orderBy: "modifiedTime desc",
    pageSize: 100,
  });

  return response.data.files || [];
}

export async function listFolders(parentId?: string) {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  let q = "mimeType='application/vnd.google-apps.folder' and trashed=false";
  if (parentId) {
    q += ` and '${parentId}' in parents`;
  }

  const response = await drive.files.list({
    q,
    fields: "files(id, name, modifiedTime)",
    orderBy: "name",
    pageSize: 100,
  });

  return response.data.files || [];
}
