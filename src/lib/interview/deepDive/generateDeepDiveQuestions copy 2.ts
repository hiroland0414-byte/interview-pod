// src/lib/interview/deepDive/generateDeepDiveQuestions.ts
import { RULES, type QuestionType, type Tone } from "./rules";
import { loadCsvFallback, type CsvFallbackRow } from "./loadCsvFallback";

export type MissingSignal =
  | "headline_missing" // 自己PRの結論が先に無い
  | "too_vague" // 抽象的
  | "no_specific_episode" // 具体例不足
  | "no_numbers" // 数字不足
  | "no_result" // 結果不足
  | "no_reflection" // 学び・反省不足
  | "no_transfer" // 仕事への接続不足
  | "why_here_weak" // 志望動機の“ここ”が弱い
  | "future_weak" // 将来像/貢献が弱い
  | "action_weak"; // 行動が弱い

export type GenerateInput = {
  type: QuestionType;
  tone: Tone;
  answer: string;

  // ✅ ここが今回のポイント：必須 → 任意に変更
  // 呼び出し側が渡さない場合は空配列扱いで安全に動く
  missingSignals?: MissingSignal[];

  maxQuestions?: number; // 既定 3
};

const uniq = (arr: string[]) => Array.from(new Set(arr)).filter(Boolean);

function containsAny(answer: string, keywords: string[]) {
  const a = answer || "";
  return keywords.some((k) => k && a.includes(k));
}

function pickRuleBased(
  type: QuestionType,
  tone: Tone,
  missingSignals: MissingSignal[]
): string[] {
  const t = RULES[type].templates;
  const out: string[] = [];

  // 信号→質問の対応（最大3問）
  for (const s of missingSignals) {
    if (out.length >= 3) break;

    if (s === "headline_missing") {
      out.push("最初に結論を一文で。『私の強みは〇〇です』の形で言い切ってください。");
    } else if (s === "too_vague") {
      out.push(
        "抽象的なので具体化します。『それは具体的に何をしたこと？』を一つだけ挙げてください。"
      );
    } else if (s === "no_specific_episode") {
      out.push(t.askAction(tone));
    } else if (s === "no_numbers") {
      out.push(t.askNumbers(tone));
    } else if (s === "no_result") {
      out.push(t.askResult(tone));
    } else if (s === "no_reflection") {
      out.push(t.askReflection(tone));
    } else if (s === "no_transfer") {
      out.push(t.askTransfer(tone));
    } else if (s === "why_here_weak") {
      out.push(t.askWhyHere(tone));
    } else if (s === "future_weak") {
      out.push(t.askFuture(tone));
    } else if (s === "action_weak") {
      out.push(t.askAction(tone));
    }
  }

  // type固有：最低1問は確保（missingSignalsが空でも）
  if (out.length === 0) {
    if (type === "motivation") out.push(t.askWhyHere(tone));
    else if (type === "self_pr")
      out.push("自己PRを一文で言い切るなら何ですか？（『私の強みは〇〇です』）");
    else out.push(t.askChallenge(tone));
  }

  return uniq(out).slice(0, 3);
}

function scoreCsvRows(rows: CsvFallbackRow[], answer: string): CsvFallbackRow[] {
  // ざっくり“答えに含まれる単語”で軽く加点（安全で壊れにくい）
const bonusMap: Record<string, string[]> = {
  // 志望動機：施設・医療体制への理解
  fit: [
    "理念",
    "方針",
    "基本方針",
    "患者",
    "安全",
    "教育",
    "研修",
    "設備",
    "モダリティ",
    "CT",
    "MRI",
    "救急",
    "治療",
    "健診",
    "地域医療",
    "チーム医療",
    "多職種連携",
    "医師",
    "看護師",
    "他職種",
  ],

  // 仕事への貢献・役割意識
  role: [
    "貢献",
    "役に立",
    "支え",
    "入職後",
    "現場",
    "業務",
    "再現",
    "成長",
    "チーム",
  ],

  // 価値観・姿勢
  values: [
    "大切",
    "重視",
    "価値観",
    "姿勢",
    "誠実",
    "責任",
  ],

  // 経験の根拠
  experience: [
    "実習",
    "臨床実習",
    "見学",
    "説明会",
    "体験",
    "経験",
    "きっかけ",
  ],

  // 課題・リスク認識
  risk: [
    "不安",
    "課題",
    "弱み",
    "改善",
    "安全",
  ],

  // 自己PRの結論
  headline: [
    "私の強み",
    "強み",
    "得意",
    "持ち味",
  ],

  // 具体性のサイン
  evidence: [
    "具体",
    "例えば",
    "場面",
    "その時",
    "際に",
  ],

  // コミュニケーション／接遇（行動に落とせる語）
  detail: [
    "コミュニケーション",
    "報連相",
    "説明",
    "傾聴",
    "調整",
    "共有",
    "連携",
    "接遇",
    "患者対応",
    "チーム医療",
  ],

  // 仕事への接続ワード
  transfer: [
    "活か",
    "貢献",
    "現場",
    "仕事",
    "入職後",
    "貴院",
    "御院",
    "貴施設",
    "御施設",
  ],

  // 弱点の言語化
  weakness: [
    "弱点",
    "裏目",
    "注意",
    "苦手",
  ],

  // STAR構造を示す語
  star: [
    "状況",
    "目標",
    "行動",
    "結果",
    "取り組み",
    "活動",
    "アルバイト",
    "ボランティア",
  ],

  // 数字の合図
  numbers: [
    "回",
    "ヶ月",
    "か月",
    "人",
    "%",
    "名",
    "件",
    "時間",
    "分",
  ],

  // 工夫・改善
  ingenuity: [
    "工夫",
    "改善",
    "試行錯誤",
    "提案",
  ],

  // 振り返り・学び
  reflection: [
    "学び",
    "反省",
    "気づき",
    "次は",
  ],
};

  return rows
    .map((r) => {
      const kws = bonusMap[r.tag] || [];
      const bonus = containsAny(answer, kws) ? 2 : 0;
      return { ...r, priority: r.priority + bonus };
    })
    .sort((a, b) => b.priority - a.priority);
}

export async function generateDeepDiveQuestions(
  input: GenerateInput
): Promise<string[]> {
  const maxQ = input.maxQuestions ?? 3;
  const answer = (input.answer || "").trim();

  // ✅ missingSignals を必ず配列化（未指定でも落ちない）
  const missingSignals: MissingSignal[] = Array.isArray(input.missingSignals)
    ? input.missingSignals
    : [];

  // 1) ルールベース
  const ruleQs = pickRuleBased(input.type, input.tone, missingSignals);
  if (ruleQs.length >= maxQ) return ruleQs.slice(0, maxQ);

  // 2) CSV保険
  const all = await loadCsvFallback();
  const pool = all.filter((r) => r.type === input.type);

  const scored = scoreCsvRows(pool, answer);
  const csvQs = scored.map((r) => r.question);

  // ルールと重複しないように補完
  const merged = uniq([...ruleQs, ...csvQs]).slice(0, maxQ);
  return merged;
}
