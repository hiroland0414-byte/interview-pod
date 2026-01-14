// src/lib/interview/evaluate/evaluateThreeQuestions.ts
import type { QuestionType, Tone } from "../deepDive/rules";
import type { MissingSignal } from "../deepDive/generateDeepDiveQuestions";

export type EvalResult = {
  score: number;              // 0..100
  feedback: string;           // 本文（だいたい700〜1100字を狙う）
  missingSignals: MissingSignal[];
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

const hasNumbers = (s: string) => /(\d+|％|%|回|ヶ月|人|名|件|年|週間)/.test(s);
const hasEpisodeCue = (s: string) => /(例えば|具体的|その時|当時|実習|経験|場面)/.test(s);
const hasResultCue = (s: string) => /(結果|成果|改善|できた|達成|変わった)/.test(s);
const hasReflectionCue = (s: string) => /(反省|学び|次は|改善|気づき)/.test(s);
const hasTransferCue = (s: string) => /(活か|現場|仕事|入職|貢献|患者|安全|チーム)/.test(s);
const isVague = (s: string) =>
  /(コミュニケーション|頑張ります|努力|協調性|真面目|責任感)/.test(s) && !hasEpisodeCue(s);

const beginsWithStrength = (s: string) =>
  /^\s*(私の強みは|私の強みとして|強みは)/.test(s);

function toneLine(tone: Tone, strictText: string, gentleText: string) {
  return tone === "strict" ? strictText : gentleText;
}

export function evaluateThreeQuestions(input: {
  type: QuestionType;
  answer: string;
  tone: Tone;
}): EvalResult {
  const { type, answer, tone } = input;
  const a = (answer || "").trim();

  const missing: MissingSignal[] = [];

  // 共通点検
  if (!hasEpisodeCue(a)) missing.push("no_specific_episode");
  if (!hasNumbers(a)) missing.push("no_numbers");
  if (!hasResultCue(a)) missing.push("no_result");
  if (!hasReflectionCue(a)) missing.push("no_reflection");
  if (!hasTransferCue(a)) missing.push("no_transfer");
  if (isVague(a)) missing.push("too_vague");

  // type固有
  if (type === "self_pr") {
    if (!beginsWithStrength(a)) missing.push("headline_missing");
  }
  if (type === "motivation") {
    // “ここ”が弱い
    if (!/(この施設|貴院|当院|ここ|御院|病院|施設|理念|方針|地域)/.test(a)) {
      missing.push("why_here_weak");
    }
    if (!/(入職後|将来|3ヶ月|1年|学びたい|貢献)/.test(a)) {
      missing.push("future_weak");
    }
  }
  if (type === "gakuchika") {
    if (!/(課題|難し|壁|工夫|改善|試行錯誤)/.test(a)) missing.push("action_weak");
  }

  // スコアリング（単純で壊れにくい）
  let score = 78;
  score -= missing.includes("headline_missing") ? 10 : 0;
  score -= missing.includes("too_vague") ? 8 : 0;
  score -= missing.includes("no_specific_episode") ? 10 : 0;
  score -= missing.includes("no_numbers") ? 6 : 0;
  score -= missing.includes("no_result") ? 7 : 0;
  score -= missing.includes("no_reflection") ? 6 : 0;
  score -= missing.includes("no_transfer") ? 8 : 0;
  score -= missing.includes("why_here_weak") ? 8 : 0;
  score -= missing.includes("future_weak") ? 6 : 0;
  score -= missing.includes("action_weak") ? 5 : 0;

  score = clamp(score);

  // 専門家風フィードバック（長文すぎない）
  const title =
    type === "motivation" ? "志望動機" : type === "self_pr" ? "自己PR" : "学生時代に力を入れたこと";

  const goodPoints: string[] = [];
  const improve: string[] = [];
  const next: string[] = [];

  // 良いところ（不足の裏返しで褒める）
  goodPoints.push(
    toneLine(
      tone,
      "全体として主張は通っています。言い切りと論点の整理はできています。",
      "全体として伝えたい方向性は見えています。軸はつかめています。"
    )
  );

  if (!missing.includes("too_vague")) goodPoints.push("抽象語に逃げず、内容が具体に寄っているのは強みです。");
  if (!missing.includes("no_specific_episode")) goodPoints.push("具体的な場面が入っているため、人物像が想像しやすいです。");
  if (!missing.includes("no_numbers")) goodPoints.push("数字が入ることで説得力が上がっています。");
  if (!missing.includes("no_transfer")) goodPoints.push("仕事へのつながりを意識できており、面接官が評価しやすい構造です。");

  // 改善点
  if (missing.includes("headline_missing") && type === "self_pr") {
    improve.push("冒頭で結論が言い切れていません。最初の一文で『私の強みは〇〇です』を固定してください。");
  }
  if (missing.includes("too_vague")) {
    improve.push("“よくある強み”の表現が残っています。『どんなコミュニケーションか（傾聴/調整/説明など）』まで定義しましょう。");
  }
  if (missing.includes("no_specific_episode")) {
    improve.push("経験の輪郭が薄いです。状況→行動→結果（STAR）で、場面を1つに絞って出してください。");
  }
  if (missing.includes("no_numbers")) {
    improve.push("数字がないため印象が弱くなります。回数・期間・人数・改善幅のどれかを1つ入れてください。");
  }
  if (missing.includes("no_result")) {
    improve.push("結果が曖昧です。『何がどう変わったか』を一文で言い切りましょう。");
  }
  if (missing.includes("no_reflection")) {
    improve.push("学び（反省→改善）が見えません。失敗を1つ出し、次に変えた行動まで言うと評価が跳ねます。");
  }
  if (missing.includes("no_transfer")) {
    improve.push("仕事への接続が弱いです。医療現場では“チーム・安全・患者対応”のどれに効く強みかを明確に。");
  }
  if (missing.includes("why_here_weak") && type === "motivation") {
    improve.push("“ここである理由”が不足しています。理念・研修・チーム・地域性など、根拠を1つ示してください。");
  }
  if (missing.includes("future_weak") && type === "motivation") {
    improve.push("入職後のイメージが薄いです。『最初の3ヶ月でできるようになること』を具体に置きましょう。");
  }

  // 次の一手（短いルール）
  next.push("①冒頭1文で結論 → ②具体例は1つに絞る → ③数字を1つ入れる → ④結果を言い切る → ⑤学びと次の行動 → ⑥現場への接続。");
  if (type === "self_pr") next.push("『私の強みは〇〇です』を“固定フレーズ”にして、毎回同じ型で入るだけで完成度が上がります。");

  const feedback =
    `【${title}：総評】\n` +
    `スコア目安：${score}/100\n\n` +
    `【良かったところ】\n` +
    goodPoints.join("\n") +
    `\n\n【改善したいところ】\n` +
    (improve.length ? improve.join("\n") : "大きな欠点はありません。より強くするなら、数字と結論の言い切りを磨きましょう。") +
    `\n\n【次の一手】\n` +
    next.join("\n");

  return { score, feedback, missingSignals: Array.from(new Set(missing)) };
}
