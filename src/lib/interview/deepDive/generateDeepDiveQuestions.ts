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

  // 呼び出し側が渡さない場合は空配列扱いで安全に動く
  missingSignals?: MissingSignal[];

  // ※残してOK（将来の拡張用）。ただし現仕様は「直撃2＋ルール1」で固定。
  maxQuestions?: number;
};

const uniq = (arr: string[]) => Array.from(new Set(arr)).filter(Boolean);

function normalizeText(s: string) {
  return (s || "")
    .replace(/\s+/g, "")
    .replace(/[！!？?。、・「」『』（）()\[\]【】]/g, "")
    .toLowerCase();
}

/** 文字列が “そのまま含まれる” か（現状は contains。将来は形態素や正規化に置換可） */
function containsAny(answer: string, keywords: string[]) {
  const a = answer || "";
  return keywords.some((k) => k && a.includes(k));
}

/** どのキーワードに当たったか（直撃用） */
function hitKeywords(answer: string, keywords: string[]) {
  const a = answer || "";
  return keywords.filter((k) => k && a.includes(k));
}

/** 直撃キーワード定義（ここが「拾いたいワードを絞る」本丸） */
const DIRECT_KEYWORDS = {
  // 志望動機寄り（motivationで強く効かせたい）
  motivation: {
    // “ここ”の決め手に繋がる
    philosophy: ["理念", "方針", "基本方針", "ミッション", "ビジョン"],
    contribution: ["貢献", "役に立", "支え", "力にな", "寄り添"],
    teamCare: ["チーム医療", "多職種連携", "連携", "カンファ", "チーム"],
    equipment: ["設備", "モダリティ", "CT", "MRI", "救急", "治療", "健診"],
    training: ["教育", "研修", "新人教育", "OJT", "育成"],
    courtesy: ["接遇", "患者対応", "説明", "傾聴"],
    practice: ["実習", "臨床実習", "見学", "説明会", "体験"],
    growth: ["成長", "学ぶ", "学び", "挑戦"],
  },

  // 自己PR寄り（self_prで強く効かせたい）
  self_pr: {
    communication: ["コミュニケーション", "報連相", "傾聴", "説明", "調整", "共有"],
    courtesy: ["接遇", "患者対応"],
    growth: ["成長", "学ぶ", "改善", "工夫", "試行錯誤"],
    teamwork: ["チーム", "連携", "協働", "多職種連携", "チーム医療"],
    responsibility: ["責任感", "誠実", "丁寧", "正確", "安全"],
    practice: ["実習", "臨床実習", "見学", "アルバイト", "ボランティア"],
  },

  // ガクチカ寄り（gakuchikaで強く効かせたい）
  gakuchika: {
    teamwork: ["チーム", "連携", "協働", "チーム医療", "多職種連携"],
    ingenuity: ["工夫", "改善", "試行錯誤", "提案"],
    numbers: ["回", "ヶ月", "か月", "人", "%", "名", "件", "時間", "分"],
    practice: ["アルバイト", "ボランティア", "活動", "実習", "臨床実習"],
    communication: ["コミュニケーション", "報連相", "傾聴", "説明", "調整", "共有"],
    growth: ["学び", "気づき", "反省", "次は", "成長"],
  },
} as const;

/**
 * 直撃質問テンプレ（「拾ったワード」→「深掘り質問」）
 * - ここで“キーワードを拾ったら必ずこう聞く”を決める
 * - 直撃は最大2問
 */
