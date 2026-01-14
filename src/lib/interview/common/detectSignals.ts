// src/lib/interview/common/detectSignals.ts
// -------------------------------------------------------------
// 評価ロジックと深掘り質問生成で “同じ観測装置” を使うための共通関数。
// missingSignals の語彙を統一し、整合性を上げる。
// -------------------------------------------------------------

export type QuestionType = "motivation" | "self_pr" | "gakuchika";

export type SignalResult = {
  strengths: string[];
  missingSignals: string[];
  meta: {
    length: number; // 文字数
    hasGreeting: boolean;
    hasNumbers: boolean;
    hasConcreteNouns: boolean;
    hasFeelings: boolean;
    hasActionVerbs: boolean;
    hasResultWords: boolean;
  };
};

const normalize = (s: string) =>
  (s || "")
    .replace(/\s+/g, " ")
    .replace(/[　]+/g, " ")
    .trim();

const hasAny = (text: string, re: RegExp) => re.test(text);

const GREETING_RE =
  /よろしくお願(い|します)|本日は|ありがとうございます|失礼(い)?たします|お願(い|します)/;

const NUMBER_RE = /[0-9０-９]+|%|％|回|人|名|件|週間|か月|ヶ月|年|日|時間|分/;

// “具体物っぽい名詞” の超簡易（業界に依存しない範囲）
const CONCRETE_NOUN_RE =
  /病院|患者|検査|実習|チーム|部活|アルバイト|サークル|ゼミ|研究|発表|企画|運営|改善|マニュアル|シフト|売上|顧客|クレーム|データ|分析|Excel|PowerPoint|CT|MRI|医療|画像|機器|安全/;

const FEELINGS_RE =
  /嬉し|悔し|不安|緊張|達成|楽し|やりがい|大変|苦労|悩|心から|強く|思いま/;

const ACTION_VERB_RE =
  /した|やった|取り組ん|工夫|改善|提案|実行|作成|調整|連携|説明|相談|まとめ|分析|練習|反省|挑戦/;

const RESULT_WORD_RE =
  /結果|成果|評価|達成|改善|成功|失敗|変化|伸び|増え|減っ|上がっ|下がっ|できるようにな/;

// 抽象ワード（自己PRで「コミュ力です」だけ、みたいなのを弾く）
const ABSTRACT_RE =
  /コミュニケーション|協調性|責任感|積極性|主体性|粘り強さ|向上心|やる気|真面目|明るさ/;

export function detectSignals(type: QuestionType, raw: string): SignalResult {
  const text = normalize(raw);

  const length = text.length;
  const hasGreeting = hasAny(text, GREETING_RE);
  const hasNumbers = hasAny(text, NUMBER_RE);
  const hasConcreteNouns = hasAny(text, CONCRETE_NOUN_RE);
  const hasFeelings = hasAny(text, FEELINGS_RE);
  const hasActionVerbs = hasAny(text, ACTION_VERB_RE);
  const hasResultWords = hasAny(text, RESULT_WORD_RE);

  const strengths: string[] = [];
  const missingSignals: string[] = [];

  // 共通：短すぎ
  if (length < 80) missingSignals.push("情報量が少ない（短い）");

  // 共通：具体性
  if (!hasConcreteNouns) missingSignals.push("具体の場面・対象が弱い");
  if (!hasActionVerbs) missingSignals.push("行動（何をしたか）が弱い");
  if (!hasResultWords) missingSignals.push("結果・成果が弱い");
  if (!hasNumbers) missingSignals.push("数字・規模感がない");
  if (!hasFeelings) missingSignals.push("気持ち・動機が伝わりにくい");

  // 良い点
  if (hasGreeting) strengths.push("丁寧な挨拶が入っている");
  if (hasConcreteNouns) strengths.push("具体的な場面の描写がある");
  if (hasActionVerbs) strengths.push("行動が書けている");
  if (hasResultWords) strengths.push("結果に触れている");
  if (hasNumbers) strengths.push("数字で語れている");
  if (hasFeelings) strengths.push("感情が見えている");

  // type別の追加観測
  if (type === "self_pr") {
    // 「私の強みは◯◯です」系の“言い切り”を見たい
    const hasStrongOpening =
      /^(私の強み|強みは|私の長所|長所は).{0,10}(です|だと思います)/.test(text);
    if (!hasStrongOpening) missingSignals.push("冒頭で強みを言い切れていない");

    // 抽象語だけで終わるのを弾く
    if (hasAny(text, ABSTRACT_RE) && !hasConcreteNouns) {
      missingSignals.push("強みが抽象的（何のコミュ力か不明）");
    }
  }

  if (type === "motivation") {
    const hasWhyHere =
      /貴院|貴社|御院|御社|この病院|この施設|ここで|志望(した|する)理由|魅力/.test(text);
    if (!hasWhyHere) missingSignals.push("なぜここか（志望先固有の理由）が弱い");
    const hasFuture =
      /将来|今後|入職後|入社後|目指|実現したい|貢献したい/.test(text);
    if (!hasFuture) missingSignals.push("入職後の貢献・将来像が弱い");
  }

  if (type === "gakuchika") {
    const hasChallenge = /課題|困難|壁|苦労|失敗|問題/.test(text);
    if (!hasChallenge) missingSignals.push("課題・困難が弱い（山場が見えない）");
    const hasIngenuity = /工夫|改善|試行錯誤|仮説|検証|やり方を変え/.test(text);
    if (!hasIngenuity) missingSignals.push("工夫・試行錯誤が弱い");
    const hasTransfer = /活か|応用|再現|現場|今後|学んだこと/.test(text);
    if (!hasTransfer) missingSignals.push("学びの転用（再現性）が弱い");
  }

  // 重複除去
  const uniq = (arr: string[]) => Array.from(new Set(arr));
  return {
    strengths: uniq(strengths),
    missingSignals: uniq(missingSignals),
    meta: {
      length,
      hasGreeting,
      hasNumbers,
      hasConcreteNouns,
      hasFeelings,
      hasActionVerbs,
      hasResultWords,
    },
  };
}
