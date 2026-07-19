import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { getSheetData, getSheetInfo } from "@/lib/google/sheets";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const spreadsheetId = searchParams.get("spreadsheetId");
  const range = searchParams.get("range") || "Sheet1";
  const action = searchParams.get("action") || "data";

  if (!spreadsheetId) {
    return NextResponse.json({ error: "spreadsheetId is required" }, { status: 400 });
  }

  try {
    if (action === "info") {
      const info = await getSheetInfo(spreadsheetId);
      return NextResponse.json({ info });
    }

    const data = await getSheetData(spreadsheetId, range);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Google Sheets API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch sheet data" },
      { status: 500 }
    );
  }
}
