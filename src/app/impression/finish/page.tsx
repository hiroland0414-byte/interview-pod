// src/app/impression/finish/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import {
  loadImpressionSession,
  loadLastSnapshot,
  pushSnapshot,
  type ImpressionSnapshot,
} from "@/lib/impression/session";
import { generateImpressionFeedback } from "@/lib/impression/feedbackLocal";

export default function ImpressionFinishPage() {
  const router = useRouter();
  const pdfRef = useRef<HTMLDivElement | null>(null);

  const [snap, setSnap] = useState<ImpressionSnapshot | null>(null);
  const [prev, setPrev] = useState<ImpressionSnapshot | null>(null);

  useEffect(() => {
    const s = loadImpressionSession();
    const p = loadLastSnapshot();
    setPrev(p);

    const feedback = generateImpressionFeedback({
      topic: s.topic || "自己紹介（30〜60秒）",
      durationSec: s.durationSec || 60,
      answerText: s.answerText || "",
      charsPerMin: s.charsPerMin || 0,
      selfCheck: s.selfCheck as any,
      prev: p ? { charsPerMin: p.charsPerMin, selfCheck: p.selfCheck } : null,
    });

    const now: ImpressionSnapshot = {
      savedAt: s.savedAt || new Date().toISOString(),
      topic: s.topic || "自己紹介（30〜60秒）",
      durationSec: s.durationSec || 60,
      answerText: s.answerText || "",
      charCount: s.charCount || 0,
      charsPerMin: s.charsPerMin || 0,
      selfCheck: s.selfCheck as any,
      feedback,
    };

    setSnap(now);
    pushSnapshot(now);
  }, []);

  const deltaText = useMemo(() => {
    if (!snap || !prev) return "";
    const d = snap.charsPerMin - prev.charsPerMin;
    const sign = d === 0 ? "±0" : d > 0 ? `+${d}` : String(d);
    return `前回比：${prev.charsPerMin} → ${snap.charsPerMin}字/分（${sign}）`;
  }, [snap, prev]);

  const exportPdf = async () => {
    if (!pdfRef.current || !snap) return;

    const canvas = await html2canvas(pdfRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#0b1f3a",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    let y = 0;
    if (imgH <= pageH) {
      pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH);
    } else {
      let remaining = imgH;
      while (remaining > 0) {
        pdf.addImage(imgData, "PNG", 0, y, imgW, imgH);
        remaining -= pageH;
        if (remaining > 0) {
          pdf.addPage();
          y -= pageH;
        }
      }
    }

    const fileName = `印象アップ結果_${formatDateForFile(snap.savedAt)}.pdf`;
    pdf.save(fileName);
  };

  if (!snap) {
    return (
      <main className="min-h-[100svh] bg-[#0b1f3a] flex justify-center items-center text-white">
        読み込み中...
      </main>
    );
  }

  return (
    <main className="min-h-[100svh] bg-[#0b1f3a] flex justify-center">
      <div className="w-full max-w-[430px] px-4 pt-6 pb-10">
        <div ref={pdfRef} className="rounded-2xl bg-[#0b1f3a]">
          <header className="text-center mb-4">
            <h1 className="text-xl font-extrabold text-white drop-shadow">印象アップ結果</h1>
            <p className="text-[12px] text-white/85">Nonverbal & Delivery Booster</p>
            <p className="mt-1 text-[12px] text-white/85">
              テーマ：{snap.topic} ／ {snap.durationSec}秒 ／ {snap.charsPerMin}字/分
            </p>
            {deltaText && <p className="mt-1 text-[11px] text-white/80">{deltaText}</p>}
            <p className="mt-1 text-[11px] text-white/70">実施日時：{formatDateJP(snap.savedAt)}</p>
          </header>

          <section className="mb-4 rounded-2xl bg-white/95 shadow-md px-3 py-3">
            <h2 className="text-sm font-extrabold text-slate-800 mb-2">話した内容（メモ）</h2>
            <p className="text-[11px] whitespace-pre-wrap leading-relaxed text-slate-800">
              {snap.answerText || "（メモなしでもOK。次は一文だけでも残すと伸びが速い）"}
            </p>
          </section>

          <section className="mb-4 rounded-2xl bg-white shadow-md px-3 py-3">
            <h2 className="text-sm font-extrabold text-slate-800 mb-2">自己チェック</h2>
            <ul className="text-[11px] text-slate-800 space-y-1">
              <li>視線：{snap.selfCheck.eyeContact}/5</li>
              <li>表情（笑顔）：{snap.selfCheck.smile}/5</li>
              <li>うなずき：{snap.selfCheck.nodding}/5</li>
              <li>声量：{snap.selfCheck.voiceVolume}/5</li>
              <li>話速：{snap.selfCheck.voiceSpeed}/5（3が適正）</li>
              <li>結論ファースト：{snap.selfCheck.conclusionFirst}/5</li>
            </ul>
          </section>

<section className="mb-4 rounded-2xl bg-white shadow-md px-3 py-3">
  <h2 className="text-sm font-extrabold text-slate-800 mb-2">
    フィードバック（責任者視点）
  </h2>

  {snap.feedback?.startsWith("【データ不足】") && (
    <p className="text-[12px] font-extrabold text-red-600 mb-2">
      データ不足：点数表示なし
    </p>
  )}

  <p className="text-[11px] whitespace-pre-wrap leading-relaxed text-slate-800">
    {snap.feedback || "（フィードバックがありません）"}
  </p>
</section>

        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/impression")}
            className="w-1/2 rounded-2xl bg-white/90 px-4 py-3 text-slate-900 font-bold shadow"
          >
            もう一回
          </button>
          <button
            type="button"
            onClick={exportPdf}
            className="w-1/2 rounded-2xl bg-emerald-200 px-4 py-3 text-emerald-900 font-extrabold shadow"
          >
            PDF出力
          </button>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => router.push("/start")}
            className="w-full rounded-2xl bg-sky-300 px-4 py-3 text-slate-900 font-extrabold shadow"
          >
            メニューへ戻る
          </button>
        </div>
      </div>
    </main>
  );
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
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  } catch {
    return "unknown";
  }
}
