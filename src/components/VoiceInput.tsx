'use client';
import React, { useEffect, useRef, useState } from 'react';

type Props = { onResult: (text: string) => void };

export default function VoiceInput({ onResult }: Props) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR: any =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;
    if (SR) {
      setSupported(true);
      const rec = new SR();
      rec.lang = 'ja-JP';
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (e: any) => {
        let finalText = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const tr = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += tr;
        }
        if (finalText) onResult(finalText);
      };
      rec.onend = () => setListening(false);
      recRef.current = rec;
    }
  }, [onResult]);

  const start = () => {
    if (!recRef.current) return;
    if (!listening) {
      recRef.current.start();
      setListening(true);
    }
  };

  const stop = () => {
    if (!recRef.current) return;
    recRef.current.stop();
    setListening(false);
  };

  if (!supported) {
    return (
      <div className="text-sm text-gray-500">
        このブラウザは音声入力に対応していません（Chrome/Edge 推奨）
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={start}
        disabled={listening}
        className="px-3 py-2 border rounded disabled:opacity-50"
      >
        🎙 開始
      </button>
      <button
        onClick={stop}
        disabled={!listening}
        className="px-3 py-2 border rounded disabled:opacity-50"
      >
        ■ 停止
      </button>
      <span className="text-sm text-gray-600">
        {listening ? '聞き取り中…' : '待機中'}
      </span>
    </div>
  );
}
