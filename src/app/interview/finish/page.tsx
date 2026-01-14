// src/app/interview/finish/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { ModeTag } from "@/lib/questions";
import {
  loadPreviousResult,
  saveCurrentResult,
  type InterviewResultSnapshot,
} from "@/lib/history/interviewHistory";

import {
  TITLE_MAP,
  TYPE_ORDER,
  parseFeedbackFromSession,
  type FeedbackItem,
  type FeedbackType,
} from "@/lib/feedback/feedbackSession";

import { checkFeedbackQuality, type FeedbackQuality } from "@/lib/feedback/quality";

// ✅ 追加：react-pdf用ドキュメント
import { InterviewResultPdfDoc } from "./pdf";

type QA = { questionText: string; answerText: string };

const MODE_LABEL: Record<ModeTag, string> = {
  A1: "病院（診療放射線技師）",
  A2: "病院／看護師",
  B: "健診／クリニック",
  C: "企業（医療関連）",
};

export default function FinishPage() {
  const router = useRouter();

  const [mode, setMode] = useState<ModeTag>("A1");
  const [trainedAt, setTrainedAt] = useState<string>("");
  const [answers, setAnswers] = useState<QA[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [prev, setPrev] = useState<InterviewResultSnapshot | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const m = (sessionStorage.getItem("kcareer.session.mode") as ModeTag) || "A1";
    setMode(m);

    const dt = sessionStorage.getItem("kcareer.session.trainedAt");
    const nowIso = new Date().toISOString();
    const iso = dt || nowIso;
    if (!dt) sessionStorage.setItem("kcareer.session.trainedAt", iso);
    setTrainedAt(iso);

    const rawAnswers = sessionStorage.getItem("kcareer.session.answers");
    const qa: QA[] = rawAnswers ? safeJson<QA[]>(rawAnswers, []) : [];
    setAnswers(qa);

    const rawFb = sessionStorage.getItem("kcareer.session.feedback");
    setFeedbackItems(parseFeedbackFromSession(rawFb));

    try {
      sessionStorage.removeItem("kcareer.session.radarScores");
    } catch {}

    const previous = loadPreviousResult(m);
    setPrev(previous);

    const snapshot: InterviewResultSnapshot = {
      savedAt: nowIso,
      mode: m,
      scores: {},
      feedback: rawFb || "",
      answers: qa,
    };
    saveCurrentResult(snapshot);
  }, []);

  const orderedFeedback: FeedbackItem[] = useMemo(() => {
    const map = new Map<FeedbackType, FeedbackItem>();
    for (const it of feedbackItems) map.set(it.type, it);

    return TYPE_ORDER
      .map((t: FeedbackType): FeedbackItem | undefined => map.get(t))
      .filter((v: FeedbackItem | undefined): v is FeedbackItem => v !== undefined);
  }, [feedbackItems]);

  const qualityByType: Partial<Record<FeedbackType, FeedbackQuality>> = useMemo(() => {
    const out: Partial<Record<FeedbackType, FeedbackQuality>> = {};
    for (const item of orderedFeedback) {
      out[item.type] = checkFeedbackQuality(item.text);
    }
    return out;
  }, [orderedFeedback]);

  // ✅ A案：テキストPDFで出力（途中で切れない・検索可）
  const exportPdfAndBack = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportMsg("PDFを作成中…");

    try {
      // ブラウザ版 react-pdf の pdf() を動的 import（Next/webpackの相性対策）
      const mod = await import("@react-pdf/renderer");
      const { pdf } = mod;

      const doc = (
        <InterviewResultPdfDoc
          mode={mode}
          trainedAt={trainedAt}
          answers={answers}
          orderedFeedback={orderedFeedback}
          qualityByType={qualityByType as any}
        />
      );

      const blob = await pdf(doc).toBlob();

      const fileName = `面接トレーニング結果_${mode}_${formatDateForFile(trainedAt)}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setExportMsg("PDFを保存しました。モード選択へ戻ります…");
      router.push("/start");
    } catch (e) {
      console.error(e);
      setExportMsg("PDF作成に失敗しました。もう一度お試しください。");
      setIsExporting(false);
      return;
    }
  };

  return (
    <main className="h-[100svh] overflow-y-auto w-full bg-[#0b1f3a] flex justify-center">
      <div className="mx-auto w-full max-w-[430px] px-4 pb-10 pt-6">
        <div className="rounded-2xl bg-[#0b1f3a]">
          <header className="mb-4 text-center">
            <h1 className="text-xl font-bold text-white drop-shadow">面接トレーニング結果</h1>
            <p className="text-[12px] text-white/90 drop-shadow">Dialogue Trainer for Med. Interview</p>
            <p className="mt-1 text-[12px] text-white/90 drop-shadow">
              モード: {MODE_LABEL[mode]} ／ 回答内容とフィードバックの確認です。
            </p>
            <p className="mt-1 text-[11px] text-white/80">実施日時：{formatDateJP(trainedAt)}</p>

            {exportMsg && (
              <p className="mt-2 text-[11px] font-bold text-emerald-200">
                {exportMsg}
              </p>
            )}
          </header>

          <section className="mb-4 rounded-2xl bg-white/95 shadow-md px-3 py-3">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">回答内容</h2>

            <div className="space-y-3">
              {answers.map((a: QA, idx: number) => (
                <div key={idx} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-slate-800">
                    Q{idx + 1}. {a.questionText}
                  </p>
                  <p className="mt-1 text-[11px] whitespace-pre-wrap text-slate-700 leading-relaxed">
                    {a.answerText}
                  </p>
                </div>
              ))}
              {answers.length === 0 && (
                <p className="text-[11px] text-slate-600">（回答データが見つかりません）</p>
              )}
            </div>
          </section>

          <section className="mb-4 rounded-2xl bg-white shadow-md px-3 py-3">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">フィードバック（専門家の視点）</h2>

            {orderedFeedback.length === 0 ? (
              <p className="text-[11px] text-slate-600">（フィードバックがありません）</p>
            ) : (
              <div className="space-y-3">
                {orderedFeedback.map((item: FeedbackItem) => {
                  const q = qualityByType[item.type];
                  const showWarn = q ? !q.ok : false;

                  return (
                    <div key={item.type} className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[12px] font-extrabold text-slate-800">
                        【{TITLE_MAP[item.type]}】
                      </p>

                      {showWarn && q && (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2">
                          <p className="text-[10px] font-bold text-amber-800">
                            ※フィードバック品質チェック：要改善
                          </p>
                          <ul className="mt-1 list-disc pl-4 text-[10px] text-amber-800 space-y-0.5">
                            {q.issues.map((s: string, i: number) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <p className="mt-2 text-[11px] whitespace-pre-wrap leading-relaxed text-slate-800">
                        {item.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ボタンは「全文読んだ後に押す」設計のまま下に置く */}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/start")}
            disabled={isExporting}
            className="w-1/2 rounded-2xl bg-white/90 px-4 py-3 text-center text-sm font-semibold text-slate-800 shadow-md hover:bg-white disabled:opacity-60"
          >
            最初の画面に戻る
          </button>

          <button
            type="button"
            onClick={exportPdfAndBack}
            disabled={isExporting}
            className="w-1/2 rounded-2xl bg-emerald-200 px-4 py-3 text-center text-sm font-semibold text-emerald-900 shadow-md hover:bg-emerald-300 disabled:opacity-60"
          >
            {isExporting ? "PDF作成中…" : "PDFで出力して最初の画面に戻る"}
          </button>
        </div>
      </div>
    </main>
  );
}

function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function formatDateJP(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDateForFile(iso: string) {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(
      d.getMinutes()
    )}`;
  } catch {
    return "unknown";
  }
}
