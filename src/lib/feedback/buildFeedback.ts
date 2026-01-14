// src/lib/feedback/buildFeedback.ts
import personasJson from "@/lib/persona/modePersonas.json";
import {
  analyzeAnswers,
  type MinimalQuestion,
  type AnswerAnalysisResult,
  type CoreAnswerDetail,
} from "./analyzeAnswers";

// --- セッションから読むスナップショットの形 -----------------------------

export type SnapshotQuestion = {
  id: string;
  text: string;
  section?: string; // core_motivation / core_pr / core_gakuchika など
  kind?: string; // "core" / "core-depth" / "additional" / "additional-depth"
  isMainCore?: boolean;
};

export type InterviewSnapshot = {
  mode: string; // "A1" | "A2" | "B" | "C" | "UP" など
  questions: SnapshotQuestion[];
  answers: string[];
};

// 画面側に返すフィードバック 3本柱
export type FeedbackBlock = {
  good: string;    // 良かったところ（約30%）
  improve: string; // 改善したいところ（約40%）
  next: string;    // 次の一手と励まし（約30%）
};

// --- モード別人格 ---------------------------------------------------------

type ModePersona = {
  id: string;
  label: string;            // 「A1: 病院（診療放射線技師）」など
  role: string;             // 「臨床で学生育成も担当している放射線技師」など
  tone: string;             // 「穏やかで前向き」「率直でフラット」など
  values: string[];         // 大事にしている価値観キーワード
  emphasis?: string[];      // 特に見ている観点
  caution?: string[];       // 注意してほしいポイント
  praisePhrases?: string[]; // 褒めるときの決め台詞候補
  encouragePhrases?: string[]; // 励ますときの決め台詞候補
};

type PersonaMap = Record<string, ModePersona>;

// JSON をそのまま PersonaMap として扱う（型キャスト）
const PERSONAS: PersonaMap = personasJson as unknown as PersonaMap;

function pickPersona(mode: string): ModePersona {
  const base =
    PERSONAS[mode] ??
    PERSONAS["A1"] ??
    Object.values(PERSONAS)[0];

  return {
    ...base,
    emphasis: base.emphasis ?? [],
    caution: base.caution ?? [],
    praisePhrases: base.praisePhrases ?? [],
    encouragePhrases: base.encouragePhrases ?? [],
  };
}

// --- 良かったところ -------------------------------------------------------

function buildGoodSection(
  persona: ModePersona,
  analysis: AnswerAnalysisResult
): string {
  const lines: string[] = [];

  // 導入
  lines.push(
    `${persona.role}として拝見すると、今回の回答にはしっかり考え抜かれた点が多く見られます。`
  );

  // --- コア3本の状況を個別にコメント ---------------------------------
  const mot = analysis.coreDetails.find(
    (c: CoreAnswerDetail) => c.section === "core_motivation"
  );
  const pr = analysis.coreDetails.find(
    (c: CoreAnswerDetail) => c.section === "core_pr"
  );
  const gakuchika = analysis.coreDetails.find(
    (c: CoreAnswerDetail) => c.section === "core_gakuchika"
  );

  if (mot) {
    const has3 =
      mot.hasReason && mot.hasEpisode && mot.hasFuture;
    if (has3) {
      lines.push(
        "志望動機では、「選んだ理由」「きっかけとなった経験」「将来像」がバランスよく含まれており、面接官にも伝わりやすい構成になっています。"
      );
    } else if (mot.length >= 160) {
      lines.push(
        "志望動機は十分な分量で、自分の言葉で丁寧に説明しようとしている姿勢が伝わってきます。"
      );
    }
  }

  if (pr) {
    if (pr.hasEpisode) {
      lines.push(
        "自己PRでは、ご自身の強みを具体的なエピソードと結び付けて説明できており、信頼感につながっています。"
      );
    } else if (pr.length >= 160) {
      lines.push(
        "自己PRは、強みを中心に整理されていて、相手に伝えたいポイントがはっきりしています。"
      );
    }
  }

  if (gakuchika) {
    if (gakuchika.hasEpisode) {
      lines.push(
        "学生時代に力を入れたことについて、取り組み内容や工夫が具体的に書かれており、行動力や継続力が伝わってきます。"
      );
    } else if (gakuchika.length >= 160) {
      lines.push(
        "学生時代の取り組みについて、全体の流れを意識しながら整理して書けている点が良いところです。"
      );
    }
  }

  // --- 分析エンジン側の strengths を反映 -----------------------------
  if (analysis.strengths.length > 0) {
    const picked = analysis.strengths.slice(0, 3);
    for (const s of picked) {
      lines.push(`・${s}`);
    }
  }

  // モード人格が大事にしている観点
  if (persona.emphasis && persona.emphasis.length > 0) {
    lines.push(
      `特に、${persona.emphasis.join(
        "・"
      )}といった点を大切にしている姿勢は、${persona.label}として高く評価できます。`
    );
  }

  // 褒めフレーズ
  const praise =
    persona.praisePhrases && persona.praisePhrases.length > 0
      ? persona.praisePhrases[0]
      : "この調子で、あなたらしさを言葉にしていく練習を重ねていきましょう。";

  lines.push(praise);

  return lines.join("\n");
}

// --- 改善したいところ -----------------------------------------------------

