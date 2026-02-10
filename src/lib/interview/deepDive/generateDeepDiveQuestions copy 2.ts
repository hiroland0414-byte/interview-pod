// src/lib/interview/deepDive/generateDeepDiveQuestions.ts
import { RULES, type QuestionType, type Tone } from "./rules";
import { loadCsvFallback, type CsvFallbackRow } from "./loadCsvFallback";

export type MissingSignal =
  | "headline_missing"
  | "too_vague"
  | "no_specific_episode"
  | "no_numbers"
  | "no_result"
  | "no_reflection"
  | "no_transfer"
  | "why_here_weak"
  | "future_weak"
  | "action_weak";

export type GenerateInput = {
  type: QuestionType;
  tone: Tone;
  answer: string;
  missingSignals?: MissingSignal[];
  maxQuestions?: number; // ※このファイルでは「直撃2 + ルール1」に固定するため実質 3
};

const uniq = (arr: string[]) => Array.from(new Set(arr)).filter(Boolean);

// -----------------------------
// 0) 小さめ正規化（やりすぎない）
// - 文字ゆれを少しだけ吸収
// - 形態素解析はしない
// -----------------------------
function normalizeAnswerSmall(raw: string): string {
  let s = (raw || "").trim();

  // よくある表記ゆれ（最低限）
  s = s.replace(/コミュケーション/g, "コミュニケーション");
  s = s.replace(/ｺﾐｭﾆｹｰｼｮﾝ/g, "コミュニケーション");

  // 全角英数→半角（軽く）
  s = s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
  s = s.replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

  // 余分な空白を詰める（完全消しはしない）
  s = s.replace(/\s+/g, " ");

  return s;
}

function containsAny(answer: string, keywords: string[]) {
  const a = answer || "";
  return keywords.some((k) => k && a.includes(k));
}

// 否定・課題っぽい言い回し（誤爆抑制に使う）
function hasNegativeContext(answer: string): boolean {
  const t = answer || "";
  return /(苦手|できない|不得意|課題|不安|弱み|改善したい|まだ|不足|難しい)/.test(t);
}

// -----------------------------
// 直撃ワード設計（少数・運用しやすい）
// 「概念」→ 同義語（synonym）
// -----------------------------
type DirectConcept =
  | "communication"
  | "contribution"
  | "philosophy"
  | "equipment"
  | "service"
  | "practice_visit"
  | "growth"
  | "team_medical";

const DIRECT_SYNONYMS: Record<DirectConcept, string[]> = {
  communication: [
    "コミュニケーション",
    "コミュ力",
    "対人",
    "傾聴",
    "報連相",
    "説明",
    "共有",
    "調整",
    "連携",
  ],
  contribution: ["貢献", "役に立", "支え", "力にな", "助け", "寄与", "還元"],
  philosophy: ["理念", "基本方針", "方針", "大切に", "価値観"],
  equipment: ["設備", "機器", "装置", "モダリティ", "CT", "MRI", "X線", "マンモ", "超音波"],
  service: ["接遇", "患者対応", "対応力", "説明", "安心", "配慮"],
  practice_visit: ["実習", "臨床実習", "見学", "説明会", "体験", "現場を見", "見て感じ"],
  growth: ["成長", "学ぶ", "伸ば", "磨き", "高め", "身につけ"],
  team_medical: ["チーム医療", "多職種連携", "連携", "協働", "チーム", "カンファレンス"],
};

// 「文章に含まれる概念」を最大2つ拾う
function detectDirectConcepts(answer: string): DirectConcept[] {
  const hits: DirectConcept[] = [];
  const order: DirectConcept[] = [
    // ここは “よく拾いたい順” に並べてOK（並び順＝優先度）
    "communication",
    "contribution",
    "team_medical",
    "philosophy",
    "service",
    "equipment",
    "practice_visit",
    "growth",
  ];

  for (const c of order) {
    if (containsAny(answer, DIRECT_SYNONYMS[c])) hits.push(c);
    if (hits.length >= 2) break;
  }
  return hits;
}

