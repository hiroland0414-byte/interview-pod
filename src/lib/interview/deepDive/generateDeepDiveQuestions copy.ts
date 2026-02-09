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
    fit: ["理念", "方針", "チーム", "患者", "安全", "教育","設備","モダリティ","救急","治療"],
    role: ["貢献", "役に立", "支え", "学ぶ", "成長","地域"],
    values: ["大切", "重視", "価値観"],
    experience: ["経験", "きっかけ", "実習", "見学"],
    risk: ["不安", "課題", "弱み", "改善","安全"],

    headline: ["強み", "私の強み", "得意","積極"],
    evidence: ["具体", "例えば", "場面"],
    detail: ["コミュニケーション", "調整", "説明", "傾聴","議論"],
    transfer: ["活か", "現場", "仕事"],
    weakness: ["弱点", "裏目", "注意"],

    star: ["状況", "目標", "行動", "結果","活動","アルバイト,”ボランティア"],
    numbers: ["回", "ヶ月", "か月", "人", "%", "名", "件"],
    ingenuity: ["工夫", "改善", "試行錯誤","適切"],
    reflection: ["反省", "学び", "次は","身に","経験"],
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
