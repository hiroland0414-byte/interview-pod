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

  /**
   * ⚙️ このファイルは「直撃2問＋ルール1問」を基本にしたいので
   * 既定は 3 を推奨（= 2 + 1）。
   * 足りない場合は CSV fallback で埋める（空っぽ回避）。
   */
  maxQuestions?: number; // 既定 3
};

const uniq = (arr: string[]) => Array.from(new Set(arr)).filter(Boolean);

function containsAny(answer: string, keywords: string[]) {
  const a = answer || "";
  return keywords.some((k) => k && a.includes(k));
}

/** 軽い正規化：全角→半角/小文字化/記号除去/空白つぶし */
function normalizeForMatch(s: string) {
  const raw = (s ?? "").toString();

  // ざっくり全角英数→半角（日本語はそのまま）
  const z2h = raw.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );

  return z2h
    .toLowerCase()
    .replace(/\s+/g, "") // すべての空白を除去
    .replace(/[！!？?。、・「」『』（）()\[\]【】{}<>:;'"“”‘’]/g, "")
    .replace(/ー+/g, "ー"); // 伸ばし棒をざっくり統一
}

type DirectConcept =
  | "communication"
  | "contribution"
  | "philosophy"
  | "equipment"
  | "service"
  | "practice_visit"
  | "growth"
  | "team_medical";

/**
 * ✅ synonym は「CSVに寄せる」ではなく「直撃ルール側」にも持たせる
 * - 学生が言いがちな表現をここで吸収
 */
const DIRECT_SYNONYMS: Record<DirectConcept, string[]> = {
  communication: [
    "コミュニケーション",
    "コミュニケーション力",
    "コミュ力",
    "対話",
    "会話",
    "傾聴",
    "聞く力",
    "説明",
    "説明力",
    "報連相",
    "連携",
    "共有",
    "調整",
    "関係構築",
  ],
  contribution: ["貢献", "役に立", "支え", "支援", "力になりたい", "寄与", "貢献したい", "尽力"],
  philosophy: ["理念", "方針", "基本方針", "使命", "ビジョン", "価値観", "大切", "重視"],
  equipment: ["設備", "装置", "機器", "モダリティ", "ct", "mri", "マンモ", "核医学", "透視", "血管造影"],
  service: ["接遇", "患者対応", "患者さん対応", "対応力", "配慮", "寄り添", "説明", "安心", "丁寧"],
  practice_visit: ["実習", "臨床実習", "見学", "病院見学", "説明会", "インターン", "体験", "シャドーイング"],
  growth: ["成長", "学ぶ", "学び", "伸び", "向上", "改善", "上達", "鍛え", "身につ"],
  team_medical: [
    "チーム医療",
    "多職種連携",
    "多職種",
    "連携",
    "協働",
    "カンファレンス",
    "チーム",
    "医師",
    "看護師",
    "他職種",
  ],
};

/** 直撃概念の優先順（迷ったらこの順で拾う） */
const DIRECT_PRIORITY: DirectConcept[] = [
  "communication",
  "team_medical",
  "contribution",
  "philosophy",
  "service",
  "equipment",
  "practice_visit",
  "growth",
];

/**
 * 概念ごとの「直撃質問」2本セット
 * - type によって言い回しを最適化
 */
const DIRECT_QUESTIONS: Record<QuestionType, Record<DirectConcept, [string, string]>> = {
  self_pr: {
    communication: [
      "『コミュニケーション力』を、面接官がイメージできるように具体化してください。どんな相手に、何を、どう伝えて、どう調整しましたか？",
      "そのコミュニケーション力が発揮された“1つの場面”を選んで、あなたの行動→相手の反応→結果の順に話してください。",
    ],
    team_medical: [
      "多職種（医師・看護師など）と関わった場面で、あなたが意識したことは何ですか？（情報共有・確認・言い方など）",
      "チームで動く時に起きやすいズレ（認識違い等）を、あなたはどう防ぎますか？具体例で教えてください。",
    ],
    contribution: [
      "『貢献』をあなたの言葉で分解してください。入職後、具体的に“何を増やす/減らす/守る”貢献ですか？",
      "貢献の根拠となる経験は何ですか？同じ状況で再現できる行動として説明してください。",
    ],
    philosophy: [
      "理念（方針）に共感した、という点を“あなたの経験”と結びつけて説明できますか？どこが重なりましたか？",
      "理念を現場で実践するために、あなたが普段から意識している行動はありますか？",
    ],
    service: [
      "接遇（患者対応）であなたが大切にしていることを1つ挙げ、実際にやっている工夫を教えてください。",
      "患者さんが不安な時に、あなたは何を最初に確認し、どんな言葉を選びますか？",
    ],
    equipment: [
      "設備（モダリティ）に触れた経験があるなら、何を学び、どこが難しいと感じましたか？",
      "装置・検査の安全面で、あなたが特に注意したい点は何ですか？",
    ],
    practice_visit: [
      "実習/見学で“印象に残った出来事”を1つ挙げ、そこであなたが学んだことを教えてください。",
      "実習/見学で気づいた課題（自分の不足）を、今どう埋めようとしていますか？",
    ],
    growth: [
      "成長したと言える“指標”は何ですか？（できるようになったこと・回数・期間など）",
      "次に伸ばしたい点は何ですか？そのために取る行動を1つ決めてください。",
    ],
  },

  motivation: {
    communication: [
      "応募先で求められるコミュニケーションは誰相手だと思いますか？（患者さん/多職種など）それに向けて準備していることは？",
      "コミュニケーションで“うまくいかなかった経験”があれば、どう改善しましたか？それが仕事にどう活きますか？",
    ],
    team_medical: [
      "貴院のチーム医療（多職種連携）に惹かれた点を、具体的な場面（実習/見学など）で説明できますか？",
      "あなたがチーム医療の中で担いたい役割は何ですか？（情報共有/安全/患者説明など）",
    ],
    contribution: [
      "『貢献したい』を具体化してください。貴院のどの領域（救急/健診/治療など）で、何を改善したいですか？",
      "その貢献を裏づける行動（調べた/見学/実習で確認した等）は何ですか？",
    ],
    philosophy: [
      "理念（方針）のどの一文が決め手でしたか？それが“あなたの価値観”とどう一致していますか？",
      "理念を実現するために、入職後最初の3か月で何を意識して行動しますか？",
    ],
    service: [
      "接遇（患者対応）を重視する理由を、あなたの経験と結びつけて説明できますか？",
      "患者さんの不安を減らすために、あなたができる具体行動を1つ挙げてください。",
    ],
    equipment: [
      "設備（モダリティ）に惹かれたなら、何を調べ、どこが魅力だと判断しましたか？",
      "その設備環境で、あなたはどんな力を伸ばし、どう貢献したいですか？",
    ],
    practice_visit: [
      "見学/実習で見た“現場の雰囲気”を、あなたの言葉で具体的に説明してください（誰がどう動いていた？）。",
      "見学/実習で感じた課題や気づきを、志望動機にどう反映しましたか？",
    ],
    growth: [
      "成長したい領域を1つに絞ってください。貴院でどんな経験を積むと成長できると考えましたか？",
      "成長のために、今すでに始めている準備はありますか？（勉強/練習/見学など）",
    ],
  },

  gakuchika: {
    communication: [
      "コミュニケーションが鍵だった出来事を1つ選び、あなたの工夫（言い方/順序/確認）を具体的に教えてください。",
      "相手（メンバー/顧客など）が動きやすくなるように、あなたがした“調整”は何ですか？",
    ],
    team_medical: [
      "チームで動いた経験で、役割分担や連携をうまく回すためにあなたがしたことは何ですか？",
      "意見が割れた時、あなたはどう合意形成しましたか？（事実→選択肢→決定の流れ）",
    ],
    contribution: [
      "周囲への貢献（役に立ったこと）を、具体的な成果として説明できますか？誰がどう助かりましたか？",
      "あなたの貢献を再現するために必要な行動は何ですか？（手順として）",
    ],
    philosophy: [
      "その活動で大切にしていた価値観は何ですか？それが行動にどう表れましたか？",
      "価値観が試された瞬間（迷い/葛藤）があれば、どう判断しましたか？",
    ],
    service: [
      "接遇（相手配慮）が必要だった場面で、あなたが気をつけた言葉・態度を具体的に教えてください。",
      "相手の不安や不満をどう拾い、どう解消しましたか？",
    ],
    equipment: [
      "道具/設備/環境に制約がある中で、工夫した点はありますか？（代替策/手順）",
      "安全や品質を守るために、あなたが徹底したルールは何ですか？",
    ],
    practice_visit: [
      "実習/見学/体験で一番学びが大きかった出来事を1つ挙げてください。何が変わりましたか？",
      "その経験を次に活かすなら、同じ状況で何を先に準備しますか？",
    ],
    growth: [
      "成長した点を1つに絞ってください。どの行動が成長の原因でしたか？",
      "次に伸ばすための課題は何ですか？その課題に対して取った工夫を教えてください。",
    ],
  },
};

function pickRuleBasedOne(
  type: QuestionType,
  tone: Tone,
  missingSignals: MissingSignal[]
): string | null {
  const t = RULES[type].templates;

  // missingSignals の優先度に沿って「1問だけ」選ぶ
  for (const s of missingSignals) {
    if (s === "headline_missing") return "最初に結論を一文で。『私の強みは〇〇です』の形で言い切ってください。";
    if (s === "too_vague")
      return "抽象的なので具体化します。『それは具体的に何をしたこと？』を一つだけ挙げてください。";
    if (s === "no_specific_episode") return t.askAction(tone);
    if (s === "no_numbers") return t.askNumbers(tone);
    if (s === "no_result") return t.askResult(tone);
    if (s === "no_reflection") return t.askReflection(tone);
    if (s === "no_transfer") return t.askTransfer(tone);
    if (s === "why_here_weak") return t.askWhyHere(tone);
    if (s === "future_weak") return t.askFuture(tone);
    if (s === "action_weak") return t.askAction(tone);
  }

  // 何も無ければ type 固有の最低1問
  if (type === "motivation") return t.askWhyHere(tone);
  if (type === "self_pr") return "自己PRを一文で言い切るなら何ですか？（『私の強みは〇〇です』）";
  return t.askChallenge(tone);
}

/**
 * ✅ 直撃：回答文から概念を判定し、その概念に対応する「直撃質問」を最大2問返す
 * - "コミュニケーション力" のような言い回しも拾える（正規化＋synonyms）
 */
export function pickKeywordDirectQuestion(type: QuestionType, answer: string): string[] {
  const norm = normalizeForMatch(answer);
  if (!norm) return [];

  const hits: DirectConcept[] = [];

  for (const concept of Object.keys(DIRECT_SYNONYMS) as DirectConcept[]) {
    const syns = DIRECT_SYNONYMS[concept];
    for (const s of syns) {
      const sn = normalizeForMatch(s);
      if (sn && norm.includes(sn)) {
        hits.push(concept);
        break;
      }
    }
  }

  if (hits.length === 0) return [];

  // 優先順で整列（同一は1回）
  const uniqHits = Array.from(new Set(hits));
  const sorted = DIRECT_PRIORITY.filter((c) => uniqHits.includes(c));

  // まず最優先の概念を採用
  const top = sorted[0];
  const pair = DIRECT_QUESTIONS[type]?.[top];
  if (!pair) return [];

  // 直撃は「最大2問」：同一概念の2本セットを返す
  return [pair[0], pair[1]].filter(Boolean).slice(0, 2);
}

function scoreCsvRows(rows: CsvFallbackRow[], answer: string): CsvFallbackRow[] {
  // CSV保険の並び替えだけに使う「軽量ブースト」
  // ※採点ではなく“優先順位の微調整”目的（壊れにくい）
  const bonusMap: Record<string, string[]> = {
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
      "ct",
      "mri",
      "救急",
      "治療",
      "健診",
      "地域医療",
      "チーム医療",
      "多職種連携",
    ],
    role: ["貢献", "役に立", "支え", "入職後", "現場", "業務", "成長"],
    values: ["大切", "重視", "価値観", "誠実", "責任"],
    experience: ["実習", "臨床実習", "見学", "説明会", "体験", "経験", "きっかけ"],
    risk: ["不安", "課題", "弱み", "改善"],

    headline: ["私の強み", "強み", "得意", "持ち味"],
    evidence: ["具体", "例えば", "場面", "その時", "際に"],
    detail: ["コミュニケーション", "説明", "傾聴", "報連相", "調整", "接遇", "患者対応"],
    transfer: ["活か", "貢献", "現場", "仕事", "入職後", "貴院", "御院", "貴施設", "御施設"],
    weakness: ["弱点", "裏目", "注意", "苦手"],

    star: ["状況", "目標", "行動", "結果", "取り組み", "活動", "アルバイト", "ボランティア"],
    numbers: ["回", "ヶ月", "か月", "人", "%", "名", "件", "時間", "分"],
    ingenuity: ["工夫", "改善", "試行錯誤", "提案"],
    reflection: ["学び", "反省", "気づき", "次は"],
  };

  const a = normalizeForMatch(answer);

  return rows
    .map((r) => {
      const kws = bonusMap[r.tag] || [];
      const bonus =
        kws.some((k) => {
          const kn = normalizeForMatch(k);
          return kn && a.includes(kn);
        })
          ? 2
          : 0;
      return { ...r, priority: r.priority + bonus };
    })
    .sort((a, b) => b.priority - a.priority);
}

