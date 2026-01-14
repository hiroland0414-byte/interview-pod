"use client";

import { useEffect, useRef, useState } from "react";

export default function RecorderBar({ onTranscript }: { onTranscript: (t: string)=>void }) {
  const [recording, setRecording] = useState(false);
  const ref = useRef<any>(null);

  const start = () => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { alert("このブラウザでは音声入力が利用できません。"); return; }
    const r = new SR();
    r.lang = "ja-JP"; r.continuous = true; r.interimResults = true;
    r.onresult = (e: any) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
      onTranscript(t);
    };
    r.onerror = () => {};
    r.onend = () => {}; // 自動停止しない
    ref.current = r; r.start(); setRecording(true);
  };

  const stop = () => { try { ref.current?.stop(); } catch {} setRecording(false); };

  useEffect(() => () => stop(), []);

  return (
    <button
      onClick={() => (recording ? stop() : start())}
      className={`w-14 h-14 rounded-full flex items-center justify-center transition
        ${recording ? "bg-rose-200" : "bg-sky-200"} hover:opacity-85 active:scale-95`}
      title={recording ? "録音停止" : "録音開始"}
      aria-label={recording ? "録音停止" : "録音開始"}
    >
      {/* 通常：マイク、録音中：■（シンプル） */}
      {recording ? (
        <svg width="24" height="24"><rect x="7" y="7" width="10" height="10" rx="2" fill="#333"/></svg>
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" stroke="#333" fill="none" strokeWidth="2">
          <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11v1a7 7 0 0 0 14 0v-1M12 19v3m-4 0h8"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );
}
