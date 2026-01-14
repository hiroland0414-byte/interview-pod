// -------------------------------------------------------------
//  interviewFeedback.ts（専門家モード強化版）
//  ・各モードの人格（技師長/看護部長/施設長/人事部長）を使用
//  ・3大質問（志望動機／自己PR／学チカ）をカテゴリごとに診断
//  ・構成（結論・理由・具体例・振り返り）もチェック
//  ・カテゴリごとに「一文サマリー＋良い点＋改善点」を出力
//  ・ふざけ入力・無内容の場合は「評価できません」だけ返す
//  ・学チカは「主体性／居酒屋回避／継続性／他者評価／具体性」も評価に加える
// -------------------------------------------------------------

import type { ModeTag } from "@/lib/questions";
import { Personas } from "@/lib/feedback/personas";
import {
  extractHighlights,
  type Highlight,
} from "@/lib/feedback/extractHighlights";

export interface AnswerSummary {
  id: string;
  questionText: string;
  answerText: string;
}

type Category = "motivation" | "selfPr" | "gakuchika";

type CategoryAnalysis = {
  category: Category;
  answers: AnswerSummary[];
  avgLength: number;
  hasConclusion: boolean;
  hasReason: boolean;
  hasExample: boolean;
  hasReflection: boolean;
  highlights: Highlight[];
};

function classifyQuestion(q: string): Category {
  if (q.includes("志望")) return "motivation";
  if (q.includes("PR") || q.includes("ＰＲ")) return "selfPr";
  return "gakuchika";
}

function pickPersona(mode: ModeTag) {
  return Personas[mode] ?? Personas["A1"];
}

// -------------------------------------------------------------
// 「面接回答として意味があるか」をざっくり判定する
// ふざけ入力・同じ文字の連打などを弾く
// -------------------------------------------------------------
export function isMeaningfulAnswer(text: string | undefined | null): boolean {
  if (!text) return false;
  const t = text.replace(/\s/g, "");

  // あまりに短い（50文字未満）は評価しない
  if (t.length < 50) return false;

  // 異なる文字の種類が極端に少ない（同じ文字の連打など）
  const distinct = new Set(t.split(""));
  if (distinct.size <= 3) return false;

  // です／ます／ました／と思います 等、日本語の文末が1つも無い場合も怪しい
  if (
    !/(です|ます|でした|ました|と思います|と考えています|たいと考えております|と感じています)/.test(
      t
    )
  ) {
    return false;
  }

  return true;
}

// -------------------------------------------------------------
// 学チカ評価用：観点検出（簡易ルール）
// 1) 主体性・熱意
// 2) アルバイト題材（居酒屋系は差別化が難しい）＋目標設定
// 3) 継続性（長期・今も継続が最強）
// 4) 他者評価
// 5) 具体性（固有名詞・数字）
// -------------------------------------------------------------
function analyzeGakuchikaSignals(text: string) {
  const t = (text || "").replace(/\s/g, "");

  const selfDriven =
    /(自ら|自分から|主体的|率先|提案|企画|立ち上げ|改善|工夫|挑戦|行動|働きかけ|巻き込|リード|推進)/.test(
      t
    );

  const enthusiasm =
    /(熱意|本気|こだわり|やりき|粘り強|徹底|諦めず|継続|工夫し続け)/.test(t);

  const hasPartTime =
    /(アルバイト|バイト|勤務|シフト|接客|店長|社員|店舗)/.test(t);

  // 「居酒屋」系はありがちになりやすい（禁止ではなく、厳しめ指摘）
  const izakayaLike =
    /(居酒屋|焼き鳥|串カツ|バー|飲み屋|ホール|キッチン)/.test(t);

  // 目標設定（あると強い）
  const hasGoal =
    /(目標|KPI|達成|売上|客数|単価|満足度|評価|改善率|成約|リピート|クレーム削減|効率化)/.test(
      t
    );

  // 継続性（長期＋現在も）
  const longTerm =
    /(半年|1年|2年|3年|4年|長期間|継続|コツコツ|毎週|毎日|◯ヶ月|◯年)/.test(t);

  const stillContinuing =
    /(今も|現在も|継続して|続けて|続けています|継続中)/.test(t);

  // 他者評価（第三者の評価・表彰・任命など）
  const thirdPartyEval =
    /(評価|表彰|受賞|感謝|褒められ|任された|推薦|信頼|リーダー|責任者|役職|選ばれた|結果を認められ)/.test(
      t
    );

  // 具体性（数字・固有名詞っぽさ）
  const hasNumbers =
    /(\d{1,3}(?:,\d{3})+|\d+)(%|人|件|回|枚|日|週|ヶ月|か月|年|点|位|時間|円|名|社)?/.test(
      t
    );

  const hasProperNounish =
    /(大学|学部|ゼミ|研究室|サークル|部活|大会|学会|実習|病院|施設|プロジェクト|委員会|地域|自治体|企業|製品|サービス)/.test(
      t
    );

  return {
    selfDriven,
    enthusiasm,
    hasPartTime,
    izakayaLike,
    hasGoal,
    longTerm,
    stillContinuing,
    thirdPartyEval,
    hasNumbers,
    hasProperNounish,
  };
}

