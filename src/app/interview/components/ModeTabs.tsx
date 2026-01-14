"use client";

import { useInputMode, InputMode } from "../InputModeContext";

export default function ModeTabs() {
  const { mode, setMode } = useInputMode();

  const Tab = ({ id, label }: { id: InputMode; label: string }) => {
    const active = mode === id;
    return (
      <button
        type="button"
        onClick={() => setMode(id)}
        className={`px-4 py-1 rounded-full text-sm transition
          ${active ? "bg-sky-200 text-slate-900 shadow"
                   : "bg-white text-slate-600 hover:bg-sky-50"}`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-2 py-1">
      <Tab id="text" label="テキスト" />
      <Tab id="voice" label="音声" />
    </div>
  );
}
