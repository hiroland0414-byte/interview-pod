// src/lib/feedback/analyzeAnswers.ts

// 「最小限の質問情報」
// InterviewSnapshot から buildFeedback.ts 側で詰め替えて渡します。
export type MinimalQuestion = {
  id: string;
  text: string;
  section?: string; // core_motivation / core_pr / core_gakuchika など
  kind?: string; // "core" / "core-depth" / "additional" / "additional-depth"（あれば）
  isMainCore?: boolean;
};

// コア質問ごとの詳細分析
export type CoreAnswerDetail = {
  id: string;
  section?: string;
  questionText: string;
  answerText: string;
  length: number; // 文字数
  hasReason: boolean;
  hasEpisode: boolean;
  hasFuture: boolean;
  hasMedicalWords: boolean;
};

// 全体の分析結果
export type AnswerAnalysisResult = {
  mode: string; // "A1" | "A2" | "B" | "C" など
  summary: {
    totalChars: number;
    avgChars: number;
    nonEmptyAnswers: number;
    emptyCount: number;
  };
  coreDetails: CoreAnswerDetail[];
  keywords: string[];
  strengths: string[];
  risks: string[];
};

// ---- 内部ユーティリティ -------------------------------------------------

function normalize(text: string): string {
  return (text || "")
    .replace(/\s+/g, " ")
    .replace(/　+/g, " ")
    .trim();
}

function tokenizeJa(text: string): string[] {
  const t = normalize(text);
  if (!t) return [];
  return t.split(/[ 、。・，．!！?？\n\r\t]+/).filter(Boolean);
}

// ある単語群がどれだけ含まれているか（簡易カウント）
function countContains(words: string[], targets: string[]): number {
  let count = 0;
  for (const w of words) {
    for (const t of targets) {
      if (w.includes(t)) {
        count++;
        break;
      }
    }
  }
  return count;
}

