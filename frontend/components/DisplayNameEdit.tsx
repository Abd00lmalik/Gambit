"use client";

import { useState } from "react";

interface DisplayNameEditProps {
  currentName?: string | null;
  address: string;
  onSaved?: (name: string) => void;
}

export default function DisplayNameEdit({
  currentName,
  address,
  onSaved,
}: DisplayNameEditProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentName || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, display_name: value }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }

      setEditing(false);
      onSaved?.(data.display_name);
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setValue(currentName || "");
      setEditing(false);
      setError(null);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="font-body text-xs text-gray-500 hover:text-teal transition-colors cursor-pointer underline underline-offset-2 decoration-dotted"
      >
        Edit name
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={30}
        placeholder="Your name..."
        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 font-body text-sm text-foam focus:outline-none focus:border-teal/50 w-48"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-3 py-1.5 rounded-lg bg-teal text-carbon font-body text-xs font-bold hover:bg-teal-light transition-colors disabled:opacity-50 cursor-pointer"
      >
        {saving ? "..." : "Save"}
      </button>
      <button
        onClick={() => {
          setValue(currentName || "");
          setEditing(false);
          setError(null);
        }}
        className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 font-body text-xs hover:bg-white/10 transition-colors cursor-pointer"
      >
        Cancel
      </button>
      {error && (
        <p className="font-body text-[10px] text-down">{error}</p>
      )}
    </div>
  );
}
