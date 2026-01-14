// src/lib/impression/evaluateImpression.ts
import type { VoiceMetrics } from "@/lib/impression/voiceMetrics";
import type { VisualMetrics } from "@/lib/impression/mediapipe/faceMetrics";
export type ImpressionScores = {
  posture: number;
  facialExpression: number;
  voiceTone: number;
  pace: number;
  eyeContact: number;
};

export type EvaluateTone = "strict" | "gentle";

export type DataQuality = {
  speechSec: number;
  speechRatio: number;
  faceSec: number;
  faceRatio: number;
};

export interface ImpressionResult {
  evaluable: boolean;
  scores: ImpressionScores | null;
  comment: string;
  firstImpressionComment: string;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}
function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function round(n: number) {
  return Math.round(n);
}
function score01to100(x: number, base = 55, gain = 45) {
  return clamp(base + (x - 0.5) * gain * 2);
}

function pickTop(scores: ImpressionScores) {
  const items = [
    { label: "姿勢", score: scores.posture },
    { label: "表情", score: scores.facialExpression },
    { label: "声", score: scores.voiceTone },
    { label: "テンポ", score: scores.pace },
    { label: "視線", score: scores.eyeContact },
  ].sort((a, b) => b.score - a.score);
  return items[0];
}
function pickBottom(scores: ImpressionScores) {
  const items = [
    { label: "姿勢", score: scores.posture },
    { label: "表情", score: scores.facialExpression },
    { label: "声", score: scores.voiceTone },
    { label: "テンポ", score: scores.pace },
    { label: "視線", score: scores.eyeContact },
  ].sort((a, b) => a.score - b.score);
  return items[0];
}

function buildFirstImpressionComment(x: { smile10: number; gaze10: number; voice10: number }, tone: EvaluateTone) {
  const warm = x.smile10 >= 0.58
    ? "表情の立ち上がりが良く、安心感のある入り方です。"
    : "表情の立ち上がりが遅く、最初の数秒で硬く見えやすい入りです。";

  const eye = x.gaze10 >= 0.58
    ? "視線が中央に乗っており、“向き合っている感”が最初から出ています。"
    : "視線が散りやすく、最初の数秒で集中が伝わりにくい状態です。";

  const voice = x.voice10 >= 0.58
    ? "最初の一声が明るく、輪郭が出ています。"
    : "最初の一声が弱く、声の輪郭が出にくい入りです。";

  const oneMove =
    x.voice10 < 0.58
      ? "最初の「よろしくお願いします」だけ、語尾まで息を届けて“半音上げる”意識で入ってください。"
      : x.gaze10 < 0.58
      ? "開始2秒だけ、レンズ中心に視線を置いてから自然に戻すと安定します。"
      : "開始2秒で口角を固定し、語尾まで明るさを保つと完成度が上がります。";

  const prefix = "【第一印象（最初の10秒）】";
  const style = tone === "gentle" ? "（やさしめ）" : "（プロ目線）";
  return `${prefix}${style}\n${warm}\n${eye}\n${voice}\n次の一手：${oneMove}`;
}

