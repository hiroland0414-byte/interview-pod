// src/app/impression/result/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const BG_SRC = "/images/sky_cloud.jpg";

type SelfCheck = {
  eye?: "good" | "mid" | "bad";
  voice?: "good" | "mid" | "bad";
};

type ImpressionSnap = {
  trainedAt: string;
  seconds: number;
  score?: number;
  feedback: string;
  meta?: {
    faceMissingRatio?: number;
    faceCheckAvailable?: boolean;
  };
  radar?: {
    items: [string, string, string, string, string];
    values: [number, number, number, number, number];
  };
  selfCheck?: SelfCheck;
};

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function mapSelfToScore(v?: "good" | "mid" | "bad") {
  if (v === "good") return 15;
  if (v === "mid") return 8;
  if (v === "bad") return 0;
  return 8; // 未入力は中間
}

function mapSelfToValue(v?: "good" | "mid" | "bad") {
  if (v === "good") return 85;
  if (v === "mid") return 60;
  if (v === "bad") return 35;
  return 60;
}

function recomputeSnap(prev: ImpressionSnap): ImpressionSnap {
  const seconds = prev.seconds;
  const faceMissingRatio = prev.meta?.faceMissingRatio;
  const faceCheckAvailable = !!prev.meta?.faceCheckAvailable;

  const selfEye = mapSelfToScore(prev.selfCheck?.eye);
  const selfVoice = mapSelfToScore(prev.selfCheck?.voice);

  const MIN_SEC = 30;
  const MAX_SEC = 60;

  const timeScore = clamp(((seconds - MIN_SEC) / (MAX_SEC - MIN_SEC)) * 25, 0, 25);

  const faceScore = faceCheckAvailable
    ? clamp((1 - (faceMissingRatio ?? 0)) * 45, 0, 45)
    : 0;

  const base = faceCheckAvailable
    ? faceScore + timeScore + selfEye + selfVoice
    : timeScore +
      clamp((selfEye / 15) * 25, 0, 25) +
      clamp((selfVoice / 15) * 25, 0, 25) +
      25;

  const score = Math.round(clamp(base, 0, 100));

  const needImprove =
    (faceCheckAvailable && (faceMissingRatio ?? 0) >= 0.25) || seconds < 40;

  const grade = needImprove ? "B" : "A";

  const vStability = faceCheckAvailable
    ? Math.round(clamp((1 - (faceMissingRatio ?? 0)) * 100, 0, 100))
    : 60;

  const vTempo = Math.round(clamp(50 + ((seconds - MIN_SEC) / 30) * 40, 50, 90));

  const vEye = mapSelfToValue(prev.selfCheck?.eye);
  const vVoice = mapSelfToValue(prev.selfCheck?.voice);
  const vExpression = Math.round(clamp(vEye * 0.6 + vVoice * 0.4, 35, 90));

  const radar = {
    items: ["姿勢・安定感", "表情", "目線", "声の明瞭さ", "話すテンポ"] as any,
    values: [vStability, vExpression, vEye, vVoice, vTempo] as any,
  } as ImpressionSnap["radar"];

  // 次の一手（1つ）
  let nextAction = "次回は「目線をカメラ付近に合わせる」ことを、特に意識して録画しましょう。";
  if (faceCheckAvailable && (faceMissingRatio ?? 0) >= 0.25) {
    nextAction = "次回は「顔が枠からはみ出ない距離・角度」にすることを、特に意識して録画しましょう。";
  } else if ((prev.selfCheck?.eye ?? "mid") === "bad") {
    nextAction = "次回は「目線をカメラに合わせる」ことを、特に意識して録画しましょう。";
  } else if ((prev.selfCheck?.voice ?? "mid") === "bad") {
    nextAction = "次回は「語尾を言い切る（声のトーンを1段だけ上げる）」ことを、特に意識して録画しましょう。";
  } else if (seconds < 40) {
    nextAction = "次回は「冒頭3秒（挨拶→名乗り→一言）をスムーズに言う」ことを、特に意識して録画しましょう。";
  }

  const header = grade === "A" ? "【総評（評価OK：良好）】\n" : "【総評（評価OK：要改善）】\n";
  const body =
    grade === "A"
      ? "第一印象は「安定感」で決まります。今回は大きく崩れていません。この状態を“再現”できれば勝ちです。\n\n"
      : "第一印象は「安定感」で決まります。今回は“もったいない癖”が少し出ています。直せば一気に上がります。\n\n";

  const good =
    "【良かったところ】\n" +
    "・30秒以上話せている時点で、評価に必要なデータは取れています。\n\n";

  const improve =
    "【改善ポイント（優先度順）】\n" +
    "① 目線（カメラ付近）を固定\n" +
    "② 語尾を飲み込まず言い切る\n" +
    "③ 表情：口角を少し上げる\n\n";

  const next = `【次の一手（1つだけ）】\n・${nextAction}`;

  return {
    ...prev,
    score,
    radar,
    feedback: header + body + good + improve + next,
  };
}