// 概念ごとの「直撃質問」：typeに応じて少し言い分け
function buildDirectQuestion(type: QuestionType, concept: DirectConcept, negative: boolean): string {
  // negative=true のときは「できている前提」を避ける（誤爆抑制）
  const soften = (okText: string, negText: string) => (negative ? negText : okText);

  switch (concept) {
    case "communication":
      return soften(
        "コミュニケーション力が強みとのことですが、具体的に「誰に・何を・どう伝えて」相手の行動（または状況）がどう変わりましたか？",
        "コミュニケーションが課題だと感じる場面はどこですか？その場面で、次に試したい工夫を1つだけ挙げてください。"
      );

    case "contribution":
      if (type === "motivation") {
        return soften(
          "「貢献したい」とありますが、貴院（貴施設）で“最初の3か月”に何をして貢献する想定ですか？業務レベルで1つに絞ってください。",
          "「貢献」を言葉で終わらせないために、入職後に最初に身につけるべきことは何だと思いますか？1つだけ挙げてください。"
        );
      }
      return soften(
        "「貢献」をあなたの行動に落とすと、どんな場面で何をして周りを支えられますか？具体例を1つください。",
        "「貢献」が難しいと感じるのはどんな時ですか？その時の改善策を1つだけ挙げてください。"
      );

    case "team_medical":
      return soften(
        "チーム医療（多職種連携）を意識した経験があれば、あなたの役割と「連携のためにした一言/行動」を具体的に教えてください。",
        "チーム医療（多職種連携）で難しそうだと感じる点は何ですか？その不安を減らすために今できる準備を1つ挙げてください。"
      );

    case "philosophy":
      return soften(
        "理念（方針）に共感したとのことですが、その理念が「現場の行動」で表れていると感じた場面を1つ挙げてください。",
        "理念（方針）への共感がまだ曖昧なら、どの情報を見れば判断できますか？確認したい項目を1つ挙げてください。"
      );

    case "equipment":
      return soften(
        "設備・モダリティに触れていますが、特に惹かれた点は「何ができるから」でしたか？患者さん側のメリットまで言語化してください。",
        "設備・モダリティの理解がまだ浅いと感じるなら、まず何を調べる（確認する）べきですか？1つ挙げてください。"
      );

    case "service":
      return soften(
        "接遇（患者対応）であなたが大切にしていることは何ですか？それを守るための具体行動を1つ教えてください。",
        "接遇（患者対応）で苦手になりやすい場面はどこですか？その場面での改善策を1つだけ挙げてください。"
      );

    case "practice_visit":
      return soften(
        "実習/見学で印象に残った出来事を1つ挙げてください。そこで「自分が学んだこと」は何でしたか？",
        "実習/見学の学びを言葉にするのが難しいなら、まず「何を見て・何を感じたか」を1つだけ挙げてください。"
      );

    case "growth":
      return soften(
        "成長したいとのことですが、今の自分に足りない要素を1つ挙げ、その差を埋めるために具体的に何をしますか？",
        "成長の方向性が曖昧なら、まず「できるようになりたい業務/スキル」を1つだけ挙げてください。"
      );

    default:
      return "もう少し具体的に、状況→行動→結果の流れで教えてください。";
  }
}

function pickKeywordDirectQuestions(type: QuestionType, answer: string): string[] {
  const neg = hasNegativeContext(answer);
  const concepts = detectDirectConcepts(answer);

  const qs = concepts.map((c) => buildDirectQuestion(type, c, neg));
  return uniq(qs).slice(0, 2);
}

