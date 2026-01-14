// src/app/feedback/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateFeedback,
  type ModeTag,
  type QAItem,
} from "@/lib/feedback/generate";

type FeedbackState = {
  mode: ModeTag | null;
  qa: QAItem[];
};

export default function FeedbackPage() {
  const router = useRouter();
  const [state, setState] = useState<FeedbackState>({ mode: null, qa: [] });
  const [loading, setLoading] = useState(true);
  const [good, setGood] = useState("");
  const [improve, setImprove] = useState("");
  const [next, setNext] = useState("");

  // 初期ロード：セッションから mode と Q&A を取得
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;

      const modeRaw = sessionStorage.getItem("kcareer.session.mode") as
        | ModeTag
        | null;
      const qaRaw = sessionStorage.getItem("kcareer.session.interviewQA");

      let qa: QAItem[] = [];
      if (qaRaw) {
        const parsed = JSON.parse(qaRaw) as QAItem[];
        if (Array.isArray(parsed)) {
          qa = parsed;
        }
      }

      if (!modeRaw || qa.length === 0) {
        // データがなければトップへ案内
        setState({ mode: null, qa: [] });
        setLoading(false);
        return;
      }

      const fb = generateFeedback(modeRaw, qa);
      setState({ mode: modeRaw, qa });
      setGood(fb.good);
      setImprove(fb.improve);
      setNext(fb.next);
    } catch (e) {
      console.error("failed to load feedback source:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleBackHome = () => {
    router.push("/mode"); // 最初のモード選択画面
  };

  const handleSavePdf = () => {
    // ★ 今は PDF 生成は未実装：ここで jsPDF 等につなぐ想定
    //   → ひとまず保存完了扱いでモード選択画面へ戻す
    alert("PDF保存機能は次のステップで実装します。\n今回はフィードバックのみの表示です。");
    router.push("/mode");
  };

  const roleLabel =
    state.mode === "A1"
      ? "病院（診療放射線技師長）の立場からのフィードバック"
      : state.mode === "A2"
      ? "病院（看護師長）の立場からのフィードバック"
      : state.mode === "B"
      ? "健診・クリニック責任者の立場からのフィードバック"
      : state.mode === "C"
      ? "医療関連企業の採用担当の立場からのフィードバック"
      : "面接官の立場からのフィードバック";

  if (loading) {
    return (
      <main className="h-[100svh] overflow-hidden flex items-center justify-center bg-sky-50">
        <div className="text-sm text-slate-600">フィードバックを生成中です…</div>
      </main>
    );
  }

  // データがない場合
  if (!state.mode || state.qa.length === 0) {
    return (
      <main className="h-[100svh] overflow-hidden flex items-center justify-center bg-sky-50">
        <div className="max-w-[360px] rounded-2xl bg-white p-4 shadow">
          <p className="text-sm text-slate-700 mb-3">
            面接の回答データが見つかりませんでした。
          </p>
          <button
            type="button"
            onClick={handleBackHome}
            className="w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
          >
            最初の画面に戻る
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      className="h-[100svh] overflow-hidden w-full bg-cover bg-center"
      style={{ backgroundImage: "url(/default-bg.jpg)" }}
    >
      <div className="mx-auto flex h-[100svh] overflow-hidden max-w-[430px] flex-col items-stretch bg-black/20 px-4 pb-8 pt-8">
        {/* ロゴ & タイトル（1ページ目とトーンを合わせる） */}
        <header className="mb-4 flex flex-col items-center">
          <div className="w-full max-w-[360px] mb-3">
            <div className="relative h-12 w-full">
              <Image
                src="/logo.png"
                alt="Kyoto University of Medical Science"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-[0.2em] text-white drop-shadow">
            医療系
          </h1>
          <h2 className="mt-1 text-xl font-semibold tracking-[0.15em] text-white drop-shadow">
            面接基礎トレーナー
          </h2>
          <p className="mt-1 text-[11px] text-sky-50 drop-shadow">
            Feedback Summary
          </p>
        </header>

        {/* 白カード：フィードバック本体 */}
        <section className="mt-auto rounded-3xl bg-white/95 px-4 pb-5 pt-4 shadow-[0_-6px_20px_rgba(0,0,0,0.25)]">
          <p className="text-xs font-semibold text-slate-600 mb-1">
            {roleLabel}
          </p>

          {/* 良かったところ */}
          <div className="mt-2">
            <h3 className="text-sm font-bold text-emerald-700 mb-1">
              良かったところ（約30%）
            </h3>
            <div className="max-h-28 overflow-y-auto rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-[12px] leading-relaxed text-slate-700">
              {good.split("\n").map((p, i) => (
                <p key={i} className={i > 0 ? "mt-1.5" : ""}>
                  {p}
                </p>
              ))}
            </div>
          </div>

          {/* 改善したいところ */}
          <div className="mt-3">
            <h3 className="text-sm font-bold text-rose-700 mb-1">
              改善したいところ（約40%）
            </h3>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-2 text-[12px] leading-relaxed text-slate-700">
              {improve.split("\n").map((p, i) => (
                <p key={i} className={i > 0 ? "mt-1.5" : ""}>
                  {p}
                </p>
              ))}
            </div>
          </div>

          {/* 次の一手と励まし */}
          <div className="mt-3">
            <h3 className="text-sm font-bold text-sky-700 mb-1">
              次の一手と励まし（約30%）
            </h3>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-sky-100 bg-sky-50/40 px-3 py-2 text-[12px] leading-relaxed text-slate-700">
              {next.split("\n").map((p, i) => (
                <p key={i} className={i > 0 ? "mt-1.5" : ""}>
                  {p}
                </p>
              ))}
            </div>
          </div>

          {/* ボタン群 */}
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSavePdf}
              className="w-full rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700"
            >
              結果を保存（PDF）
            </button>
            <button
              type="button"
              onClick={handleBackHome}
              className="w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              最初の画面に戻る
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
