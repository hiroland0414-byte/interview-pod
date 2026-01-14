// src/lib/interview/threeMajor/evaluateThreeMajor.ts
// -------------------------------------------------------------
// 3大質問（志望動機/自己PR/ガクチカ）評価ロジック：専門家版
// - 第一印象10秒コメント：別ロジック（必ず生成）
// - 厳しめ/優しめ：トーン切替（点数は同じでも言い回しを切替）
// - 文章は「結果として」700〜1000字程度になりやすい設計（冗長は避ける）
// -------------------------------------------------------------

export type Tone = "gentle" | "strict";
export type QuestionType = "motivation" | "selfPR" | "gakuchika";

export type ThreeMajorScores = {
  conclusionFirst: number; // 結論先行（特に自己PRは必須）
  specificity: number;     // 具体性（固有名詞/数値/場面）
  feelings: number;        // 気持ち/価値観（なぜそう思ったか）
  structure: number;       // 構造（結論→理由→具体例→学び→貢献）
  relevance: number;       // 施設/職種/学びとの接続（志望動機で重要）
  clarity: number;         // 明瞭さ（短文化/言い切り/曖昧語の少なさ）
};

export interface ThreeMajorResult {
  evaluable: boolean; // 今回は沈黙判定をしない方針のため基本true
  scores: ThreeMajorScores;
  total: number; // 0..100
  firstImpressionComment: string; // 10秒専用
  comment: string; // 本文フィードバック（専門家版）
  flags?: {
    missingConclusion?: boolean;   // 自己PR「私の強みは〜」不足
    tooAbstract?: boolean;         // 抽象語が多い
    weakFeelings?: boolean;        // 気持ち/価値観が薄い
    weakEvidence?: boolean;        // 具体例が弱い
    weakFit?: boolean;             // 志望動機の接続弱い
  };
}

type Input = {
  questionType: QuestionType;
  transcript: string;
  tone?: Tone;
};

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const round = (v: number) => Math.round(v);

const clean = (t: string) => (t || "").replace(/\s+/g, "").trim();
const count = (t: string, re: RegExp) => (t.match(re) || []).length;

const hasAny = (t: string, patterns: RegExp[]) => patterns.some((p) => p.test(t));

/** 第一印象10秒（別ロジック）
 *  - 内容に踏み込まず「立ち上がり/言い切り/礼節」だけを見る
 *  - 10秒そのものを切り出せないので、冒頭に出やすい語から推定する（安全で壊れにくい）
 */
export function buildFirstImpression10sComment(transcript: string, tone: Tone): string {
  const t = transcript || "";
  const c = clean(t);

  const hasGreeting = /よろしくお願(い|します)|本日は|ありがとうございます|失礼(い)?たします/.test(t);
  const hasName = /と申します|です。/.test(t);
  const hasConclusionSignal =
    /結論|私の強みは|私が大切にしているのは|志望理由は|取り組んだことは/.test(t);

  const strict = tone === "strict";

  // 言い回しテンプレ（短く、刺さる）
  const a = strict
    ? "最初の10秒は評価の“入口”です。"
    : "最初の10秒は第一印象を決める大事な区間です。";

  const b = hasGreeting
    ? (strict ? "礼節は入っていますが、" : "礼節が入っていて、")
    : (strict ? "礼節の一言が無く、" : "礼節の一言が入ると、");

  const c2 = hasConclusionSignal
    ? (strict ? "結論の立ち上げができています。" : "結論の立ち上げができています。")
    : (strict ? "結論が出るまでが長く、評価は伸びません。" : "結論を一文先に置くだけで印象が上がります。");

  const d = hasName
    ? (strict ? "名乗りは通っています。" : "名乗りが通っています。")
    : (strict ? "名乗りが曖昧です。" : "名乗りを一度言い切ると安定します。");

  // 120〜160字程度に収める
  return `${a}${b}${d}${c2}`;
}

/** 抽象語（ありがちワード） */
const ABSTRACT_WORDS = [
  /コミュニケーション(力)?/,
  /協調性/,
  /主体性/,
  /努力/,
  /頑張/,
  /成長/,
  /貢献/,
  /責任感/,
  /真面目/,
];