/** 前回との差分コメント（1行） */
function buildDeltaComment(curr: ImpressionSnap, prev: ImpressionSnap | null): string {
  if (!prev) return "今回が初回です。まずは同じ条件で2回目を録画して“再現性”を作りましょう。";

  const parts: string[] = [];

  // 秒数差
  const ds = (curr.seconds ?? 0) - (prev.seconds ?? 0);
  if (Math.abs(ds) >= 3) {
    parts.push(`録画時間が${ds > 0 ? "+" : ""}${ds}秒`);
  }

  // 顔の安定（faceMissingRatioが下がるほど改善）
  const fc = !!curr.meta?.faceCheckAvailable;
  const fp = !!prev.meta?.faceCheckAvailable;
  if (fc && fp) {
    const cm = curr.meta?.faceMissingRatio ?? 0;
    const pm = prev.meta?.faceMissingRatio ?? 0;
    const diff = pm - cm; // プラスなら改善（欠落が減った）
    if (Math.abs(diff) >= 0.05) {
      parts.push(`顔の安定が${diff > 0 ? "改善" : "悪化"}`);
    }
  }

  // セルフ（変化があれば）
  const ce = curr.selfCheck?.eye;
  const pe = prev.selfCheck?.eye;
  if (ce && pe && ce !== pe) parts.push("目線セルフが更新");

  const cv = curr.selfCheck?.voice;
  const pv = prev.selfCheck?.voice;
  if (cv && pv && cv !== pv) parts.push("声セルフが更新");

  if (parts.length === 0) {
    return "前回と条件が近いです。次は「次の一手」を1つだけ強調して、形（レーダー）を動かしましょう。";
  }
  return `前回より、${parts.join("／")}しています。`;
}

/** レーダー読み取りガイド（1行） */
function buildRadarGuide(labels: string[], values: number[]): string {
  if (labels.length !== 5 || values.length !== 5) return "形（バランス）を見て、弱い1点だけを次回のテーマにしましょう。";

  const items = labels.map((l, i) => ({ label: l, value: values[i] ?? 0 }));
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const top1 = sorted[0];
  const top2 = sorted[1];
  const low1 = sorted[sorted.length - 1];

  // 露骨な断定を避けつつ、行動に繋げる言い方
  return `今回は「${top1.label}」「${top2.label}」が比較的安定。次は「${low1.label}」を意識すると全体のバランスが整います。`;
}

/** SVGレーダーチャート（5角形） */
function RadarChart({ labels, values }: { labels: string[]; values: number[] }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 78;

  const points = useMemo(() => {
    const n = 5;
    return Array.from({ length: n }, (_, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return { angle };
    });
  }, []);

  function polarToXY(angle: number, radius: number) {
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  }

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  const gridPolys = gridLevels.map((lv) =>
    points
      .map((p) => polarToXY(p.angle, r * lv))
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ")
  );

  const valuePoly = points
    .map((p, i) => polarToXY(p.angle, r * clamp((values[i] ?? 0) / 100, 0, 1)))
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const axes = points.map((p) => {
    const end = polarToXY(p.angle, r);
    return { x1: cx, y1: cy, x2: end.x, y2: end.y };
  });

  const labelPos = points.map((p) => polarToXY(p.angle, r + 28));

  return (
    <div className="flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="レーダーチャート">
        {gridPolys.map((pts, idx) => (
          <polygon key={idx} points={pts} fill="none" stroke="rgba(15,23,42,0.25)" strokeWidth="1" />
        ))}

        {axes.map((a, idx) => (
          <line key={idx} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="rgba(15,23,42,0.25)" strokeWidth="1" />
        ))}

        <polygon points={valuePoly} fill="rgba(16,185,129,0.25)" stroke="rgba(16,185,129,0.75)" strokeWidth="2" />

        {points.map((p, i) => {
          const pt = polarToXY(p.angle, r * clamp((values[i] ?? 0) / 100, 0, 1));
          return <circle key={i} cx={pt.x} cy={pt.y} r="3.5" fill="rgba(16,185,129,0.85)" />;
        })}

        {labelPos.map((pos, i) => (
          <text
            key={i}
            x={pos.x}
            y={pos.y}
            fontSize="11"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(15,23,42,0.95)"
          >
            {labels[i]}
          </text>
        ))}
      </svg>
    </div>
  );
}

