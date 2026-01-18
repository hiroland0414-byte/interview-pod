// src/app/impression/start/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearImpressionSession, saveImpressionSession } from "@/lib/impression/session";

export default function ImpressionStartPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("自己紹介（30〜60秒）");

  useEffect(() => {
    // 印象アップ用セッションを初期化
    clearImpressionSession();
    saveImpressionSession({
      topic,
      durationSec: 60, // 最大60秒で固定
      savedAt: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    saveImpressionSession({
      topic,
      durationSec: 60,
      savedAt: new Date().toISOString(),
    });
    router.push("/impression");
  };

  return (
    <main className="min-h-[100svh] bg-[#0b1f3a] flex justify-center">
      <div className="w-full max-w-[430px] px-4 pt-6 pb-10 text-white">
        <h1 className="text-xl font-extrabold text-center drop-shadow">印象力アップモード</h1>
        <p className="text-[12px] text-center text-white/85 mt-1">Nonverbal & Delivery Booster</p>

        <section className="mt-6 rounded-2xl bg-white/10 border border-white/15 p-4">
          <label className="block text-[12px] font-bold text-white/90">テーマ</label>
          <input
            className="mt-2 w-full rounded-xl bg-white/90 text-slate-900 px-3 py-2 text-[14px] font-semibold"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例：自己紹介（30〜60秒）"
          />

          <div className="mt-5 text-[12px] leading-relaxed text-white/85 space-y-2">
            <p>・スタート後、<b>5秒カウントダウン</b>してから録画を開始します。</p>
            <p>・録画時間は<b>最大60秒</b>です。</p>
            <p>・正確にフィードバックするため、<b>30秒以上は話してください</b>。</p>
            <p>・話の内容は評価対象ではありません（挨拶などの丁寧さは参考にします）。</p>
            <p>・終了ボタンは、録画開始から<b>30秒経過後</b>に押せます。</p>
            <p>・無音／顔未検出が多い場合は「<b>データ不足</b>」となります。</p>
          </div>
        </section>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/start")}
            className="w-1/2 rounded-2xl bg-white/90 px-4 py-3 text-slate-900 font-bold shadow"
          >
            メニューへ戻る
          </button>
          <button
            type="button"
            onClick={start}
            className="w-1/2 rounded-2xl bg-sky-300 px-4 py-3 text-slate-900 font-extrabold shadow"
          >
            はじめる
          </button>
        </div>
      </div>
    </main>
  );
}