function buildDirectQuestion(type: QuestionType, groupKey: string): string | null {
  // 志望動機
  if (type === "motivation") {
    if (groupKey === "philosophy")
      return "「理念／方針」に共感したとのことですが、あなたの経験のどの場面と重なりましたか？（1つ具体例）";
    if (groupKey === "contribution")
      return "「貢献したい」とありましたが、放射線技師として“何を、どう”改善・支援したいですか？（1つに絞って）";
    if (groupKey === "teamCare")
      return "「チーム医療（多職種連携）」を挙げた理由は？あなたがその中で意識したい役割を具体的に教えてください。";
    if (groupKey === "equipment")
      return "設備／モダリティ面に魅力を感じたとのことですが、どの検査・領域で、どんな価値が出ると思いましたか？";
    if (groupKey === "training")
      return "教育・研修が魅力とのことですが、入職後3か月で身につけたいことを“1つ”具体的に言えますか？";
    if (groupKey === "courtesy")
      return "患者対応（接遇）に触れていますが、あなたが大切にしたい説明・接し方は何ですか？（例を1つ）";
    if (groupKey === "practice")
      return "見学・実習で印象に残った場面を1つ挙げて、その出来事が志望動機にどう繋がりましたか？";
    if (groupKey === "growth")
      return "成長意欲が伝わります。では“成長のために今やっている準備”を1つだけ教えてください。";
  }

  // 自己PR
  if (type === "self_pr") {
    if (groupKey === "communication")
      return "「コミュニケーション」を強みとするなら、具体的に“何をした行動”が強みですか？（場面1つ）";
    if (groupKey === "courtesy")
      return "接遇（患者対応）で工夫している点を、言い回しレベルで1つ具体的に教えてください。";
    if (groupKey === "growth")
      return "「成長／改善」を強みにするなら、最近の“改善の1事例”をSTAR（状況→行動→結果）で教えてください。";
    if (groupKey === "teamwork")
      return "チームで動いた経験で、あなたが担った役割と、衝突・ズレをどう調整したかを教えてください。";
    if (groupKey === "responsibility")
      return "責任感・誠実さを示すなら、ミス予防や安全のためにやっている“具体行動”を1つ教えてください。";
    if (groupKey === "practice")
      return "実習やアルバイトで強みが出た場面を1つ挙げ、周囲にどんな良い影響が出ましたか？";
  }

  // ガクチカ
  if (type === "gakuchika") {
    if (groupKey === "teamwork")
      return "チームで取り組んだ経験で、最も難しかった点と、あなたが取った調整行動を教えてください。";
    if (groupKey === "ingenuity")
      return "工夫・改善を挙げていますが、工夫前後で何がどう変わりましたか？（結果も）";
    if (groupKey === "numbers")
      return "数字が出せるなら出してください（回数・期間・人数・達成率など）。出せないなら理由も。";
    if (groupKey === "practice")
      return "活動（実習/バイト/ボランティア）での“課題”を1つ挙げ、解決のために何をしましたか？";
    if (groupKey === "communication")
      return "コミュニケーションで困った場面を1つ挙げ、あなたの言動でどう改善しましたか？";
    if (groupKey === "growth")
      return "その経験で得た学びを、次に再現するなら何を変えますか？（改善点を1つ）";
  }

  return null;
}

/**
 * 直撃質問を “最大2問” 選ぶ
 * - どのキーワード群に当たったかを見て、上から順に採用
 * - 同じ質問が重ならないように
 */
function pickKeywordDirectQuestions(type: QuestionType, answer: string): string[] {
  const src =
    type === "motivation"
      ? DIRECT_KEYWORDS.motivation
      : type === "self_pr"
        ? DIRECT_KEYWORDS.self_pr
        : DIRECT_KEYWORDS.gakuchika;

  // 優先順位：ここが「並び順の設計」になる（上ほど強い）
  const priorityKeys =
    type === "motivation"
      ? ([
          "teamCare",
          "contribution",
          "philosophy",
          "equipment",
          "training",
          "courtesy",
          "practice",
          "growth",
        ] as const)
      : type === "self_pr"
        ? (["communication", "teamwork", "courtesy", "responsibility", "growth", "practice"] as const)
        : (["teamwork", "ingenuity", "communication", "numbers", "practice", "growth"] as const);

  const picked: string[] = [];
  const usedQ = new Set<string>();

  for (const key of priorityKeys) {
    const kws = (src as any)[key] as string[];
    if (!kws || kws.length === 0) continue;

    const hits = hitKeywords(answer, kws);
    if (hits.length === 0) continue;

    const q = buildDirectQuestion(type, String(key));
    if (!q) continue;

    const nq = normalizeText(q);
    if (usedQ.has(nq)) continue;

    picked.push(q);
    usedQ.add(nq);

    if (picked.length >= 2) break;
  }

  return picked;
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
      out.push("抽象的なので具体化します。『それは具体的に何をしたこと？』を一つだけ挙げてください。");
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
    else if (type === "self_pr") out.push("自己PRを一文で言い切るなら何ですか？（『私の強みは〇〇です』）");
    else out.push(t.askChallenge(tone));
  }

  return uniq(out).slice(0, 3);
}