// 文章の中から、よく出てくるキーワードの上位を拾う（ごく簡易版）
function extractTopKeywords(allAnswers: string[], limit = 10): string[] {
  const freq = new Map<string, number>();
  for (const a of allAnswers) {
    const tokens = tokenizeJa(a);
    for (const w of tokens) {
      // あまりに短い一文字（「の」「に」など）は無視
      if (w.length <= 1) continue;
      const n = freq.get(w) ?? 0;
      freq.set(w, n + 1);
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

// ---- メイン：回答解析 ---------------------------------------------------

export function analyzeAnswers(
  mode: string,
  questions: MinimalQuestion[],
  answers: string[]
): AnswerAnalysisResult {
  const cleanedAnswers = answers.map((a) => normalize(a));

  const totalChars = cleanedAnswers.reduce(
    (sum, a) => sum + (a ? a.length : 0),
    0
  );
  const nonEmptyAnswers = cleanedAnswers.filter((a) => a.length > 0).length;
  const emptyCount = cleanedAnswers.length - nonEmptyAnswers;
  const avgChars =
    nonEmptyAnswers > 0 ? Math.round(totalChars / nonEmptyAnswers) : 0;

  // コア質問だけを抽出（question.kind === "core" を優先）
  const coreQuestions = questions.filter(
    (q) => q.kind === "core" || q.isMainCore
  );

  const coreDetails: CoreAnswerDetail[] = [];

  // 判定に使うキーワード群
  const reasonWords = ["理由", "から", "ため", "きっかけ", "契機"];
  const episodeWords = [
    "経験",
    "エピソード",
    "出来事",
    "活動",
    "実習",
    "部活",
    "サークル",
    "アルバイト",
    "バイト",
  ];
  const futureWords = [
    "将来",
    "なりたい",
    "たいです",
    "ていきたい",
    "目指して",
    "ビジョン",
    "キャリア",
    "貢献したい",
    "貢献していきたい",
  ];
  const medicalWords = [
    "患者",
    "受診者",
    "利用者",
    "医療",
    "病院",
    "クリニック",
    "センター",
    "チーム医療",
    "放射線",
    "看護",
    "健診",
    "検査",
    "技師",
    "ナース",
  ];

  // core 質問ごとの詳細分析
  for (const coreQ of coreQuestions) {
    const idx = questions.findIndex((q) => q.id === coreQ.id);
    if (idx < 0 || idx >= cleanedAnswers.length) continue;

    const ans = cleanedAnswers[idx] ?? "";
    const tokens = tokenizeJa(ans);

    const length = ans.length;
    const hasReason = countContains(tokens, reasonWords) > 0;
    const hasEpisode = countContains(tokens, episodeWords) > 0;
    const hasFuture = countContains(tokens, futureWords) > 0;
    const hasMedicalWords = countContains(tokens, medicalWords) > 0;

    coreDetails.push({
      id: coreQ.id,
      section: coreQ.section,
      questionText: coreQ.text,
      answerText: ans,
      length,
      hasReason,
      hasEpisode,
      hasFuture,
      hasMedicalWords,
    });
  }

  // 全体キーワード抽出（簡易）
  const keywords = extractTopKeywords(cleanedAnswers);

  // strengths / risks をざっくり埋める
  const strengths: string[] = [];
  const risks: string[] = [];

  // ① 文字量
  if (avgChars >= 200) {
    strengths.push("コア質問に対して、十分な文字量で丁寧に回答できています。");
  } else if (avgChars >= 120) {
    strengths.push("コア質問にはおおむね必要な情報量を盛り込めています。");
  } else {
    risks.push(
      "全体として回答がやや短めで、面接官に伝わる情報量が不足するおそれがあります。"
    );
  }

  // ② 志望動機の構造
  const mot = coreDetails.find((c) => c.section === "core_motivation");
  if (mot) {
    if (mot.hasReason && mot.hasEpisode && mot.hasFuture) {
      strengths.push(
        "志望動機では「きっかけ」「経験」「将来像」の３点がバランスよく含まれており、説得力のある構成になっています。"
      );
    } else {
      const lack: string[] = [];
      if (!mot.hasReason) lack.push("なぜその施設を選ぶのかという『理由』");
      if (!mot.hasEpisode)
        lack.push("自分の経験と結び付けた『具体的なエピソード』");
      if (!mot.hasFuture)
        lack.push("将来どのような医療者になりたいかという『ビジョン』");
      if (lack.length) {
        risks.push(
          `志望動機の中で、${lack.join("と")}の説明がやや薄く、面接官には「どこに惹かれているのか」「どのように成長していきたいのか」が伝わりにくくなる可能性があります。`
        );
      }
    }
  }

  // ③ 自己PR・学チカの具体性
  const pr = coreDetails.find((c) => c.section === "core_pr");
  const gakuchika = coreDetails.find((c) => c.section === "core_gakuchika");

  if (pr) {
    if (pr.hasEpisode) {
      strengths.push(
        "自己PRでは、ご自身の強みを具体的なエピソードと結び付けて説明できており、信頼感につながっています。"
      );
    } else {
      risks.push(
        "自己PRでは強みを挙げられていますが、その強みが発揮された具体的な場面をもう一歩詳しく示すと、説得力がさらに高まります。"
      );
    }
  }

  if (gakuchika) {
    if (gakuchika.hasEpisode) {
      strengths.push(
        "学生時代に力を入れたことについて、取り組みの内容や工夫が具体的に書かれており、行動力や継続力が伝わってきます。"
      );
    } else {
      risks.push(
        "学生時代に力を入れたことは述べられていますが、『どのように工夫したか』『何を学んだか』をもう少し詳しく言語化できると強みが際立ちます。"
      );
    }
  }

  // ④ 医療・職種ワード
  const coreWithMedical = coreDetails.filter((c) => c.hasMedicalWords).length;
  if (coreWithMedical >= 2) {
    strengths.push(
      "医療現場や職種に関わる言葉が自然に出てきており、目指している分野への理解や意識の高さが感じられます。"
    );
  } else {
    risks.push(
      "医療現場や職種に関する用語がやや少なめのため、具体的な仕事内容や現場イメージをもう少し盛り込めると、志望度や適性がより伝わります。"
    );
  }

  return {
    mode,
    summary: {
      totalChars,
      avgChars,
      nonEmptyAnswers,
      emptyCount,
    },
    coreDetails,
    keywords,
    strengths,
    risks,
  };
}