function buildDataInsufficientMessage(args: {
  durationSec: number;
  dq: DataQuality;
  transcript: string;
}) {
  const { durationSec, dq, transcript } = args;
  const greetOk = /よろしく|お願いします|本日は|ありがとうございます|失礼/.test(transcript || "");

  const head =
    `【データ不足：今回は正確なフィードバックができません】\n` +
    `今回の録画（${durationSec}秒）のうち、\n` +
    `・発話が推定できた時間：${Math.round(dq.speechSec)}秒（${Math.round(dq.speechRatio * 100)}%）\n` +
    `・顔が検出できた時間：${Math.round(dq.faceSec)}秒（${Math.round(dq.faceRatio * 100)}%）\n\n`;

  const why =
    `このモードは「視線・表情・声の明るさ/明瞭さ・間（テンポ）」などの“非言語”を、連続データで見て評価します。` +
    `無音や顔未検出が多いと、点数が“それっぽく見えるだけ”になってしまうので、今回は点数表示を止めています。\n\n`;

  const tips =
    `【次回の成功条件（これだけ）】\n` +
    `1) 顔：枠内に顔全体が入る距離で、レンズ中心に視線が来る状態を維持\n` +
    `2) 声：最初の一文だけ“語尾まで息”＋“半音上げる”\n` +
    `3) 目安：50秒程度は話し続ける（内容は自由、挨拶は入ると安定）\n\n`;

  const greet =
    greetOk
      ? `補足：挨拶らしき文が含まれていたのは良い兆候です。次は“最初の一声”を狙って作ると伸びが早いです。`
      : `補足：挨拶（例：「よろしくお願いします」）を最初に入れると、第一印象の安定度が一段上がります。`;

  return head + why + tips + greet;
}

function buildExpertFeedback(args: {
  scores: ImpressionScores;
  tone: EvaluateTone;
  transcript: string;
  voice?: VoiceMetrics;
  hasVoice: boolean;
  visual?: VisualMetrics;
}) {
  const { scores, tone, transcript, voice, hasVoice, visual } = args;

  const header =
    tone === "gentle"
      ? "※良い点を活かしつつ、最短で伸びるポイントだけに絞って整えます。"
      : "※プロ目線で少し厳しめに言います。良い素材がある分、細部で損をしない設計に詰めましょう。";

  const top = pickTop(scores);
  const bottom = pickBottom(scores);

  const greetOk =
    /よろしく|お願いします|本日は|ありがとうございます|失礼/.test(transcript || "");

  const greetLine = greetOk
    ? "挨拶の要素が入っているのは良いです。印象アップでは“最初の一声の設計”が勝負どころです。"
    : "挨拶が入ると第一印象が安定します。最初の「よろしくお願いします」だけは“型”として固定するのが得です。";

  const vLine =
    visual
      ? `表情/視線の実測では、笑顔（平均${Math.round(visual.smileAvg * 100)}）・視線（平均${Math.round(
          visual.gazeCenterRatio * 100
        )}）・正対（${Math.round(visual.faceForwardRatio * 100)}）が、相手の“安心感”を左右します。`
      : "表情/視線の実測は未取得だったため、この部分は体感ベースのコメントになります。";

  const voiceLine = hasVoice
    ? `声の指標では、明瞭さ（${Math.round((voice?.clarityAvg ?? 0) * 100)}）・明るさ（${Math.round(
        (voice?.brightnessAvg ?? 0) * 100
      )}）・抑揚（${Math.round((voice?.rmsStd ?? 0) * 100)}）が、聞き手の“疲れにくさ／説得力”に直結します。`
    : "声の指標は未取得だったため、この部分は体感ベースのコメントになります。";

  const action =
    "次は“型”で勝ちに行きます。①開始2秒：口角を固定してレンズ中心へ視線、②最初の一文：語尾まで息を届けて半音上げる、③一文ごとに0.2秒だけ間を作る。これだけで明るさ・明瞭さ・落ち着きが同時に上がります。";

  return (
    `${header}\n\n` +
    `【良かったところ（約30%）】\n` +
    `強みは「${top.label}」です（${top.score}点）。ここが高いと、相手が安心して話を聞ける土台ができます。あなたは“出せている要素”が明確なので、伸びが速いタイプです。${greetLine}\n\n` +
    `【改善したいところ（約40%）】\n` +
    `伸びしろは「${bottom.label}」です（${bottom.score}点）。ここが低いと、良い要素があっても“伝わる量”が減ります。改善は気合ではなく、動作の順番と量で決まります。${vLine} ${voiceLine} 特に「語尾が落ちる／息が途中で切れる／口の開きが小さい」系は、本人の自覚より早く相手に伝わるので、最初の一文だけで矯正すると効果が大きいです。\n\n` +
    `【次の一手と励まし（約30%）】\n` +
    `${action}\n` +
    `基礎点が高いので、ここを揃えると一気に“専門家が見て整っている印象”に到達します。`
  );
}

