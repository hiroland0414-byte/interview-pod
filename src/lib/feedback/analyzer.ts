// src/lib/feedback/analyzer.ts

export type ModeTag = "A1" | "A2" | "B" | "C";

export type QuestionCategory =
  | "motivation"   // 志望動機
  | "self_pr"      // 自己PR
  | "gakuchika"    // 学生時代に力を入れたこと
  | "vision"       // 将来像・キャリア
  | "teamwork"     // 協調性・チーム
  | "free";        // その他・フリー

export type QuestionItem = {
  id: string;
  text: string;
  core?: boolean;          // コア質問（200字以上を要求するなど）
  category?: QuestionCategory;
};

export type AnswerStats = {
  chars: number;              // 文字数
  sentences: number;          // 文の数（。！？などでざっくり判定）
  avgCharsPerSentence: number;// 1文あたりの文字数
  politeScore: number;        // 0〜1（敬語っぽい終わり方の割合）
  keywordHits: string[];      // 検出されたキーワード
};

export type AnswerFlags = {
  tooShort: boolean;          // 短すぎる（coreなら200未満など）
  veryLong: boolean;          // 長すぎる（600文字超など任意）
  noSentenceBreak: boolean;   // 80文字以上あるのに句点が少ない
  noPoliteness: boolean;      // 敬語終止がほぼない
  hasConcreteEpisode: boolean;// 「具体的なエピソードらしき語」があるか
};

export type AnswerAnalysis = {
  questionId: string;
  category?: QuestionCategory;
  stats: AnswerStats;
  flags: AnswerFlags;
};

export type SessionScores = {
  talkLength: number;        // 0〜100 話のボリューム
  structure: number;         // 0〜100 文の区切り・読みやすさ
  politeness: number;        // 0〜100 敬語度
  motivationDepth: number;   // 0〜100 志望動機の深さ（簡易）
};

export type SessionAnalysis = {
  mode: ModeTag;
  perAnswer: AnswerAnalysis[];
  scores: SessionScores;
};

