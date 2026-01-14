"use client";

import { useEffect, useRef, useState } from "react";

export type VoiceInputProps = {
  onChangeText?: (text: string) => void;
  onText?: (text: string) => void;
};

// ---- Web Speech API ----
const getSRClass = () => {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
};

// モジュール全体で共有する recognition（親から強制停止したいので）
let activeRecognition: any = null;

// 親コンポーネント用の「確実にマイク停止」API
export function stopMic() {
  try {
    if (activeRecognition) {
      // ★「これは人間の意図的な停止だよ」という印を付ける
      (activeRecognition as any)._manualStop = true;
      activeRecognition.stop();
    }
  } catch {
    // 失敗しても無視
  }
}

export default function VoiceInput({ onChangeText, onText }: VoiceInputProps) {
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef<any | null>(null);

  // ★ この質問内での「最後に確定した全文」
  const fullFinalRef = useRef<string>("");

  // ---- 音声開始 ----
  const start = () => {
    const SR = getSRClass();
    if (!SR) {
      alert("このブラウザは音声入力に対応していません。");
      return;
    }

    const recognition = new SR();
    recognition.lang = "ja-JP";
    recognition.interimResults = false;   // ★ 中間結果は破棄 → 精度向上
    recognition.continuous = true;

    recognition.onresult = (e: any) => {
      let finalText = "";

      // ★ final（isFinal）のみ採用：精度が最も高い
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript;
        }
      }

      finalText = finalText.trim();
      if (!finalText) return;

      const prevFull = fullFinalRef.current || "";

      // 同じ全文が来たらスキップ
      if (prevFull === finalText) return;

      // 差分 delta
      let delta = "";
      if (finalText.startsWith(prevFull)) {
        delta = finalText.slice(prevFull.length).trim();
      } else {
        // ざっくり共通プレフィックスを探す
        let i = 0;
        const len = Math.min(finalText.length, prevFull.length);
        while (i < len && finalText[i] === prevFull[i]) i++;
        delta = finalText.slice(i).trim();
      }

      if (!delta) {
        fullFinalRef.current = finalText;
        return;
      }

      fullFinalRef.current = finalText;

      onChangeText?.(delta);
      onText?.(delta);
    };

    recognition.onerror = () => setListening(false);

recognition.onend = () => {
  // ★ 手動停止（stopMic 経由）の場合は、ここで完全停止
  if ((recognition as any)._manualStop) {
    (recognition as any)._manualStop = false; // フラグリセット

    setListening(false);
    if (activeRecognition === recognition) {
      activeRecognition = null;
    }
    if (recognitionRef.current === recognition) {
      recognitionRef.current = null;
    }
    return;
  }

  // ★ それ以外 → ブラウザ側が勝手に切ったとみなし、自動再スタート
  //   （コンポーネントがまだ生きているときだけ）
  if (recognitionRef.current === recognition) {
    try {
      recognition.start();
      // activeRecognition は同じ recognition のままでOK
    } catch (err) {
      console.warn("SpeechRecognition auto-restart failed:", err);
      setListening(false);
      if (activeRecognition === recognition) {
        activeRecognition = null;
      }
      recognitionRef.current = null;
    }
  }
};

    recognitionRef.current = recognition;
    activeRecognition = recognition;

    recognition.start();
    setListening(true);
  };

  // ---- 停止 ----
  const stop = () => {
    stopMic();
    setListening(false);
  };

  // ---- unmount ----
  useEffect(() => {
    return () => stopMic();
  }, []);

  return (
    <div className="flex flex-col items-start gap-1">
      <p className="mb-1 text-[11px] text-slate-500">
        テキスト入力 / 音声入力が利用できます。
      </p>

      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        className={`w-1/2 max-w-[160px] rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm border
          ${
            listening
              ? "bg-red-100 border-red-400 text-red-700"
              : "bg-sky-100 border-sky-300 text-sky-800"
          }`}
      >
        {listening ? "音声入力停止" : "音声入力開始"}
      </button>
    </div>
  );
}