// -------------------------------------------------------------
// カテゴリごとの構造分析
// -------------------------------------------------------------
function analyzeCategory(
  cat: Category,
  answers: AnswerSummary[],
  allHighlights: Highlight[]
): CategoryAnalysis | null {
  const list = answers.filter(
    (a) =>
      classifyQuestion(a.questionText) === cat &&
      isMeaningfulAnswer(a.answerText)
  );
  if (list.length === 0) return null;

  let totalLen = 0;
  let hasConclusion = false;
  let hasReason = false;
  let hasExample = false;
  let hasReflection = false;

  const conclusionRe =
    /(志望しました|志望いたしました|志望したい|と考えています|と考えております|と感じています|と考えるようになりました|と考えるに至りました)/;
  const reasonRe = /(理由|なぜなら|きっかけ|背景|そのため|その中で)/;
  const exampleRe =
    /(例えば|たとえば|具体的には|実習で|アルバイトで|部活動で|サークルで|高校時代に)/;
  const reflectionRe =
    /(学びました|学びとなりました|気づきました|振り返り|成長しました|成長につながりました|考えるようになりました)/;

  for (const a of list) {
    const text = (a.answerText ?? "").replace(/\s/g, "");
    const len = text.length;
    totalLen += len;

    if (conclusionRe.test(text)) hasConclusion = true;
    if (reasonRe.test(text)) hasReason = true;
    if (exampleRe.test(text)) hasExample = true;
    if (reflectionRe.test(text)) hasReflection = true;
  }

  const avgLength = totalLen / list.length;
  const highlights = allHighlights.filter((h) => h.category === cat);

  return {
    category: cat,
    answers: list,
    avgLength,
    hasConclusion,
    hasReason,
    hasExample,
    hasReflection,
    highlights,
  };
}

function joinSentences(lines: string[]): string {
  return lines.filter(Boolean).join("");
}

// セクション見出し用（「〜について」付き）
function sectionTitleLabel(cat: Category): string {
  switch (cat) {
    case "motivation":
      return "志望動機について";
    case "selfPr":
      return "自己PRについて";
    case "gakuchika":
      return "学生時代に力を入れたことについて";
  }
}

// ショートラベル（「志望動機」「自己PR」など）
function shortLabel(cat: Category): string {
  switch (cat) {
    case "motivation":
      return "志望動機";
    case "selfPr":
      return "自己PR";
    case "gakuchika":
    default:
      return "学生時代に力を入れたこと";
  }
}