/** 具体化を促すフレーズ */
const promptConcrete = (tone: Tone) =>
  tone === "strict"
    ? "抽象語のままでは評価は上がりません。『どの場面で／何をして／相手がどう変わったか』まで言い切ってください。"
    : "抽象語は誰でも言えるので、『どの場面で／何をして／相手がどう変わったか』まで具体化できると一気に強くなります。";

function scoreConclusionFirst(q: QuestionType, t: string) {
  // 自己PRは最重要：「私の強みは〇〇です」に近い構文を強く評価
  if (q === "selfPR") {
    if (/私の強みは/.test(t)) return 92;
    if (/強み|得意|長所/.test(t)) return 72;
    return 48;
  }
  // 志望動機：志望理由は〜/結論は〜 が早いほど良い
  if (q === "motivation") {
    if (/志望(理由|動機)は/.test(t)) return 86;
    if (/結論/.test(t)) return 80;
    return 60;
  }
  // ガクチカ：最初に「取り組んだこと」を言えるか
  if (/学生時代|力を入れた|取り組んだ/.test(t)) return 84;
  return 62;
}

function scoreSpecificity(t: string) {
  // 数字・固有名詞・役割・期間・場面の痕跡
  const num = count(t, /[0-9０-９]+/g);
  const time = count(t, /(ヶ月|か月|年|週間|週|日|回|人|名|件|％|パーセント)/g);
  const place = count(t, /(病院|施設|部活|サークル|アルバイト|実習|委員会|研究|ゼミ|学会)/g);
  const scene = count(t, /(具体的に|例えば|その時|〜の場面|〜した際)/g);

  const raw = num * 8 + time * 10 + place * 8 + scene * 10;
  // だいたい 0〜120 くらいになるので圧縮
  return clamp(round(raw * 0.9));
}

function scoreFeelings(t: string) {
  // 気持ち・価値観・動機の言語化
  const emo = count(t, /(悔し|嬉し|不安|緊張|達成|やりがい|悩|葛藤|楽しかった|大変|苦労)/g);
  const why = count(t, /(なぜなら|理由は|背景は|きっかけ|大切にしている|価値観)/g);
  const reflect = count(t, /(学(ん|び)|気づ(い|き)|反省|改善|工夫)/g);

  const raw = emo * 12 + why * 14 + reflect * 10;
  return clamp(round(raw * 0.9));
}

function scoreStructure(t: string) {
  // 結論→理由→具体例→学び→貢献（型の痕跡）
  const markers = [
    /(結論|私の強みは|志望(理由|動機)は|取り組んだことは)/,
    /(理由は|なぜなら|背景は)/,
    /(例えば|具体的に|その時)/,
    /(学(ん|び)|気づ(い|き)|改善|工夫)/,
    /(活か|貢献|今後|入職後|御院|貴院|御施設|貴施設)/,
  ];
  const hit = markers.reduce((acc, re) => acc + (re.test(t) ? 1 : 0), 0);
  return [40, 55, 68, 82, 92, 96][hit] ?? 55;
}

function scoreRelevance(q: QuestionType, t: string) {
  if (q !== "motivation") {
    // 他2問は「職種/役割との接続」が出ていれば加点
    const fit = hasAny(t, [
      /(診療放射線技師|放射線|画像|CT|MRI|検査|患者|チーム医療|安全管理)/,
      /(貴院|御院|貴施設|御施設|臨床|実習)/,
    ]);
    return fit ? 78 : 62;
  }
  // 志望動機は “だからこの施設/この職種” の接続が生命線
  const hasJob = /(診療放射線技師|放射線|画像|検査|患者)/.test(t);
  const hasPlace = /(貴院|御院|貴施設|御施設|理念|方針|地域|救急|がん|健診|教育)/.test(t);
  const hasBridge = /(だから|そのため|ゆえに|結果として|貴院で|御施設で)/.test(t);

  const score = (hasJob ? 1 : 0) + (hasPlace ? 1 : 0) + (hasBridge ? 1 : 0);
  return score === 3 ? 92 : score === 2 ? 78 : score === 1 ? 62 : 48;
}