// -----------------------------
// ルールベース（MissingSignal）
// ※「直撃2問＋ルール1問」固定のため最大1問だけ使う
// -----------------------------
function pickRuleBasedOne(
  type: QuestionType,
  tone: Tone,
  missingSignals: MissingSignal[]
): string | null {
  const t = RULES[type].templates;

  const mapped: Array<{ sig: MissingSignal; q: string }> = missingSignals.map((s) => {
    if (s === "headline_missing") {
      return { sig: s, q: "最初に結論を一文で。『私の強みは〇〇です』の形で言い切ってください。" };
    }
    if (s === "too_vague") {
      return { sig: s, q: "抽象的なので具体化します。『それは具体的に何をしたこと？』を一つだけ挙げてください。" };
    }
    if (s === "no_specific_episode") return { sig: s, q: t.askAction(tone) };
    if (s === "no_numbers") return { sig: s, q: t.askNumbers(tone) };
    if (s === "no_result") return { sig: s, q: t.askResult(tone) };
    if (s === "no_reflection") return { sig: s, q: t.askReflection(tone) };
    if (s === "no_transfer") return { sig: s, q: t.askTransfer(tone) };
    if (s === "why_here_weak") return { sig: s, q: t.askWhyHere(tone) };
    if (s === "future_weak") return { sig: s, q: t.askFuture(tone) };
    if (s === "action_weak") return { sig: s, q: t.askAction(tone) };
    return { sig: s, q: "" };
  });

  // 優先順（ここも“出したい順”でOK）
  const priority: MissingSignal[] = [
    "headline_missing",
    "why_here_weak",
    "no_specific_episode",
    "no_numbers",
    "no_result",
    "no_reflection",
    "no_transfer",
    "future_weak",
    "too_vague",
    "action_weak",
  ];

  for (const p of priority) {
    const hit = mapped.find((m) => m.sig === p && m.q);
    if (hit?.q) return hit.q;
  }

  // missingSignals が空なら type 固有の最低1問（ただし直撃が2問出てるなら無理に追加しない）
  if (type === "motivation") return t.askWhyHere(tone);
  if (type === "self_pr") return "自己PRを一文で言い切るなら何ですか？（『私の強みは〇〇です』）";
  return t.askChallenge(tone);
}

// -----------------------------
// CSV fallback（保険）
// ※「直撃2問＋ルール1問」固定なので、原則ここは使わない想定。
// ただし直撃が0で、ルールも弱い場合の“保険”に残しておく。
// -----------------------------
function scoreCsvRows(rows: CsvFallbackRow[], answer: string): CsvFallbackRow[] {
  // タグ別ボーナス（最低限。やりすぎない）
  const bonusMap: Record<string, string[]> = {
    detail: ["コミュニケーション", "コミュ力", "傾聴", "報連相", "説明", "接遇", "患者対応", "連携"],
    role: ["貢献", "役に立", "支え", "入職後", "現場", "業務"],
    fit: ["理念", "方針", "基本方針", "地域医療", "チーム医療", "多職種連携", "救急", "健診"],
    experience: ["実習", "臨床実習", "見学", "説明会", "体験"],
    growth: ["成長", "学び", "伸ば", "身につけ"],
    equipment: ["設備", "機器", "装置", "モダリティ", "CT", "MRI"],
  };

  return rows
    .map((r) => {
      const kws = bonusMap[r.tag] || [];
      const bonus = containsAny(answer, kws) ? 2 : 0;
      return { ...r, priority: r.priority + bonus };
    })
    .sort((a, b) => b.priority - a.priority);
}

// -----------------------------
// main
// 「直撃2問＋ルール1問」固定
// -----------------------------
export async function generateDeepDiveQuestions(input: GenerateInput): Promise<string[]> {
  const answerRaw = (input.answer || "").trim();
  const answer = normalizeAnswerSmall(answerRaw);

  const missingSignals: MissingSignal[] = Array.isArray(input.missingSignals)
    ? input.missingSignals
    : [];

  const out: string[] = [];

  // 0) 直撃（最大2問）
  const directQs = pickKeywordDirectQuestions(input.type, answer);
  for (const q of directQs) {
    if (out.length >= 2) break;
    if (!out.includes(q)) out.push(q);
  }

  // 1) ルール（1問）
  const ruleOne = pickRuleBasedOne(input.type, input.tone, missingSignals);
  if (ruleOne && !out.includes(ruleOne)) out.push(ruleOne);

  // ここで「直撃2 + ルール1」を基本形として完成
  if (out.length >= 3) return out.slice(0, 3);

  // 2) 保険：CSV（本来は出ない想定だが、直撃が0などの時に埋める）
  const all = await loadCsvFallback();
  const pool = all.filter((r) => r.type === input.type);
  const scored = scoreCsvRows(pool, answer);

  for (const r of scored) {
    if (out.length >= 3) break;
    const q = (r.question || "").trim();
    if (!q) continue;
    if (!out.includes(q)) out.push(q);
  }

  return out.slice(0, 3);
}