export function evaluateImpression(args: {
  transcript: string;
  durationSec: number;
  visual?: VisualMetrics;
  voice?: VoiceMetrics;
  voiceFirst10?: VoiceMetrics; // ✅追加（第一印象専用）
  tone?: EvaluateTone;
  dataQuality?: DataQuality;
}): ImpressionResult {
  const tone: EvaluateTone = args.tone ?? "strict";
  const dq = args.dataQuality;

  // 第一印象10秒：実測優先（無ければ全体の近似）
  const v = args.visual;
  const vf10 = args.voiceFirst10;
  const vfull = args.voice;

  const smile10 = clamp01(v?.smileFirst10 ?? v?.smileAvg ?? 0.5);
  const gaze10 = clamp01(v?.gazeFirst10 ?? v?.gazeCenterRatio ?? 0.5);

  const voice10 = clamp01(
    0.40 * Math.min(1, (vf10?.rmsAvg ?? vfull?.rmsAvg ?? 0) * 3.2) +
      0.35 * (vf10?.clarityAvg ?? vfull?.clarityAvg ?? 0.5) +
      0.25 * (vf10?.brightnessAvg ?? vfull?.brightnessAvg ?? 0.5)
  );

  const firstImpressionComment = buildFirstImpressionComment({ smile10, gaze10, voice10 }, tone);

  // ✅ データ不足なら点数を出さない（ここが信用設計の柱）
  if (dq) {
    const speechOk = dq.speechSec >= 15;
    const faceOk = dq.faceSec >= 10;
    if (!speechOk || !faceOk) {
      return {
        evaluable: false,
        scores: null,
        comment: buildDataInsufficientMessage({
          durationSec: args.durationSec,
          dq,
          transcript: args.transcript,
        }),
        firstImpressionComment,
      };
    }
  }

  // ---- 本評価（全体）
  const smile = clamp01(v?.smileAvg ?? 0.5);
  const eyeOpen = clamp01(v?.eyeOpenAvg ?? 0.5);
  const gaze = clamp01(v?.gazeCenterRatio ?? 0.5);
  const forward = clamp01(v?.faceForwardRatio ?? 0.5);

  const voice = args.voice;
  const hasVoice = !!voice;

  const rms = voice?.rmsAvg ?? 0.25;
  const rmsStd = voice?.rmsStd ?? 0.25;
  const clarity = voice?.clarityAvg ?? 0.5;
  const bright = voice?.brightnessAvg ?? 0.5;
  const noise = voice?.noisinessAvg ?? 0.4;

  const voiceImpression01 =
    0.25 * Math.min(1, rms * 3.0) +
    0.25 * clarity +
    0.2 * bright +
    0.15 * (1 - noise) +
    0.15 * Math.min(1, rmsStd * 1.4);

  const textLen = (args.transcript || "").replace(/\s/g, "").length;
  const density = clamp((textLen / Math.max(1, args.durationSec)) * 8, 0, 100);
  const pace01 = clamp01(0.55 - Math.abs(density - 55) / 120 + rmsStd * 0.15);

  const scores: ImpressionScores = {
    posture: round(score01to100(0.55 * forward + 0.45 * eyeOpen, 55, 35)),
    facialExpression: round(score01to100(0.65 * smile + 0.35 * eyeOpen, 55, 40)),
    voiceTone: round(score01to100(voiceImpression01, 55, 45)),
    pace: round(score01to100(pace01, 55, 35)),
    eyeContact: round(score01to100(0.65 * gaze + 0.35 * forward, 55, 45)),
  };

  const comment = buildExpertFeedback({
    scores,
    tone,
    transcript: args.transcript,
    voice,
    hasVoice,
    visual: v,
  });

  return {
    evaluable: true,
    scores,
    comment,
    firstImpressionComment,
  };
}