function scoreClarity(t: string) {
  // 曖昧語/冗長感を軽くペナルティ（安全に）
  const vague = count(t, /(いろいろ|様々|色々|なんとなく|たぶん|〜だと思います|とか)/g);
  const longish = clean(t).length > 520 ? 1 : 0; // 長すぎると焦点がぼけやすい
  const polite = /です。|ます。/.test(t) ? 1 : 0;

  let s = 78 + polite * 6 - vague * 10 - longish * 6;
  return clamp(round(s));
}

function buildExpertFeedbackBody(
  q: QuestionType,
  transcript: string,
  tone: Tone,
  scores: ThreeMajorScores,
  flags: ThreeMajorResult["flags"]
) {
  const strict = tone === "strict";

  const title =
    q === "motivation" ? "志望動機" : q === "selfPR" ? "自己PR" : "学生時代に力を入れたこと";

  const line = (gentle: string, strictMsg: string) => (strict ? strictMsg : gentle);

  // “面接官の評価”の芯：一言で総評
  let verdict = "";
  if ((scores.specificity + scores.feelings + scores.structure) / 3 >= 78) {
    verdict = line(
      "面接官としては「深掘りしたくなる材料」が揃っており、前向きに評価できます。",
      "材料は揃っています。ここから先は“言い切り”と“因果”で勝負してください。"
    );
  } else {
    verdict = line(
      "方向性は悪くありませんが、面接官が判断に必要な“材料”が少し不足しています。",
      "現状だと材料不足です。抽象語を捨て、具体・感情・因果を入れないと評価は伸びません。"
    );
  }

  // 問い別のコア指摘
  const core: string[] = [];
  if (q === "selfPR") {
    if (flags?.missingConclusion) {
      core.push(
        line(
          "自己PRは冒頭の一文が勝負です。「私の強みは〇〇です」と言い切るだけで、面接官の理解が一気に進みます。",
          "自己PRの冒頭で結論が出ていません。「私の強みは〇〇です」を最初に言えないと、評価は取りに行けません。"
        )
      );
    } else {
      core.push(
        line(
          "冒頭で強みを言い切れている点は良いスタートです。面接官はその後に“再現性”を探します。",
          "冒頭の結論は出ています。次は“再現性”を数字と場面で示してください。"
        )
      );
    }
  }

  if (flags?.tooAbstract) {
    core.push(promptConcrete(tone));
  }

  if (flags?.weakFeelings) {
    core.push(
      line(
        "経験そのものは伝わりますが、「なぜそう感じ、何を大切にして行動したか」がもう一段欲しいです。面接官はここで“人柄”を見ます。",
        "経験だけでは足りません。「なぜそう感じたか／何を大切にしたか」が無いと“あなたである理由”が出ません。"
      )
    );
  }

  if (q === "motivation" && flags?.weakFit) {
    core.push(
      line(
        "志望動機は「職種の理解」＋「施設の特徴」＋「自分の経験」の接続が鍵です。現状は接続がやや弱いので、1文で橋を架けましょう。",
        "志望動機の接続が弱いです。「だから貴院」を1文で言い切れないと、どこでも通じる文章に見えます。"
      )
    );
  }

  // 次の一手（超具体）
  const next: string[] = [];
  next.push(
    line(
      "次回は、最初の一文を固定しましょう（テンプレ可）。",
      "次回は“型”を固定してください。"
    )
  );

  if (q === "selfPR") {
    next.push("① 私の強みは〇〇です。");
    next.push("② それが発揮された場面は（いつ／どこで／役割）。");
    next.push("③ 具体的にやった行動は（3つまで）。");
    next.push("④ 相手・成果がどう変わったか（数字 or 具体反応）。");
    next.push("⑤ 入職後にどう活かすか（1文）。");
  } else if (q === "motivation") {
    next.push("① 志望理由は〇〇です。");
    next.push("② そう思った背景（経験・価値観）は〇〇です。");
    next.push("③ 貴院の特徴（理念/領域/地域性）で惹かれた点は〇〇です。");
    next.push("④ だから貴院で、〇〇に取り組みたい（貢献）です。");
  } else {
    next.push("① 取り組んだことは〇〇です（役割つき）。");
    next.push("② 課題は〇〇でした。");
    next.push("③ 工夫した行動は〇〇です（具体）。");
    next.push("④ 結果（数字/評価/変化）は〇〇です。");
    next.push("⑤ 学びを次にどう活かすか（職種接続）を1文。");
  }

  // 文章を組み立て（見出し付き）
  const body: string[] = [];
  body.push(`【総評（${title}）】`);
  body.push(verdict);
  body.push("");
  body.push("【良かったところ】");
  body.push(
    line(
      `結論先行：${scores.conclusionFirst}点／構造：${scores.structure}点。面接官が聞き取りやすい“型”に近づいています。`,
      `結論先行：${scores.conclusionFirst}点／構造：${scores.structure}点。型は作れます。今は徹底が足りません。`
    )
  );

  if (scores.specificity >= 75) {
    body.push("具体性があり、場面が想像しやすい点は評価できます。");
  } else {
    body.push("具体例がまだ薄く、面接官が深掘りする材料が不足しています。");
  }

  body.push("");
  body.push("【改善したいところ】");
  if (core.length === 0) {
    body.push(
      line(
        "大崩れはありません。次は“数字・場面・因果”を増やして説得力を上げましょう。",
        "大崩れはありませんが、上位評価には届きません。“数字・場面・因果”を足して説得力を作ってください。"
      )
    );
  } else {
    core.forEach((x) => body.push(x));
  }

  body.push("");
  body.push("【次の一手（この順で話す）】");
  next.forEach((x) => body.push(x));

  // だいたい 700〜1000字付近に収まりやすい
  return body.join("\n");
}

