import { Link2, FolderOpen, FileSpreadsheet } from "lucide-react";
import type { Department } from "../types";

interface Props {
  departments: Department[];
}

function sourceLabel(sourceType: string | undefined) {
  switch (sourceType) {
    case "drive": return { label: "Google Drive", icon: FolderOpen };
    case "csv-link": return { label: "Pasted link", icon: Link2 };
    default: return { label: "Uploaded file / sample data", icon: FileSpreadsheet };
  }
}

export function DataSourcesView({ departments }: Props) {
  return (
    <div className="p-6">
      <h1 className="text-lg mb-1">Data Sources</h1>
      <p className="text-xs text-[var(--text-dim)] mb-5">
        Where every team's page is pulling its data from.
      </p>

      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wide text-[var(--text-dim)]">Team</th>
              <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wide text-[var(--text-dim)]">Page</th>
              <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wide text-[var(--text-dim)]">Source</th>
              <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wide text-[var(--text-dim)]">Sheet / tab</th>
              <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wide text-[var(--text-dim)]">Last updated</th>
            </tr>
          </thead>
          <tbody>
            {departments.flatMap((dept) =>
              dept.pages.map((page) => {
                const { label, icon: Icon } = sourceLabel(page.sourceType);
                return (
                  <tr key={page.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--panel-raised)]">
                    <td className="px-4 py-2.5 text-[var(--text)]">{dept.name}</td>
                    <td className="px-4 py-2.5 text-[var(--text)]">{page.name}</td>
                    <td className="px-4 py-2.5 text-[var(--text-dim)]">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon size={13} /> {label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text-dim)] max-w-xs truncate">
                      {page.sheetTabTitle ? `${page.sheetTabTitle} — ` : ""}
                      {page.sheetUrl || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text-dim)] whitespace-nowrap">
                      {page.lastUpdated ? new Date(page.lastUpdated).toLocaleString() : "Never"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
