"use client";

import { useState } from "react";
import { X, Link2, Loader2 } from "lucide-react";

export function GoogleSheetsConnector({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [range, setRange] = useState("Sheet1");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/google/sheets?spreadsheetId=${spreadsheetId}&range=${range}`);
      const data = await res.json();
      setPreview(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type: "GOOGLE_SHEETS",
          sourceConfig: JSON.stringify({ spreadsheetId, range }),
          businessUnitId: "default",
        }),
      });
      onSuccess();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Connect Google Sheets</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Dataset Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="My Sales Data"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Spreadsheet ID</label>
            <input
              type="text"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
            />
            <p className="text-xs text-muted-foreground mt-1">Found in the URL between /d/ and /edit</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Sheet Range</label>
            <input
              type="text"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Sheet1!A1:Z1000"
            />
          </div>

          <button
            onClick={handlePreview}
            disabled={loading || !spreadsheetId}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-foreground rounded-xl font-medium hover:bg-accent/80 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Preview Data
          </button>

          {preview && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-accent/50">
                    <tr>
                      {preview.headers?.map((h: string) => (
                        <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.data?.slice(0, 5).map((row: any, i: number) => (
                      <tr key={i}>
                        {preview.headers?.map((h: string) => (
                          <td key={h} className="px-4 py-2 text-foreground">{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-2 text-xs text-muted-foreground bg-accent/30">
                Showing {Math.min(preview.data?.length || 0, 5)} of {preview.data?.length || 0} rows
              </p>
            </div>
          )}

          {preview && (
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Dataset"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