function buildImproveSection(
  persona: ModePersona,
  analysis: AnswerAnalysisResult
): string {
  const lines: string[] = [];

  lines.push(
    "一方で、面接本番を想定すると、もう一歩だけ整理しておきたいポイントも見えてきました。"
  );

  const mot = analysis.coreDetails.find(
    (c: CoreAnswerDetail) => c.section === "core_motivation"
  );
  const pr = analysis.coreDetails.find(
    (c: CoreAnswerDetail) => c.section === "core_pr"
  );
  const gakuchika = analysis.coreDetails.find(
    (c: CoreAnswerDetail) => c.section === "core_gakuchika"
  );

  // 志望動機まわり
  if (mot) {
    const lack: string[] = [];
    if (!mot.hasReason)
      lack.push("なぜその施設・職種を選ぶのかという『理由』");
    if (!mot.hasEpisode)
      lack.push("自分の経験と結び付けた『具体的なエピソード』");
    if (!mot.hasFuture)
      lack.push("将来どんな医療者になりたいかという『ビジョン』");

    if (lack.length > 0) {
      lines.push(
        `志望動機では、${lack.join(
          "と"
        )}の部分をもう一歩だけ厚くしておくと、より説得力のある内容になります。`
      );
    } else if (mot.length < 160) {
      lines.push(
        "志望動機自体は整理されていますが、分量がやや控えめなので、具体例や感情の言葉を少し足しておくと印象に残りやすくなります。"
      );
    }
  }

  // 自己PRまわり
  if (pr) {
    if (!pr.hasEpisode) {
      lines.push(
        "自己PRでは強みが伝わっていますが、『その強みが発揮された場面』を一つ具体的に示せると、説得力がさらに増します。"
      );
    }
  }

  // 学チカまわり
  if (gakuchika) {
    if (!gakuchika.hasEpisode) {
      lines.push(
        "学生時代に力を入れたことについては、『どのような工夫をしたか』『そこで何を学んだか』をもう少し詳しく言語化しておくと、強みがよりクリアに伝わります。"
      );
    }
  }

  // 分析エンジンの risks も反映
  if (analysis.risks.length > 0) {
    const picked = analysis.risks.slice(0, 3);
    for (const r of picked) {
      lines.push(`・${r}`);
    }
  }

  // モード人格としての「注意ポイント」
  if (persona.caution && persona.caution.length > 0) {
    lines.push(
      `また、${persona.caution.join(
        "・"
      )}といった点は、${persona.label}を目指すうえで意識しておきたいポイントです。普段の会話や文章でも少しずつ整えていきましょう。`
    );
  }

  return lines.join("\n");
}

// --- 次の一手と励まし -----------------------------------------------------

function buildNextSection(
  persona: ModePersona,
  analysis: AnswerAnalysisResult
): string {
  const lines: string[] = [];

  lines.push(
    "今回の練習で見えてきた良さと課題を踏まえて、次の一手を整理しておきましょう。"
  );

  const mot = analysis.coreDetails.find(
    (c: CoreAnswerDetail) => c.section === "core_motivation"
  );
  const pr = analysis.coreDetails.find(
    (c: CoreAnswerDetail) => c.section === "core_pr"
  );
  const gakuchika = analysis.coreDetails.find(
    (c: CoreAnswerDetail) => c.section === "core_gakuchika"
  );

  // 1本ずつ「次の一歩」を提案
  if (mot) {
    lines.push(
      "まずは志望動機について、『きっかけ → そこで感じたこと → その施設を選ぶ理由 → 将来どんな医療者になりたいか』の流れで、3〜4分程度のストーリーに整えてみましょう。"
    );
  }

  if (pr) {
    lines.push(
      "自己PRでは、強みを一つに絞り、その強みが発揮された場面を「状況・行動・結果」の順に整理して話す練習をしてみてください。"
    );
  }

  if (gakuchika) {
    lines.push(
      "学生時代に力を入れたことについては、『役割』『工夫したこと』『そこで得た学び』をセットで語れるようにしておくと、本番でも落ち着いて答えられます。"
    );
  }

  // 回答全体への「型」の提案
  lines.push(
    "どの質問に対しても、「結論 → 理由 → 具体例 → 学び・今後」という共通の型を意識すると、深掘り質問が来ても構造的に答えやすくなります。"
  );

  // 上位キーワードを使って少しだけ寄せる
  if (analysis.keywords.length > 0) {
    const pick = analysis.keywords.slice(0, 3).join("・");
    lines.push(
      `今回の回答の中でよく出てきたキーワード（例：${pick}）は、あなたらしさが表れている部分です。これらを軸に、エピソードや将来像を肉付けしていくと、オリジナリティのある受け答えになっていきます。`
    );
  }

  const encourage =
    persona.encouragePhrases && persona.encouragePhrases.length > 0
      ? persona.encouragePhrases[0]
      : "今回の結果はあくまで“途中経過”です。一回ごとの振り返りを活かして、少しずつ完成度を高めていきましょう。";

  lines.push(encourage);

  return lines.join("\n");
}

// --- スナップショット → フィードバック 変換のメイン関数 ---------------

export function buildFeedbackFromSnapshot(
  snapshot: InterviewSnapshot
): FeedbackBlock {
  const { mode, questions, answers } = snapshot;

  const minimalQuestions: MinimalQuestion[] = questions.map(
    (q: SnapshotQuestion) => ({
      id: q.id,
      text: q.text,
      section: q.section,
      kind: q.kind,
      isMainCore: q.isMainCore,
    })
  );

  const analysis = analyzeAnswers(mode, minimalQuestions, answers);
  const persona = pickPersona(mode);

  const good = buildGoodSection(persona, analysis);
  const improve = buildImproveSection(persona, analysis);
  const next = buildNextSection(persona, analysis);

  return { good, improve, next };
}

// 互換用：以前 buildFeedback(snapshot) を呼んでいたコード向け
export function buildFeedback(snapshot: InterviewSnapshot): FeedbackBlock {
  return buildFeedbackFromSnapshot(snapshot);
}
