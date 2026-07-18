import { Trash2 } from "lucide-react";
import type { TextConfig } from "../types";

interface Props {
  config: TextConfig;
  canEdit: boolean;
  onChange: (config: TextConfig) => void;
  onRemove: () => void;
}

export function TextWidget({ config, canEdit, onChange, onRemove }: Props) {
  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        {canEdit ? (
          <input
            value={config.title}
            onChange={(e) => onChange({ ...config, title: e.target.value })}
            className="bg-transparent text-sm font-medium text-[var(--text-h)] outline-none flex-1"
            placeholder="Title (optional)"
          />
        ) : (
          config.title && <h3 className="text-sm">{config.title}</h3>
        )}
        {canEdit && (
          <button onClick={onRemove} title="Remove" className="p-1.5 rounded-md text-[var(--text-dim)] hover:bg-[var(--panel-raised)] hover:text-[var(--bad)]">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {canEdit && (
        <input
          value={config.imageUrl ?? ""}
          onChange={(e) => onChange({ ...config, imageUrl: e.target.value })}
          placeholder="Image URL (optional)"
          className="mb-2 bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs text-[var(--text)] outline-none"
        />
      )}
      {config.imageUrl && (
        <img src={config.imageUrl} alt="" className="w-full rounded-lg mb-2 object-cover max-h-48" />
      )}

      {canEdit ? (
        <textarea
          value={config.body}
          onChange={(e) => onChange({ ...config, body: e.target.value })}
          placeholder="Write a note, context, or instructions for this page..."
          className="flex-1 min-h-24 bg-[var(--panel-raised)] border border-[var(--border)] rounded-md px-2.5 py-2 text-sm text-[var(--text)] outline-none resize-none"
        />
      ) : (
        <p className="text-sm text-[var(--text)] whitespace-pre-wrap">{config.body}</p>
      )}
    </div>
  );
}
