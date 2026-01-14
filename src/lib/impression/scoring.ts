import { ImpressionRadarItem, ImpressionResult, ImpressionSnap } from "./types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const to100 = (x01: number) => Math.round(clamp01(x01) * 100);

// 5項目（確定）
const RADAR_META: Array<Pick<ImpressionRadarItem, "key" | "label" | "desc">> = [
  {
    key: "voiceClarity",
    label: "声の明瞭さ",
    desc: "声がはっきり届き、聞き取りにくさがないかを見ています。",
  },
  {
    key: "speechRhythm",
    label: "話し方のリズム",
    desc: "話す速さや抑揚、間のとり方が自然かを確認しています。",
  },
  {
    key: "expression",
    label: "表情の出方",
    desc: "口角や表情の動きから、硬すぎない印象かを見ています。",
  },
  {
    key: "gaze",
    label: "目線・顔の向き",
    desc: "顔が安定して映り、相手を意識した目線かを確認しています。",
  },
  {
    key: "stability",
    label: "全体の安定感",
    desc: "姿勢や動きから、落ち着いて対応できそうかを見ています。",
  },
];

// “無音の評価はやめる”ので、無音率を軸としては出さない。
// ただし、声がほぼ出ていない等はスコア成立に関わるので「データ不足判定」には使ってOK。
function isDataInsufficient(snap: ImpressionSnap): boolean {
  if (snap.durationSec < 30) return true;

  // 顔がほぼ入っていない
  if (typeof snap.faceDetectedRatio === "number" && snap.faceDetectedRatio < 0.4) return true;

  // 声活動がほぼない（※無音“評価”ではなく、測定成立の判定）
  if (typeof snap.voiceActiveRatio === "number" && snap.voiceActiveRatio < 0.4) return true;

  return false;
}

// ここは「既存の計測値」に合わせて調整可能。
// 今は “それっぽく” ではなく、「少ない情報でも破綻しない」形にしてある。
function computeScores01(snap: ImpressionSnap) {
  const voice = (() => {
    // rmsAvg: 0.02〜0.15くらいを想定して正規化（環境により要調整）
    const avg = typeof snap.rmsAvg === "number" ? snap.rmsAvg : 0;
    const norm = (avg - 0.02) / (0.15 - 0.02);
    return clamp01(norm);
  })();

  const rhythm = (() => {
    // rmsStdが大きすぎても小さすぎても単調/不安定になりうるので “中庸” を高評価に寄せる
    const std = typeof snap.rmsStd === "number" ? snap.rmsStd : 0;
    const ideal = 0.03; // 仮の中心
    const diff = Math.abs(std - ideal);
    const score = 1 - diff / 0.06; // diff 0.06で0点
    return clamp01(score);
  })();

  const expression = (() => {
    // 表情は現状「顔が入っている」だけでも最低限の代用にする
    const base = typeof snap.faceDetectedRatio === "number" ? snap.faceDetectedRatio : 0;
    return clamp01(base);
  })();

  const gaze = (() => {
    const g = typeof snap.gazeStableRatio === "number"
      ? snap.gazeStableRatio
      : (typeof snap.faceDetectedRatio === "number" ? snap.faceDetectedRatio : 0);
    return clamp01(g);
  })();

  const stability = (() => {
    // motionStabilityがあれば使う。なければ gaze と face の平均で代用。
    if (typeof snap.motionStability === "number") return clamp01(snap.motionStability);
    const f = typeof snap.faceDetectedRatio === "number" ? snap.faceDetectedRatio : 0;
    const g = typeof snap.gazeStableRatio === "number" ? snap.gazeStableRatio : f;
    return clamp01((f + g) / 2);
  })();

  return { voice, rhythm, expression, gaze, stability };
}

function buildRadar(snap: ImpressionSnap): ImpressionRadarItem[] {
  const s = computeScores01(snap);
  const byKey = {
    voiceClarity: s.voice,
    speechRhythm: s.rhythm,
    expression: s.expression,
    gaze: s.gaze,
    stability: s.stability,
  } as const;

  return RADAR_META.map((m) => ({
    ...m,
    score: to100(byKey[m.key]),
  }));
}

// 文章フィードバックは、既存のあなたの生成（共通3段構成）に接続してください。
// ここは最小スタブ。あとで generateImpressionFeedback(snap, radar) に差し替えればOK。
function buildFeedbackText(snap: ImpressionSnap, radar?: ImpressionRadarItem[], insufficient?: boolean): string {
  if (insufficient) {
    return [
      "データ不足のため、今回は点数を表示していません。",
      "30秒以上の録画、声が途切れにくい話し方、顔が画面に入る位置を意識して、もう一度試してみてください。",
      "",
      "自己紹介をしてください。（大学名、氏名、学んできたこと、長所、趣味、出身地、部活動、ボランティア活動やアルバイト経験などを簡潔に）",
    ].join("\n");
  }

  // 例：凹み1〜2個を拾って次の一手を1つに絞る…などは、あなたの確定ルールどおりに後で接続
  return [
    "この結果は、話の内容ではなく、声・話し方・表情・目線・落ち着きについての確認です。",
    "",
    "自己紹介をしてください。（大学名、氏名、学んできたこと、長所、趣味、出身地、部活動、ボランティア活動やアルバイト経験などを簡潔に）",
  ].join("\n");
}

export function buildImpressionResult(snap: ImpressionSnap): ImpressionResult {
  const insufficient = isDataInsufficient(snap);
  const radar = insufficient ? undefined : buildRadar(snap);
  return {
    isDataInsufficient: insufficient,
    radar,
    feedbackText: buildFeedbackText(snap, radar, insufficient),
  };
}