// -------------------------------------------------------------
// カテゴリごとのフィードバック本文を生成
// 形式：
// 【志望動機について】
// （一文サマリー）
// ＜良い点＞ …ストーリー性・具体性・姿勢
// ＜改善したい点＞ …流れの弱い部分・具体化すべき部分
//
// ※ A1/A2/B の志望動機：患者さん・受診者さんへの配慮
// ※ C の志望動機：なぜこの会社か & この会社で何をしたいか
// ※ 学チカ：主体性／居酒屋回避／継続性／他者評価／具体性
// -------------------------------------------------------------
function buildCategorySection(
  personaId: ModeTag,
  analysis: CategoryAnalysis
): string {
  const persona = pickPersona(personaId);
  const lines: string[] = [];
  const catLabel = sectionTitleLabel(analysis.category);
  const short = shortLabel(analysis.category);

  // --- 特殊観点：患者さん・受診者さんへの配慮（A1/A2/B × 志望動機） ---
  let hasPatientCare = false;
  // --- 特殊観点：企業志望の軸（C × 志望動機） ---
  let hasWhyCompany = false;
  let hasCompanyWill = false;

  if (analysis.category === "motivation") {
    const combinedText = analysis.answers.map((a) => a.answerText ?? "").join("");

    // 医療系（A1/A2/B）の患者・受診者視点
    if (personaId === "A1" || personaId === "A2" || personaId === "B") {
      const patientCareRe =
        /(患者|受診者|利用者|ご家族|家族|不安|安心|寄り添|配慮|声かけ|コミュニケーション|気持ち|心に寄り添う)/;
      hasPatientCare = patientCareRe.test(combinedText);
    }

    // 企業モード（C）の「なぜこの会社か」「この会社で何をしたいか」
    if (personaId === "C") {
      const whyRe =
        /(御社|貴社|この会社|この企業|自社製品|自社サービス|事業内容|業界|強み|特徴|理念|ビジョン)/;
      const willRe =
        /(挑戦したい|携わりたい|関わりたい|貢献したい|成長したい|実現したい|取り組みたい|担いたい|支えたい|広めたい)/;

      hasWhyCompany = whyRe.test(combinedText);
      hasCompanyWill = willRe.test(combinedText);
    }
  }

  // 一文サマリー（ストーリー性・イメージのしやすさを中心に）
  let summary = `${short}の回答は、`;

  const structScore =
    (analysis.hasConclusion ? 1 : 0) +
    (analysis.hasReason ? 1 : 0) +
    (analysis.hasExample ? 1 : 0) +
    (analysis.hasReflection ? 1 : 0);

  if (structScore >= 3) {
    summary +=
      "全体として筋道が通っており、面接官が場面をイメージしながら聞きやすいストーリーになっています。";
  } else if (structScore === 2) {
    summary +=
      "伝えたい方向性は伝わってきますが、話の流れが途中で途切れてしまう部分があり、ストーリーとしては惜しい印象があります。";
  } else {
    summary +=
      "キーワードは述べられていますが、聞き手が具体的な場面や状況をイメージするには、まだ情報が足りない構成になっています。";
  }

  // 構成の強み・弱みをサマリーに少しだけ足す
  const strongStruct: string[] = [];
  const weakStruct: string[] = [];

  if (analysis.hasConclusion) strongStruct.push("結論");
  else weakStruct.push("結論");

  if (analysis.hasReason) strongStruct.push("理由");
  else weakStruct.push("理由");

  if (analysis.hasExample) strongStruct.push("具体例");
  else weakStruct.push("具体例");

  if (analysis.hasReflection) strongStruct.push("学び・振り返り");
  else weakStruct.push("学び・振り返り");

  if (strongStruct.length > 0) {
    summary += ` ${strongStruct.join("・")}が含まれている点は良く、ストーリーの軸として機能しています。`;
  }
  if (weakStruct.length > 0) {
    summary += ` 一方で、${weakStruct.join("・")}の部分は、流れの中で薄くなりがちで、聞き手のイメージが途切れやすい箇所です。`;
  }

  // A1/A2/B の志望動機：患者・受診者視点もサマリーに
  if (
    analysis.category === "motivation" &&
    (personaId === "A1" || personaId === "A2" || personaId === "B")
  ) {
    if (hasPatientCare) {
      summary +=
        " また、患者さんや受診者さんの不安や気持ちへの配慮にも触れられており、医療職として大切な視点が志望動機の中に含まれている点も評価できます。";
    } else {
      summary +=
        " ただし、医療職を志すうえで重要な「患者さんや受診者さん、そのご家族の不安や気持ちにどう向き合いたいか」という視点は、現状の文章からはやや読み取りづらい印象があります。";
    }
  }

  // Cモード（企業）の志望動機：Why us & What I want to do
  if (analysis.category === "motivation" && personaId === "C") {
    if (hasWhyCompany && hasCompanyWill) {
      summary +=
        " また、「なぜこの会社なのか」と「この会社で自分が何を実現したいのか」がどちらも文章の中で語られており、企業側から見ても志望の軸が分かりやすく伝わります。";
    } else if (hasWhyCompany && !hasCompanyWill) {
      summary +=
        " 一方で、「なぜこの会社なのか」は述べられているものの、「この会社で自分がどのような役割を担い、何を実現したいのか」という点は、もう一歩踏み込んでほしいところです。";
    } else if (!hasWhyCompany && hasCompanyWill) {
      summary +=
        " また、「この会社でどのようなことに取り組みたいか」という意欲は感じられますが、「なぜ数ある企業の中でこの会社なのか」という視点は、現状の文章からはやや読み取りにくい印象があります。";
    } else {
      summary +=
        " さらに、企業モードの志望動機として重視される「なぜこの会社を選んだのか」「この会社で何を実現したいのか」という二つの軸が、文章の中では十分に言語化されていません。";
    }
  }

  lines.push(`【${catLabel}】\n`);
  lines.push(summary + "\n");

  // -------- ＜良い点＞ --------
  const goodLines: string[] = [];
  goodLines.push("＜良い点＞");

  const structGood: string[] = [];
  if (analysis.hasConclusion) {
    structGood.push("最終的に自分が何を伝えたいかという結論を示そうとしているところ");
  }
  if (analysis.hasReason) {
    structGood.push("その考えに至った理由やきっかけを、自分の言葉で説明しようとしているところ");
  }
  if (analysis.hasExample) {
    structGood.push("具体的な場面や経験を取り上げて、聞き手が状況をイメージしやすくしているところ");
  }
  if (analysis.hasReflection) {
    structGood.push("経験から得た学びや、自分の成長につなげようとしている姿勢が見えるところ");
  }

  if (structGood.length > 0) {
    goodLines.push(
      "文章の組み立てという点では、" +
        structGood.join("、") +
        "が良い点として挙げられます。"
    );
  } else {
    goodLines.push(
      "文章全体から、少なくとも自分の考えや経験を伝えようという意図は伝わってきます。"
    );
  }

  const goodHighlights = analysis.highlights.filter((h) => h.type === "good");
  if (goodHighlights.length > 0) {
    const first = goodHighlights[0];
    goodLines.push(
      `また、回答中の「${first.quote}」という表現は、あなたの価値観や大切にしている姿勢が具体的に伝わる良いフレーズです。`
    );
  }

  // ★ 志望動機 × A1/A2/B で、患者さん・受診者さんへの配慮が書けている場合はここでも褒める
  if (
    analysis.category === "motivation" &&
    (personaId === "A1" || personaId === "A2" || personaId === "B") &&
    hasPatientCare
  ) {
    goodLines.push(
      "特に、患者さんや受診者さん、そのご家族の不安や気持ちに寄り添いたいという想いが志望動機の中に表現されている点は、医療職として非常に重要な強みです。"
    );
  }

  // ★ 志望動機 × C（企業）で、Why & What 両方ある場合は強みとして明示
  if (
    analysis.category === "motivation" &&
    personaId === "C" &&
    hasWhyCompany &&
    hasCompanyWill
  ) {
    goodLines.push(
      "また、「なぜこの会社なのか」という視点と、「この会社でどのようなことに取り組みたいのか」という視点が両方含まれており、企業側から見ても志望の軸と熱意が伝わりやすい内容になっています。"
    );
  }

  // -------- 学チカ：5観点（good側）を追加 --------
  if (analysis.category === "gakuchika") {
    const combined = analysis.answers.map((a) => a.answerText ?? "").join("");
    const sig = analyzeGakuchikaSignals(combined);

    // 1) 主体性・熱意
    if (sig.selfDriven || sig.enthusiasm) {
      goodLines.push(
        "「自分から動いたこと」「工夫して改善したこと」が読み取れ、主体性と熱量が伝わります。学チカとして評価されやすい要素です。"
      );
    }

    // 2) 目標設定（あると強い）
    if (sig.hasGoal) {
      goodLines.push(
        "取り組みに目標（指標）を置いて行動した形跡があり、単なる経験談ではなく“成果に向けて動いた話”として強いです。"
      );
    }

    // 3) 継続性（長期＋今も）
    if (sig.longTerm && sig.stillContinuing) {
      goodLines.push(
        "長期間の継続に加えて“今も続けている”点は非常に強いです。再現性のある努力習慣として評価されます。"
      );
    } else if (sig.longTerm) {
      goodLines.push(
        "一定期間を継続して取り組んだことが伝わり、粘り強さの根拠になります。"
      );
    }

    // 4) 他者評価
    if (sig.thirdPartyEval) {
      goodLines.push(
        "他者からの評価（任された、表彰、感謝、信頼など）が書かれており、客観性が出ています。学チカとして説得力が上がります。"
      );
    }

    // 5) 具体性（固有名詞・数字）
    if (sig.hasNumbers || sig.hasProperNounish) {
      goodLines.push(
        "固有名詞や数字が含まれており、聞き手が状況を具体的に想像しやすい説明になっています。"
      );
    }
  }

  goodLines.push(
    "これらの点から、あなたが自分の経験をもとに、筋の通ったストーリーとして話そうとしていることは十分に伝わってきます。"
  );

  // -------- ＜改善したい点＞ --------
  const badLines: string[] = [];
  badLines.push("＜改善したい点＞");

  const weakPieces: string[] = [];
  if (!analysis.hasConclusion) {
    weakPieces.push("最初か最後に一文で結論を言い切る部分");
  }
  if (!analysis.hasReason) {
    weakPieces.push("「なぜそう考えるのか」という理由や背景");
  }
  if (!analysis.hasExample) {
    weakPieces.push("実習・アルバイト・部活動などの、具体的な場面の描写");
  }
  if (!analysis.hasReflection) {
    weakPieces.push("その経験から何を学び、今後どう活かしたいかという振り返り");
  }

  if (weakPieces.length > 0) {
    badLines.push(
      "一方で、" +
        weakPieces.join("と、") +
        "が薄くなっており、話の流れの中で「場面が浮かぶ部分」と「抽象的な説明」にばらつきがある状態です。"
    );
    badLines.push(
      "【結論→理由→具体的なエピソード→そこからの学び】という流れを意識して、各要素を一つひとつ言葉にしていくことで、聞き手にとってよりイメージしやすいストーリーになります。"
    );
  } else {
    badLines.push(
      "構成そのものはよく整っているので、次の段階としては、一文を少し短めに区切ったり、重要な部分を先に述べたりして、より整理された印象になるよう工夫していけると良いでしょう。"
    );
  }

  const badHighlights = analysis.highlights.filter((h) => h.type === "bad");
  if (badHighlights.length > 0) {
    const first = badHighlights[0];
    badLines.push(
      `例えば、「${first.quote}」という表現は、自分の課題意識としては良いのですが、面接官の立場から見ると、もう少し具体的な行動や場面を添えるとストーリーとしての説得力が増す部分です。`
    );
  }

  // ★ 志望動機 × A1/A2/B で、患者さん・受診者さんへの視点が弱い場合ははっきり指摘
  if (
    analysis.category === "motivation" &&
    (personaId === "A1" || personaId === "A2" || personaId === "B") &&
    !hasPatientCare
  ) {
    badLines.push(
      "また、医療職を志すうえで欠かせない「患者さんや受診者さん、そのご家族の不安や気持ちにどう向き合いたいか」という視点が、志望動機の中ではほとんど触れられていません。自分が実習や日常生活の中で関わった場面を思い出し、そのときにどのように感じ、どう関わりたいと思ったのかを具体的なストーリーとして加えていくことが、大きな改善ポイントになります。"
    );
  }

  // ★ 志望動機 × C で、Why / What が足りない場合の指摘
  if (analysis.category === "motivation" && personaId === "C") {
    if (!hasWhyCompany && !hasCompanyWill) {
      badLines.push(
        "さらに、企業モードの志望動機では、「数ある会社の中でなぜこの会社なのか」と「この会社で自分がどのような役割を担い、何を実現したいのか」という二つの軸が非常に重要です。この二点を、自分の言葉で具体的なストーリーとして補っていくことが求められます。"
      );
    } else if (!hasWhyCompany && hasCompanyWill) {
      badLines.push(
        "また、「この会社でどのようなことに取り組みたいか」という意欲は感じられる一方で、「なぜこの会社でなければならないのか」という視点が弱くなっています。事業内容や強み、理念など、自分が共感しているポイントを具体的に言葉にしてみてください。"
      );
    } else if (hasWhyCompany && !hasCompanyWill) {
      badLines.push(
        "また、「なぜこの会社を選んだのか」という説明はできていますが、「この会社で自分がどのように貢献したいか」「どんな成長や成果を目指したいか」という将来像がやや見えづらい状態です。自分が担っていきたい役割やチャレンジしたい業務を、具体的に言葉にしてみると良いでしょう。"
      );
    }
  }

  // -------- 学チカ：5観点（bad側）を追加 --------
  if (analysis.category === "gakuchika") {
    const combined = analysis.answers.map((a) => a.answerText ?? "").join("");
    const sig = analyzeGakuchikaSignals(combined);

    // 1) 主体性・熱意が弱い
    if (!sig.selfDriven && !sig.enthusiasm) {
      badLines.push(
        "学チカとしては「自分が何を考え、どう動いたか（主体性）」がまだ弱く見えます。指示待ちではなく、自分で課題を見つけて動いた部分をストーリーとして追加してください。"
      );
    }

    // 2) アルバイト題材（居酒屋系は厳しめ）＋目標がない
    if (sig.hasPartTime) {
      if (sig.izakayaLike) {
        badLines.push(
          "アルバイト経験としては、居酒屋系の接客は“ありがちな題材”になりやすく、差別化が難しいです。書くなら「自分で立てた目標」「改善の工夫」「数字で示せる成果」を必ずセットで入れてください。"
        );
      }
      if (!sig.hasGoal) {
        badLines.push(
          "アルバイトを学チカにする場合は、「何を目標に」「何を変え」「どう良くなったか」を示せないと弱く見えます。目標（売上・満足度・効率など）を設定して語れる形にしてください。"
        );
      }
    }

    // 3) 継続性が弱い
    if (!sig.longTerm) {
      badLines.push(
        "継続性の情報が薄く、努力の重みが伝わりにくい状態です。期間（何ヶ月・何年）や頻度（毎週何回）を入れてください。可能なら現在も続けている形がベストです。"
      );
    }

    // 4) 他者評価がない
    if (!sig.thirdPartyEval) {
      badLines.push(
        "自分視点だけで完結しており、客観性が弱いです。指導者・顧客・チームなど“他者からどう評価されたか”を一文でいいので入れてください。"
      );
    }

    // 5) 具体性が弱い
    if (!sig.hasNumbers && !sig.hasProperNounish) {
      badLines.push(
        "内容が抽象的で、面接官が場面を描きにくいです。固有名詞（所属、活動名、役割）と数字（回数、人数、期間、成果）を必ず入れて具体化してください。"
      );
    }
  }

  // ペルソナ別の改善観点をスパイスとして追加
  switch (analysis.category) {
    case "motivation":
      badLines.push(
        persona.improvePatterns[2] +
          "。志望動機では、「この職場・この職種（この会社）だからこそ自分が惹かれている理由」を、具体的な経験と結び付けて話せると説得力が大きく高まります。"
      );
      break;
    case "selfPr":
      badLines.push(
        persona.improvePatterns[3] +
          "。自己PRは強みを述べるだけでなく、「その強みをどの場面で、どのように発揮してきたか」をストーリーとして伝えることが重要です。"
      );
      break;
    case "gakuchika":
      badLines.push(
        persona.improvePatterns[4] +
          "。学生時代の経験は、結果だけでなくプロセスや周囲との関わりを語ることで、あなたの人柄や働き方がより具体的に伝わります。"
      );
      break;
  }

  lines.push(joinSentences(goodLines) + "\n");
  lines.push(joinSentences(badLines) + "\n\n");

  return joinSentences(lines);
}

