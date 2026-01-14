// src/lib/impression/feedbackLocal.ts
"use client";

import type { ImpressionSelfCheck } from "./session";

export function generateImpressionFeedback(args: {
  topic: string;
  durationSec: number;
  answerText: string;
  charsPerMin: number;
  selfCheck: ImpressionSelfCheck;
  prev?: { charsPerMin: number; selfCheck: ImpressionSelfCheck } | null;
}): string {
  const { topic, durationSec, answerText, charsPerMin, selfCheck, prev } = args;

  const hasText = (answerText || "").replace(/\s/g, "").length > 0;

  // 速度の目安：日本語の“面接で聞き取りやすい”は概ね 300〜450字/分あたりを目安に雑に置く
  const speedComment =
    charsPerMin < 260
      ? "話す量が少なめで、印象が薄くなりやすい。結論を先に置いて、要点を2つに絞って厚みを作ろう。"
      : charsPerMin > 520
      ? "情報量が多く、聞き手の処理が追いつかない危険がある。1文を短く、間を入れて“伝わる速度”に落とそう。"
      : "速度は概ね聞き取りやすい範囲。あとは“間”と“言い切り”で説得力を上げよう。";

  const lacks: string[] = [];
  if (selfCheck.eyeContact <= 2) lacks.push("視線（カメラ/相手を見る意識）");
  if (selfCheck.smile <= 2) lacks.push("表情（口角・柔らかさ）");
  if (selfCheck.nodding <= 2) lacks.push("相づち/うなずき（反応の見せ方）");
  if (selfCheck.voiceVolume <= 2) lacks.push("声量（届く声）");
  if (Math.abs(selfCheck.voiceSpeed - 3) >= 2) lacks.push("話速（速すぎ/遅すぎ）");
  if (selfCheck.conclusionFirst <= 2) lacks.push("結論ファースト（最初の5秒）");

  const lacksText =
    lacks.length > 0
      ? `\n【不足が目立つ点】\n・${lacks.join("\n・")}\n`
      : "";

  const trend =
    prev
      ? `\n【前回との差分】\n・話す量：${prev.charsPerMin}字/分 → ${charsPerMin}字/分\n（※“良い/悪い”ではなく、“聞き手に伝わる形”に寄せるのが目的）\n`
      : "";

  const openingLine =
    topic.includes("自己紹介")
      ? "最初の10秒で勝負が決まります。名乗る→結論（強み）→根拠（1場面）→貢献、の順で固定。"
      : "結論を最初に置き、理由は1つ、具体例は1つ。短いのに強い型に寄せていこう。";

  return (
    `【印象アップ：現場責任者の視点（厳しめ）】\n` +
    `テーマ：${topic}（${durationSec}秒）\n\n` +
    `【良かったところ】\n` +
    (hasText
      ? "言葉が出ている時点で前進。あとは“見せ方”の微調整で一気に伸びる段階です。\n"
      : "無言や空欄だと評価以前の問題になる。まずは短くてもいいので型に沿って話そう。\n") +
    `\n【厳しめ指摘（改善点）】\n` +
    `${openingLine}\n` +
    `${speedComment}\n` +
    lacksText +
    trend +
    `\n【次の一手（具体）】\n` +
    `1) 最初の一文を固定（例：「私の強みは◯◯です」）\n` +
    `2) 具体例は“場面→行動→結果”の3点セットにする\n` +
    `3) 最後は「入職後は◯◯で貢献します」で締める\n` +
    `\nちゃんと伸びます。次は“最初の一文”をさらに短くして、言い切ってください。`
  );
}
