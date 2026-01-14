// src/lib/feedback.ts

// モード種別（現在の実装に合わせて調整）
export type ModeTag = "A1" | "A2" | "B" | "C";

// 質問情報（必要最低限）
export type QuestionItem = {
  id: string;
  text: string;
  core?: boolean; // コア質問（志望動機・自己PR・ガクチカなど）
};

export type RadarAxis = {
  key: string;
  label: string;
  score: number; // 1〜5
};

export type FeedbackSection = {
  title: string;
  body: string;
};

export type FeedbackResult = {
  mode: ModeTag;
  summary: {
    good: FeedbackSection;
    improve: FeedbackSection;
    next: FeedbackSection;
  };
  radar: RadarAxis[];
  // 画面やPDFで使いやすいように、全部つなげた本文も返す
  fullText: string;
};

// ----------------------------------------------------------------------
// ① 軽いテキスト分析ユーティリティ
// ----------------------------------------------------------------------

function normalize(text: string): string {
  return (text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function countCharsJa(text: string): number {
  return normalize(text).length;
}

function containsAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

// 単語（名詞っぽいもの）をざっくりカウント
function estimateRichness(text: string): number {
  const t = normalize(text);
  if (!t) return 0;
  const tokens = t
    .split(/[\s。、．，・,.!?！？]/)
    .map((x) => x.trim())
    .filter((x) => x.length > 1);
  const uniq = new Set(tokens);
  return uniq.size;
}

// ----------------------------------------------------------------------
// ② モード別の評価軸定義（あとで modePersonas.json に寄せてもOK）
// ----------------------------------------------------------------------

const MODE_AXES: Record<ModeTag, RadarAxis[]> = {
  A1: [
    { key: "empathy", label: "患者理解・共感", score: 0 },
    { key: "logic", label: "論理性・構成力", score: 0 },
    { key: "professional", label: "専門性・責任感", score: 0 },
    { key: "team", label: "チーム連携", score: 0 },
    { key: "growth", label: "成長意欲", score: 0 },
  ],
  A2: [
    { key: "empathy", label: "患者・家族への寄り添い", score: 0 },
    { key: "communication", label: "コミュニケーション力", score: 0 },
    { key: "professional", label: "看護観・専門性", score: 0 },
    { key: "team", label: "多職種連携", score: 0 },
    { key: "growth", label: "学び続ける姿勢", score: 0 },
  ],
  B: [
    { key: "service", label: "接遇・サービス意識", score: 0 },
    { key: "efficiency", label: "段取り・効率性", score: 0 },
    { key: "communication", label: "説明力", score: 0 },
    { key: "team", label: "協調性", score: 0 },
    { key: "growth", label: "改善意識", score: 0 },
  ],
  C: [
    { key: "business", label: "ビジネス理解", score: 0 },
    { key: "logic", label: "論理性・説得力", score: 0 },
    { key: "initiative", label: "主体性・推進力", score: 0 },
    { key: "team", label: "チームワーク", score: 0 },
    { key: "growth", label: "成長・キャリア志向", score: 0 },
  ],
};

// ----------------------------------------------------------------------
// ③ 回答全体からスコアリング
// ----------------------------------------------------------------------

type ScoreContext = {
  totalChars: number;
  avgChars: number;
  richness: number;
  empathyHits: number;
  teamHits: number;
  growthHits: number;
  professionalHits: number;
  businessHits: number;
};

function analyzeAnswersRaw(allText: string): ScoreContext {
  const t = normalize(allText);

  const totalChars = countCharsJa(t);
  const richness = estimateRichness(t);

  const empathyWords = ["患者", "利用者", "ご家族", "不安", "気持ち", "寄り添", "安心"];
  const teamWords = ["チーム", "連携", "協力", "一緒に", "多職種"];
  const growthWords = ["成長", "学び", "振り返", "改善", "挑戦", "反省"];
  const professionalWords = [
    "放射線",
    "CT",
    "MRI",
    "被ばく",
    "安全",
    "看護",
    "ケア",
    "アセスメント",
  ];
  const businessWords = ["医療機器", "開発", "営業", "企画", "マーケティング", "ソリューション"];

  const empathyHits = containsAny(t, empathyWords) ? 1 : 0;
  const teamHits = containsAny(t, teamWords) ? 1 : 0;
  const growthHits = containsAny(t, growthWords) ? 1 : 0;
  const professionalHits = containsAny(t, professionalWords) ? 1 : 0;
  const businessHits = containsAny(t, businessWords) ? 1 : 0;

  // ざっくり平均文字数（質問数で割る方が厳密だが、ここでは総文字数から推定）
  const avgChars = totalChars / 5; // 「三大質問＋α」を想定してざっくり

  return {
    totalChars,
    avgChars,
    richness,
    empathyHits,
    teamHits,
    growthHits,
    professionalHits,
    businessHits,
  };
}

function scoreFromRange(value: number, min: number, max: number): number {
  if (value <= min) return 1;
  if (value >= max) return 5;
  const ratio = (value - min) / (max - min);
  return Math.round(1 + ratio * 4); // 1〜5 に丸め
}

function buildRadar(mode: ModeTag, ctx: ScoreContext): RadarAxis[] {
  const base = MODE_AXES[mode].map((a) => ({ ...a }));

  for (const axis of base) {
    switch (axis.key) {
      case "empathy":
        axis.score = ctx.empathyHits ? scoreFromRange(ctx.totalChars, 300, 1400) : 2;
        break;
      case "communication":
        axis.score = scoreFromRange(ctx.richness, 15, 60);
        break;
      case "logic":
        axis.score = scoreFromRange(ctx.richness, 20, 70);
        break;
      case "professional":
        axis.score = ctx.professionalHits ? scoreFromRange(ctx.totalChars, 300, 1400) : 2;
        break;
      case "team":
        axis.score = ctx.teamHits ? scoreFromRange(ctx.totalChars, 300, 1200) : 2;
        break;
      case "growth":
        axis.score = ctx.growthHits ? scoreFromRange(ctx.totalChars, 300, 1200) : 2;
        break;
      case "service":
        axis.score = scoreFromRange(ctx.totalChars, 300, 1200);
        break;
      case "efficiency":
        axis.score = scoreFromRange(ctx.richness, 10, 50);
        break;
      case "business":
        axis.score = ctx.businessHits ? scoreFromRange(ctx.totalChars, 300, 1400) : 2;
        break;
      case "initiative":
        axis.score = scoreFromRange(ctx.richness, 15, 60);
        break;
      default:
        axis.score = scoreFromRange(ctx.totalChars, 300, 1400);
    }
  }

  return base;
}

// ----------------------------------------------------------------------
// ④ 文章生成（良かったところ / 改善点 / 次の一手）
//    ざっくり 1200 文字前後（30/40/30）を目指した構造
// ----------------------------------------------------------------------

function buildGoodPart(mode: ModeTag, ctx: ScoreContext, radar: RadarAxis[]): string {
  const highAxes = radar.filter((a) => a.score >= 4).map((a) => a.label);
  const midAxes = radar.filter((a) => a.score === 3).map((a) => a.label);

  const introByMode: Record<ModeTag, string> = {
    A1: "診療放射線技師を志望する学生として、全体に落ち着いた印象で、ご自身の経験や思いを言葉にしようとしている点が伝わってきました。",
    A2: "看護職を志望する学生として、患者さんやご家族に対するあたたかい視線が感じられる回答になっていました。",
    B: "健診・クリニック志望として、受診者に安心してもらいたいという気持ちがにじむ内容になっていました。",
    C: "企業（医療関連）志望として、医療現場の経験をビジネス側で活かしたいという方向性が整理されつつある印象でした。",
  };

  const lines: string[] = [];
  lines.push(introByMode[mode]);

  if (ctx.totalChars >= 700) {
    lines.push(
      "志望動機や自己PRについても、一定のボリュームで具体的なエピソードを書こうとしている点は、とても良い土台になっています。"
    );
  } else {
    lines.push(
      "志望動機や自己PRは、まだやや短めではありますが、限られた文字数の中でもご自身の経験を伝えようとする姿勢が見られます。"
    );
  }

  if (highAxes.length > 0) {
    lines.push(
      `特に「${highAxes.join(
        "・"
      )}」の観点では、日頃から意識していることや具体的な行動が文章の中に表現されており、面接官にも伝わりやすい強みになっていました。`
    );
  } else if (midAxes.length > 0) {
    lines.push(
      `現時点では「${midAxes.join(
        "・"
      )}」あたりが、今後さらに伸ばしていきやすいベースの力として感じられます。`
    );
  }

  if (ctx.richness >= 35) {
    lines.push(
      "語彙も比較的豊かで、同じ表現を繰り返しすぎずに書こうとしている点も良いポイントです。"
    );
  } else {
    lines.push(
      "言い回し自体はまだシンプルですが、自分の経験を素直な言葉で伝えようとする姿勢は、面接の場でもプラスに働きます。"
    );
  }

  return lines.join(" ");
}

function buildImprovePart(mode: ModeTag, ctx: ScoreContext, radar: RadarAxis[]): string {
  const lowAxes = radar.filter((a) => a.score <= 2).map((a) => a.label);

  const lines: string[] = [];
  lines.push(
    "一方で、面接本番を意識したときに、もう一段レベルアップできそうなポイントもいくつか見えてきました。"
  );

  if (ctx.totalChars < 800) {
    lines.push(
      "まず、全体の文字数がやや少なめであるため、面接官が「その経験の背景」「あなた自身が何を考えたのか」をイメージしきれない可能性があります。エピソードの場面設定や、そこでの自分の感情・工夫を、もう一歩だけ丁寧に書き足していきましょう。"
    );
  } else {
    lines.push(
      "志望動機や自己PRの分量は十分ですが、要点がやや分散してしまう傾向も見られます。「結論 → 理由・エピソード → 学び・今後」という流れを意識して、話を整理していくと、より説得力が増していきます。"
    );
  }

  if (lowAxes.length > 0) {
    lines.push(
      `今回の回答からみると、「${lowAxes.join(
        "・"
      )}」の観点は、今後意識して伸ばしていける余地がありそうです。`
    );
  }

  switch (mode) {
    case "A1":
      lines.push(
        "診療放射線技師の場合、「患者さんの不安をどう受け止め、どのような声かけや配慮を行ったのか」を、もう少し具体的な場面とセットで語れるようになると、医療者としてのイメージが一気に伝わりやすくなります。"
      );
      lines.push(
        "また、放射線安全やチーム医療への視点が文章の中ににじんでくると、「現場を理解している学生」という印象を一段と強めることができます。"
      );
      break;
    case "A2":
      lines.push(
        "看護職では、「その人らしさ」を支える視点や、患者さん・家族との関わり方をどれだけ具体的に語れるかが重要です。単に優しさを述べるだけでなく、どのような観察や判断を行い、どうケアに結びつけたのかを言語化していきましょう。"
      );
      break;
    case "B":
      lines.push(
        "健診やクリニックでは、限られた時間の中で安心感を届けるコミュニケーションが求められます。「初対面の受診者にどう声をかけ、どのように緊張を和らげたのか」を具体例で語れるようにしておくと良いでしょう。"
      );
      break;
    case "C":
      lines.push(
        "企業志望の場合は、「医療の現場経験」と「ビジネスの視点」をどうつなげて考えているかを、もう一歩だけ論理的に説明できると説得力が増します。単なる志望理由ではなく、「自分だからこそ提供できる価値」を言語化してみてください。"
      );
      break;
  }

  return lines.join(" ");
}

function buildNextStepPart(mode: ModeTag, ctx: ScoreContext, radar: RadarAxis[]): string {
  const lines: string[] = [];

  lines.push(
    "今後の取り組みとしては、今回書いた内容をベースにしつつ、「伝える順番」と「キーワード」の磨き込みを行っていくのがおすすめです。"
  );

  lines.push(
    "まずは、今回の回答の中から自分でも大事だと思うエピソードを1〜2つ選び、【結論 → 具体例 → 学び・今後】の流れで、声に出して練習してみましょう。文字にした内容をそのまま読むのではなく、話し言葉に少し崩しながらも、キーワードだけは外さない練習がポイントです。"
  );

  switch (mode) {
    case "A1":
      lines.push(
        "そのうえで、「患者さんの不安にどう寄り添ったか」「チームの中でどう動いたか」「放射線安全や被ばく低減への意識」を、それぞれ一言ずつでも添えていけると、放射線技師としての専門性と人柄がバランスよく伝わります。"
      );
      break;
    case "A2":
      lines.push(
        "看護観や、理想とする看護師像について、自分なりの言葉で短く表現できるようにしておくと、どの質問を受けても軸がぶれにくくなります。"
      );
      break;
    case "B":
      lines.push(
        "健診・クリニックでは、スムーズな案内や声かけの工夫も評価対象になります。アルバイトや部活動での接客経験なども、どのように医療現場で活かせそうか、言葉にして整理してみてください。"
      );
      break;
    case "C":
      lines.push(
        "企業志望の場合は、「どのような課題をもつ医療現場や患者さんに、どんな価値を届けたいか」を、30秒程度で語れるようにしておくと、面接官の印象に残りやすくなります。"
      );
      break;
  }

  lines.push(
    "このトレーナーで何度か回答を更新しながら、自分の言葉が少しずつ洗練されていくプロセス自体を楽しんで取り組んでみてください。"
  );

  return lines.join(" ");
}

// ----------------------------------------------------------------------
// ⑤ 公開関数：モード＋質問＋回答 → フィードバック一式
// ----------------------------------------------------------------------

export function buildInterviewFeedback(params: {
  mode: ModeTag;
  questions: QuestionItem[];
  answers: string[];
}): FeedbackResult {
  const { mode, questions, answers } = params;

  // 一旦、全回答を連結して「全体イメージ」をスコアリング
  const mergedText = answers.join("。");
  const ctx = analyzeAnswersRaw(mergedText);

  const radar = buildRadar(mode, ctx);

  const goodBody = buildGoodPart(mode, ctx, radar);
  const improveBody = buildImprovePart(mode, ctx, radar);
  const nextBody = buildNextStepPart(mode, ctx, radar);

  const good: FeedbackSection = {
    title: "良かったところ（約30％）",
    body: goodBody,
  };
  const improve: FeedbackSection = {
    title: "改善したいところ（約40％）",
    body: improveBody,
  };
  const next: FeedbackSection = {
    title: "次の一手と励まし（約30％）",
    body: nextBody,
  };

  const fullText =
    `【${good.title}】\n${good.body}\n\n` +
    `【${improve.title}】\n${improve.body}\n\n` +
    `【${next.title}】\n${next.body}`;

  return {
    mode,
    summary: { good, improve, next },
    radar,
    fullText,
  };
}