// -------------------------------------------------------------
// 全体総評（人格ベース）
// -------------------------------------------------------------
function buildOverallSection(
  mode: ModeTag,
  analyses: CategoryAnalysis[]
): string {
  const persona = pickPersona(mode);
  const lines: string[] = [];

  lines.push("【総合コメント】\n");
  lines.push(
    `${persona.role}として全体を見たとき、あなたの回答には「自分の経験や思いをきちんと言葉にしよう」という姿勢がはっきりと感じられます。`
  );

  const weakStruct = analyses.filter(
    (a) => !a.hasConclusion || !a.hasReason || !a.hasExample
  );
  if (weakStruct.length > 0) {
    lines.push(
      "一方で、いくつかの質問では、【結論→理由→具体的なエピソード→そこからの学び】という流れが途中で薄くなる場面があり、聞き手が場面をイメージしづらくなる箇所も見受けられます。"
    );
  }

  lines.push(
    "どの質問についても、「まず何を伝えたいのか（結論）」「なぜそう考えるのか（理由）」「その考えに至るきっかけとなった具体的な場面」「そこから学んだこと・今後どう活かしたいか」という順番を意識して整理しておくと、話す側も聞く側も、ストーリーとして追いやすくなります。"
  );

  lines.push(
    persona.nextPatterns[1] +
      "。その上で、本トレーナーを繰り返し利用し、自分の回答が「筋の通ったストーリー」としてどこまで伝わるようになってきているかを振り返ることで、面接力は着実に伸びていきます。"
  );
  lines.push(
    "厳しめの指摘も含めてお伝えしましたが、現時点でここまで自分の経験を言語化できているのであれば、十分に伸びていける土台があります。日々の経験を丁寧に振り返りながら、「相手にとってイメージしやすい話し方とは何か」を意識して練習を重ねていってください。"
  );

  return joinSentences(lines);
}