// ---------------- 内部ユーティリティ ----------------

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// ざっくり文の分割
function splitSentences(text: string): string[] {
  const parts = text
    .split(/[。．！？!?\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts;
}

// 敬語っぽい終わり方をざっくり判定
const POLITE_ENDINGS = [
  "です",
  "ます",
  "でした",
  "ました",
  "でございます",
  "ございます",
  "しております",
  "いたします",
];

function calcPoliteScore(sentences: string[]): number {
  if (sentences.length === 0) return 0;
  let politeCount = 0;
  for (const s of sentences) {
    const end = s.slice(-6); // 語尾だけ見る
    if (POLITE_ENDINGS.some((e) => end.endsWith(e))) {
      politeCount++;
    }
  }
  return politeCount / sentences.length;
}

// カテゴリ別キーワード
const KEYWORDS: Record<QuestionCategory, string[]> = {
  motivation: [
    "志望",
    "きっかけ",
    "貴院",
    "貴施設",
    "貴社",
    "患者",
    "地域",
    "医療",
    "放射線",
    "看護",
    "健診",
    "予防",
  ],
  self_pr: [
    "強み",
    "長所",
    "短所",
    "粘り強",
    "継続",
    "計画性",
    "協調性",
    "責任感",
    "向上心",
    "主体性",
  ],
  gakuchika: [
    "学生時代",
    "部活",
    "サークル",
    "アルバイト",
    "実習",
    "ゼミ",
    "研究",
    "委員会",
    "文化祭",
    "勉強と両立",
  ],
  vision: [
    "将来",
    "キャリア",
    "目標",
    "ビジョン",
    "専門性",
    "成長",
    "挑戦",
    "ステップアップ",
  ],
  teamwork: [
    "チーム",
    "連携",
    "他職種",
    "コミュニケーション",
    "支え",
    "協力",
  ],
  free: [],
};

// 具体的エピソードらしさ
const EPISODE_HINTS = [
  "経験",
  "エピソード",
  "具体的",
  "とき",
  "時",
  "場面",
  "失敗",
  "成功",
  "工夫",
  "改善",
  "何度も",
  "一度目は",
  "二度目は",
  "三年生",
  "四年生",
  "高校",
  "大学",
  "アルバイト",
  "実習",
];

function detectKeywordHits(category: QuestionCategory | undefined, text: string): string[] {
  const targets =
    category && KEYWORDS[category] ? KEYWORDS[category] : ([] as string[]);
  const hits: string[] = [];
  for (const word of targets) {
    if (text.includes(word)) hits.push(word);
  }
  return hits;
}

function detectEpisode(text: string): boolean {
  return EPISODE_HINTS.some((w) => text.includes(w));
}

// 質問テキストからカテゴリをざっくり推定（category が未指定の場合用）
function inferCategoryFromText(text: string, index: number): QuestionCategory {
  if (text.includes("志望動機") || text.includes("志望理由")) return "motivation";
  if (text.includes("自己PR") || text.includes("自己ＰＲ")) return "self_pr";
  if (text.includes("学生時代") || text.includes("力を入れた")) return "gakuchika";
  if (text.includes("将来") || text.includes("キャリア") || text.includes("目標"))
    return "vision";
  if (text.includes("チーム") || text.includes("協調") || text.includes("連携"))
    return "teamwork";
  // index 0〜2 ならそれぞれ定番カテゴリに寄せる
  if (index === 0) return "motivation";
  if (index === 1) return "self_pr";
  if (index === 2) return "gakuchika";
  return "free";
}

// ---------------- 公開：単回答の解析 ----------------

export function analyzeSingleAnswer(
  mode: ModeTag,
  question: QuestionItem,
  answer: string,
  index: number
): AnswerAnalysis {
  const text = (answer || "").trim();
  const chars = text.length;
  const sentences = splitSentences(text);
  const politeScore = calcPoliteScore(sentences);

  const category =
    question.category ?? inferCategoryFromText(question.text, index);

  const keywordHits = detectKeywordHits(category, text);
  const hasConcreteEpisode = detectEpisode(text);

  const avgCharsPerSentence =
    sentences.length > 0 ? chars / sentences.length : chars;

  // 長さの閾値（モード別に微調整したければここで分岐可能）
  const minCore = 200;
  const minNormal = 120;
  const maxLen = 600;

  const tooShort = question.core
    ? chars > 0 && chars < minCore
    : chars > 0 && chars < minNormal;

  const veryLong = chars > maxLen;
  const noSentenceBreak = chars >= 80 && sentences.length <= 1;
  const noPoliteness = politeScore < 0.2 && chars > 0;

  const stats: AnswerStats = {
    chars,
    sentences: sentences.length,
    avgCharsPerSentence,
    politeScore,
    keywordHits,
  };

  const flags: AnswerFlags = {
    tooShort,
    veryLong,
    noSentenceBreak,
    noPoliteness,
    hasConcreteEpisode,
  };

  return {
    questionId: question.id,
    category,
    stats,
    flags,
  };
}

// ---------------- 公開：全体セッション解析 ----------------

export function analyzeSession(
  mode: ModeTag,
  questions: QuestionItem[],
  answers: string[]
): SessionAnalysis {
  const perAnswer: AnswerAnalysis[] = questions.map((q, i) =>
    analyzeSingleAnswer(mode, q, answers[i] ?? "", i)
  );

  // スコアをざっくり算出
  const coreAnswers = perAnswer.filter((a, i) => questions[i]?.core);
  const allStats = perAnswer.map((a) => a.stats);

  const avgCharsCore =
    coreAnswers.length > 0
      ? coreAnswers.reduce((s, a) => s + a.stats.chars, 0) /
        coreAnswers.length
      : 0;

  const avgSentences =
    allStats.length > 0
      ? allStats.reduce((s, st) => s + st.sentences, 0) / allStats.length
      : 0;

  const avgPolite =
    allStats.length > 0
      ? allStats.reduce((s, st) => s + st.politeScore, 0) / allStats.length
      : 0;

  const motivationAnalyses = perAnswer.filter(
    (a) => a.category === "motivation"
  );
  const motivationKeywords =
    motivationAnalyses.length > 0
      ? motivationAnalyses.reduce(
          (s, a) => s + a.stats.keywordHits.length,
          0
        ) / motivationAnalyses.length
      : 0;

  // スコアを0〜100にクリップ
  const talkLength = clamp((avgCharsCore / 250) * 100, 0, 100); // 250字で100点イメージ
  const structure = clamp((avgSentences / 4) * 100, 0, 100); // 平均4文で100点
  const politeness = clamp(avgPolite * 100, 0, 100); // そのまま%
  const motivationDepth = clamp((motivationKeywords / 4) * 100, 0, 100); // キーワード4個で100点イメージ

  const scores: SessionScores = {
    talkLength,
    structure,
    politeness,
    motivationDepth,
  };

  return {
    mode,
    perAnswer,
    scores,
  };
}