export function evaluateThreeMajor(input: Input): ThreeMajorResult {
  const tone: Tone = input.tone ?? "strict";
  const t = input.transcript || "";
  const c = clean(t);
  const q = input.questionType;

  // flags
  const missingConclusion = q === "selfPR" && !/私の強みは/.test(t);
  const abstractHits = ABSTRACT_WORDS.reduce((acc, re) => acc + (re.test(t) ? 1 : 0), 0);
  const tooAbstract = abstractHits >= 2 && scoreSpecificity(t) < 70;

  const sConclusion = scoreConclusionFirst(q, t);
  const sSpec = scoreSpecificity(t);
  const sFeel = scoreFeelings(t);
  const sStruct = scoreStructure(t);
  const sRel = scoreRelevance(q, t);
  const sClarity = scoreClarity(t);

  const weakFeelings = sFeel < 65;
  const weakEvidence = sSpec < 65;
  const weakFit = q === "motivation" ? sRel < 70 : false;

  // total（質問タイプで重み変える）
  let total = 0;
  if (q === "selfPR") {
    total =
      sConclusion * 0.24 +
      sSpec * 0.22 +
      sFeel * 0.16 +
      sStruct * 0.18 +
      sRel * 0.08 +
      sClarity * 0.12;
  } else if (q === "motivation") {
    total =
      sConclusion * 0.18 +
      sSpec * 0.18 +
      sFeel * 0.16 +
      sStruct * 0.18 +
      sRel * 0.20 +
      sClarity * 0.10;
  } else {
    total =
      sConclusion * 0.16 +
      sSpec * 0.24 +
      sFeel * 0.18 +
      sStruct * 0.20 +
      sRel * 0.10 +
      sClarity * 0.12;
  }

  total = clamp(round(total));

  const scores: ThreeMajorScores = {
    conclusionFirst: clamp(round(sConclusion)),
    specificity: clamp(round(sSpec)),
    feelings: clamp(round(sFeel)),
    structure: clamp(round(sStruct)),
    relevance: clamp(round(sRel)),
    clarity: clamp(round(sClarity)),
  };

  const firstImpressionComment = buildFirstImpression10sComment(t, tone);

  const comment = buildExpertFeedbackBody(q, t, tone, scores, {
    missingConclusion,
    tooAbstract,
    weakFeelings,
    weakEvidence,
    weakFit,
  });

  return {
    evaluable: true,
    scores,
    total,
    firstImpressionComment,
    comment,
    flags: {
      missingConclusion,
      tooAbstract,
      weakFeelings,
      weakEvidence,
      weakFit,
    },
  };
}