// -------------------------------------------------------------
// 公開関数：モード＋回答一覧 → フィードバック文章を生成
// -------------------------------------------------------------
export function generateInterviewFeedback(
  mode: ModeTag,
  answers: AnswerSummary[]
): string {
  const persona = pickPersona(mode);

  // まず「意味のある回答」が1つでもあるかをチェック
  const meaningful = answers.filter((a) => isMeaningfulAnswer(a.answerText));

  if (meaningful.length === 0) {
    // ふざけ入力・同じ文字の連打などの場合は、ここだけ返す
    return (
      "入力された内容からは、面接回答として評価できる情報が得られませんでした。\n" +
      "本気で面接力を高めたい場合は、実際の回答を文章として入力したうえで、もう一度トレーニングを行ってください。"
    );
  }

  // ハイライト抽出（good/bad、カテゴリ別）
  const allHighlights = extractHighlights(
    meaningful.map((a) => ({
      questionText: a.questionText,
      answerText: a.answerText,
    }))
  );

  // カテゴリ分析
  const cats: Category[] = ["motivation", "selfPr", "gakuchika"];
  const analyses: CategoryAnalysis[] = [];
  for (const c of cats) {
    const an = analyzeCategory(c, meaningful, allHighlights);
    if (an) analyses.push(an);
  }

  const header =
    `＜${persona.role}からのフィードバック＞\n` + `${persona.intro}\n\n`;

  // カテゴリごとのフィードバックを並べる
  let body = "";
  for (const an of analyses) {
    body += buildCategorySection(mode, an);
  }

  const overall = buildOverallSection(mode, analyses);

  const full = header + body + overall;

  return full;
}

