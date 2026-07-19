import { X } from "lucide-react";
import type { SheetTab } from "../lib/googleDrive";

interface Props {
  fileName: string;
  tabs: SheetTab[];
  onPick: (tabTitle: string) => void;
  onClose: () => void;
}

export function SheetTabPicker({ fileName, tabs, onPick, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm">Which tab?</h3>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-h)]">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-[var(--text-dim)] mb-4 truncate">{fileName}</p>

        <div className="space-y-1 max-h-72 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.sheetId}
              onClick={() => onPick(tab.title)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-[var(--text)] hover:bg-[var(--accent-dim)] hover:border-[var(--accent-border)] border border-transparent"
            >
              {tab.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
