// src/lib/speech/engine.ts

export type TextHandler = (text: string) => void;
export type STTStopFn = () => void;

export type STTOptions = {
  lang?: string;   // 例: "ja-JP"
  interim?: boolean;
};

// Web Speech API 版（現在の本番エンジン）
export function startSTTWebSpeech(
  onText: TextHandler,
  opts: STTOptions = {}
): STTStopFn {
  if (typeof window === "undefined") return () => {};

  const W = window as any;
  const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
  if (!SR) {
    console.warn("SpeechRecognition not supported in this browser.");
    return () => {};
  }

  const rec = new SR();
  rec.lang = opts.lang || "ja-JP";
  rec.interimResults = !!opts.interim;
  rec.continuous = true;

  // ★ ここを any にして型エラー回避
  rec.onresult = (ev: any) => {
    let buf = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) {
        buf += r[0].transcript;
      }
    }
    if (buf) onText(buf);
  };

  rec.onerror = (e: any) => {
    console.warn("WebSpeech error:", e);
  };

  rec.start();

  return () => {
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  };
}

// 将来の whisper.cpp 用の窓口（今はダミー実装）
export async function startSTTWhisper(
  _onText: TextHandler,
  _opts: STTOptions = {}
): Promise<STTStopFn> {
  console.warn("whisper.cpp STT is not implemented yet.");
  return () => {};
}