/**
 * CSV fallback の並びを少し寄せる（採点ではなく“優先候補の並べ替え”）
 * - 本アプリが採点しないのは正しい
 * - ただ、CSVから取る時に「文章に関係あるものを先に」出すのはUX的に有利
 */
function scoreCsvRows(rows: CsvFallbackRow[], answer: string): CsvFallbackRow[] {
  // ※ tag は deep_dive_fallback.csv に依存（未知tagはbonusなしで素通し）
  const bonusMap: Record<string, string[]> = {
    // 志望動機の核
    fit: ["理念", "方針", "患者", "安全", "教育", "研修", "設備", "モダリティ", "救急", "治療", "健診", "地域", "チーム医療", "多職種連携"],
    role: ["貢献", "役に立", "支え", "入職後", "現場", "業務", "成長"],
    values: ["大切", "重視", "価値観", "誠実", "責任"],
    experience: ["実習", "臨床実習", "見学", "説明会", "体験", "経験", "きっかけ"],
    risk: ["不安", "課題", "弱み", "改善", "安全"],

    // 自己PRの核
    headline: ["私の強み", "強み", "得意", "持ち味"],
    evidence: ["具体", "例えば", "場面", "その時", "際に"],
    detail: ["コミュニケーション", "報連相", "説明", "傾聴", "調整", "共有", "接遇", "患者対応", "チーム医療"],
    transfer: ["活か", "貢献", "現場", "仕事", "入職後", "貴院", "御院", "貴施設", "御施設"],
    weakness: ["弱点", "裏目", "注意", "苦手"],

    // ガクチカ汎用
    star: ["状況", "目標", "行動", "結果", "取り組み", "活動", "アルバイト", "ボランティア"],
    numbers: ["回", "ヶ月", "か月", "人", "%", "名", "件", "時間", "分"],
    ingenuity: ["工夫", "改善", "試行錯誤", "提案"],
    reflection: ["学び", "反省", "気づき", "次は"],
  };

  return rows
    .map((r) => {
      const kws = bonusMap[r.tag] || [];
      const bonus = containsAny(answer, kws) ? 2 : 0;
      return { ...r, priority: r.priority + bonus };
    })
    .sort((a, b) => b.priority - a.priority);
}

/**
 * 仕様：必ず「直撃2問＋ルール1問」固定（合計3問）
 * - 直撃が0〜2問
 * - ルールは必ず1問（重複しそうなら別候補にスライド）
 * - それでも不足する場合だけ CSV で埋める
 */
export async function generateDeepDiveQuestions(input: GenerateInput): Promise<string[]> {
  const answer = (input.answer || "").trim();

  // 固定：最終3問
  const FINAL_MAX = 3;

  const out: string[] = [];

  // ① 直撃（最大2問）
  const directQs = pickKeywordDirectQuestions(input.type, answer);
  for (const q of directQs) {
    if (out.length >= 2) break;
    if (!out.includes(q)) out.push(q);
  }

  // ② ルール（必ず1問）
  const missingSignals: MissingSignal[] = Array.isArray(input.missingSignals) ? input.missingSignals : [];
  const ruleCandidates = pickRuleBased(input.type, input.tone, missingSignals);

  // outと被らない最初の1問を採用（被るなら次にスライド）
  let rulePicked: string | null = null;
  for (const q of ruleCandidates) {
    if (!q) continue;
    if (!out.includes(q)) {
      rulePicked = q;
      break;
    }
  }
  if (!rulePicked && ruleCandidates[0]) rulePicked = ruleCandidates[0];

  if (rulePicked && !out.includes(rulePicked)) out.push(rulePicked);

  if (out.length >= FINAL_MAX) return out.slice(0, FINAL_MAX);

  // ③ CSV（保険）
  const all = await loadCsvFallback();
  const pool = all.filter((r) => r.type === input.type);
  const scored = scoreCsvRows(pool, answer);

  for (const r of scored) {
    if (out.length >= FINAL_MAX) break;
    const q = (r.question || "").trim();
    if (!q) continue;
    if (!out.includes(q)) out.push(q);
  }

  return out.slice(0, FINAL_MAX);
}