export async function generateDeepDiveQuestions(input: GenerateInput): Promise<string[]> {
  const maxQ = input.maxQuestions ?? 3;
  const answer = (input.answer || "").trim();

  const missingSignals: MissingSignal[] = Array.isArray(input.missingSignals)
    ? input.missingSignals
    : [];

  const out: string[] = [];

  // 0) 直撃2問（固定：最大2）
  const directQs = pickKeywordDirectQuestion(input.type, answer);
  for (const q of directQs) {
    if (out.length >= maxQ) break;
    if (!out.includes(q)) out.push(q);
  }

  // 1) ルール1問（固定：最大1）
  if (out.length < maxQ) {
    const rule1 = pickRuleBasedOne(input.type, input.tone, missingSignals);
    if (rule1 && !out.includes(rule1)) out.push(rule1);
  }

  // 2) 足りない分だけ CSV fallback（空っぽ回避）
  if (out.length < maxQ) {
    const all = await loadCsvFallback();
    const pool = all.filter((r) => r.type === input.type);
    const scored = scoreCsvRows(pool, answer);

    for (const r of scored) {
      if (out.length >= maxQ) break;
      const q = (r.question || "").trim();
      if (!q) continue;
      if (!out.includes(q)) out.push(q);
    }
  }

  return out.slice(0, maxQ);
}