export default function ImpressionResultPage() {
  const router = useRouter();
  const [snap, setSnap] = useState<ImpressionSnap | null>(null);
  const [prevSnap, setPrevSnap] = useState<ImpressionSnap | null>(null);

  useEffect(() => {
    const saved = safeJsonParse<ImpressionSnap>(sessionStorage.getItem("kcareer.impression.snap"));
    const prev = safeJsonParse<ImpressionSnap>(sessionStorage.getItem("kcareer.impression.prev"));

    setPrevSnap(prev);

    if (saved) {
      const normalized = recomputeSnap({
        ...saved,
        selfCheck: saved.selfCheck ?? {},
      });

      setSnap(normalized);
      sessionStorage.setItem("kcareer.impression.snap", JSON.stringify(normalized));

      // ✅ 表示した「今回」を次回の比較用に保存
      sessionStorage.setItem("kcareer.impression.prev", JSON.stringify(normalized));
    } else {
      setSnap(null);
    }
  }, []);

  const radarLabels = snap?.radar?.items ?? ["姿勢・安定感", "表情", "目線", "声の明瞭さ", "話すテンポ"];
  const radarValues = snap?.radar?.values ?? [60, 55, 60, 60, 60];

  const deltaComment = useMemo(() => {
    if (!snap) return "";
    return buildDeltaComment(snap, prevSnap);
  }, [snap, prevSnap]);

  const radarGuide = useMemo(() => {
    if (!snap || typeof snap.score !== "number") return "";
    return buildRadarGuide([...radarLabels], [...radarValues]);
  }, [snap, radarLabels, radarValues]);

  function updateSelf(part: keyof SelfCheck, value: "good" | "mid" | "bad") {
    if (!snap) return;
    const next: ImpressionSnap = {
      ...snap,
      selfCheck: { ...(snap.selfCheck ?? {}), [part]: value },
    };
    const updated = recomputeSnap(next);
    setSnap(updated);
    sessionStorage.setItem("kcareer.impression.snap", JSON.stringify(updated));
    // prevも更新して、次回比較が「最新状態」になるようにしておく
    sessionStorage.setItem("kcareer.impression.prev", JSON.stringify(updated));
  }

  return (
    <main className="relative w-full h-[100svh] overflow-hidden flex justify-center bg-slate-100">
      <div className="w-[390px] max-w-[92vw] h-[100svh] flex items-start justify-center pt-2 pb-6">
        <div className="relative w-full rounded-[28px] overflow-hidden shadow-2xl border border-white/30">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${BG_SRC})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              filter: "saturate(1.05) contrast(1.02)",
              transform: "scale(1.03)",
            }}
          />
          <div className="absolute inset-0 bg-sky-950/35" />
 {/* ✅ ここがスクロール本体（これを入れる） */}
        <div className="relative h-full overflow-y-auto overscroll-contain px-5 pt-4 pb-6"></div>
          <div className="relative px-5 pt-4 pb-5">
            <div className="mt-4 text-center">
              <h1 className="text-[28px] font-extrabold text-white tracking-wide" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.35)" }}>
                印象アップモード
              </h1>
              <p className="mt-1 text-[13px] font-semibold text-white/95" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.35)" }}>
                Non-verbal Feedback (voice / face)
              </p>
              <p className="mt-2 text-[12px] font-extrabold text-red-500">全モード共通</p>
            </div>

            <div className="mt-4 rounded-[22px] border-2 border-white/55 p-4 bg-sky-100/85 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
              {!snap ? (
                <section className="rounded-2xl bg-white shadow-md px-3 py-3">
                  <h2 className="text-sm font-extrabold text-slate-800 mb-2">フィードバック（責任者視点）</h2>
                  <p className="text-[12px] font-semibold text-slate-700 leading-relaxed">
                    結果データが見つかりませんでした。もう一度録画を行ってください。
                  </p>
                </section>
              ) : (
                <>
                  {/* ① 前回との差分（1行） */}
                  <div className="mb-3 rounded-2xl bg-white/80 border border-white/70 p-3 shadow-sm">
                    <p className="text-[12px] font-extrabold text-slate-800">前回との比較</p>
                    <p className="mt-1 text-[12px] font-semibold text-slate-700">{deltaComment}</p>
                  </div>

                  {/* score */}
                  {typeof snap.score === "number" && (
                    <div className="mb-3 rounded-2xl bg-white/80 border border-white/70 p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-extrabold text-slate-800">今回のスコア</p>
                        <p className="text-[22px] font-extrabold text-slate-900">
                          {snap.score}
                          <span className="text-[12px] font-bold text-slate-600"> / 100</span>
                        </p>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-slate-600">
                        ※目線・声の自己チェックで、評価がより正確になります
                      </p>
                    </div>
                  )}

                  {snap.feedback.startsWith("【データ不足】") && (
                    <p className="text-[12px] font-extrabold text-red-600 mb-2">データ不足：点数表示なし</p>
                  )}

                  {/* radar + ② 読み取りガイド */}
                  {typeof snap.score === "number" && (
                    <div className="rounded-2xl bg-white/80 border border-white/70 p-3 shadow-sm">
                      <p className="text-[12px] font-extrabold text-slate-800 mb-2">レーダーチャート（5項目）</p>
                      <RadarChart labels={[...radarLabels]} values={[...radarValues]} />
                      <p className="mt-2 text-[11px] font-semibold text-slate-700">
                        {radarGuide}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-slate-600">
                        ※「表情」は現時点では暫定評価（目線・声の自己チェックを反映）
                      </p>
                    </div>
                  )}

                  {/* self check */}
                  {typeof snap.score === "number" && (
                    <div className="mt-3 rounded-2xl bg-white/80 border border-white/70 p-3 shadow-sm">
                      <p className="text-[12px] font-extrabold text-slate-800 mb-2">自己チェック（評価精度UP）</p>

                      <div className="text-[12px] font-semibold text-slate-700">
                        <p>Q1：目線（カメラ付近）を意識できた？</p>
                        <div className="mt-2 flex gap-2">
                          {(["good", "mid", "bad"] as const).map((v) => (
                            <button
                              key={v}
                              type="button"
                              className={[
                                "flex-1 h-[38px] rounded-full font-extrabold text-[12px] border transition-all",
                                snap.selfCheck?.eye === v
                                  ? v === "good"
                                    ? "bg-emerald-200 text-slate-900 border-emerald-300"
                                    : v === "mid"
                                      ? "bg-sky-200 text-slate-900 border-sky-300"
                                      : "bg-rose-200 text-slate-900 border-rose-300"
                                  : "bg-white/70 text-slate-800 border-white/70 hover:bg-white",
                              ].join(" ")}
                              onClick={() => updateSelf("eye", v)}
                            >
                              {v === "good" ? "できた" : v === "mid" ? "まあまあ" : "できなかった"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 text-[12px] font-semibold text-slate-700">
                        <p>Q2：声は普段よりはっきり出せた？</p>
                        <div className="mt-2 flex gap-2">
                          {(["good", "mid", "bad"] as const).map((v) => (
                            <button
                              key={v}
                              type="button"
                              className={[
                                "flex-1 h-[38px] rounded-full font-extrabold text-[12px] border transition-all",
                                snap.selfCheck?.voice === v
                                  ? v === "good"
                                    ? "bg-emerald-200 text-slate-900 border-emerald-300"
                                    : v === "mid"
                                      ? "bg-sky-200 text-slate-900 border-sky-300"
                                      : "bg-rose-200 text-slate-900 border-rose-300"
                                  : "bg-white/70 text-slate-800 border-white/70 hover:bg-white",
                              ].join(" ")}
                              onClick={() => updateSelf("voice", v)}
                            >
                              {v === "good" ? "できた" : v === "mid" ? "まあまあ" : "できなかった"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <p className="mt-2 text-[10px] font-semibold text-slate-600">
                        ※自己チェックはあなたの努力を正しく評価するためのものです（内容は評価しません）
                      </p>
                    </div>
                  )}

                  {/* feedback text */}
                  <section className="mt-3 rounded-2xl bg-white shadow-md px-3 py-3">
                    <h2 className="text-sm font-extrabold text-slate-800 mb-2">フィードバック（責任者視点）</h2>
                    <p className="text-[11px] whitespace-pre-wrap leading-relaxed text-slate-800">{snap.feedback}</p>
                  </section>

                  {/* ③ 教員・運用向け注記（小さく） */}
                  <p className="mt-3 text-[10px] font-semibold text-slate-700/80">
                    ※運用注記：この結果は第一印象（非言語：声・表情・目線・安定感）のみを扱い、話の内容は評価しません。
                  </p>
                </>
              )}

              {/* buttons */}
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="flex-1 h-[48px] rounded-full font-extrabold text-[16px] shadow-lg bg-sky-300 text-slate-900 hover:bg-sky-200 transition-all"
                  onClick={() => router.push("/impression/record")}
                >
                  リトライ
                </button>

                <button
                  type="button"
                  className="flex-1 h-[48px] rounded-full font-extrabold text-[16px] shadow-lg bg-white/80 text-slate-900 hover:bg-white transition-all border border-white/70"
                  onClick={() => router.push("/start")}
                >
                  モード選択へ
                </button>
              </div>
            </div>

            <p className="mt-3 text-center text-[11px] font-semibold text-white/90">
              ※Android/Chrome 推奨（カメラ・マイク許可が必要）
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
