import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
  onCreate: (name: string) => void;
}

export function AddDepartmentModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm">New department page</h3>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-h)]">
            <X size={16} />
          </button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Marketing, Operations..."
          className="w-full bg-[var(--panel-raised)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent-border)] mb-4"
        />
        <button
          onClick={() => name.trim() && onCreate(name.trim())}
          className="w-full bg-[var(--accent)] text-[#1c1305] font-medium rounded-lg py-2 text-sm hover:opacity-90"
        >
          Create page
        </button>
      </div>
    </div>
  );
}
