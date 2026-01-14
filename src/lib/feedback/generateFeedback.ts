// src/lib/feedback/generateFeedback.ts
import { analyzeAnswers as rawAnalyze } from "./analyzeAnswers";
import * as personasRaw from "@/lib/persona/modePersonas.json";

type ModeTag = "A1" | "A2" | "B" | "C" | "IMPRESSION";

type QuestionItem = {
  id: string;
  text: string;
  core?: boolean;
};

type FeedbackBlocks = {
  good: string;
  improve: string;
  next: string;
};

const personas: any = personasRaw;

// 型の衝突を避けるために any にキャストして呼び出す
const analyze: any = rawAnalyze;

/**
 * 回答＋モードから 3ブロックのフィードバック文を生成
 */
export function buildFeedback(
  mode: ModeTag,
  questions: QuestionItem[],
  answers: string[]
): FeedbackBlocks {
  const persona = personas[mode] || personas["A1"] || {};
  const personaName: string =
    persona.personaName || "面接官";
  const label: string =
    persona.label ||
    (mode === "A1"
      ? "病院（診療放射線技師）"
      : mode === "A2"
      ? "病院（看護師）"
      : mode === "B"
      ? "健診／クリニック"
      : mode === "C"
      ? "企業（医療関連）"
      : "印象アップ");

  const joined = answers.join("。");
  const totalChars = joined.length;

  // 解析結果（なければ安全にフォールバック）
  let analysis: any = null;
  try {
    analysis = analyze(mode, questions, answers);
  } catch (e) {
    console.warn("analyzeAnswers failed, fallback only:", e);
  }

  const avgChars =
    analysis?.avgChars ??
    (answers.length ? Math.round(totalChars / answers.length) : 0);
  const coreOkCount =
    analysis?.coreSatisfied ??
    answers.filter((a, i) => {
      const q = questions[i];
      return q?.core ? (a || "").length >= 200 : false;
    }).length;
  const riskFlags: string[] = analysis?.riskFlags ?? [];
  const keywordHits: string[] = analysis?.keywordHits ?? [];
  const positivity =
    typeof analysis?.positivity === "number"
      ? analysis.positivity
      : 0.6;

  // ---- 良かった点（約30%）----
  const good = [
    `${personaName}として拝見すると、全体としては${label}の面接で求められる基本的なポイントはしっかり意識できています。`,
    `特に、回答のボリュームは平均で約${avgChars}文字ほどあり、考えを言語化しようとする姿勢がうかがえます。`,
    coreOkCount > 0
      ? `コアとなる三大質問（志望動機・自己PR・学生時代に力を入れたこと）のうち、${coreOkCount}問では200文字以上の深さが出ており、エピソードの背景や気持ちまで伝えようとしている点は、とても良い傾向です。`
      : `まだ文字数としてはコンパクトな回答が多いものの、「なぜそう思ったのか」「どのように行動したのか」を書こうとしている片鱗は見られます。`,
    keywordHits.length
      ? `また、回答の中には「${keywordHits
          .slice(0, 5)
          .join("」「")}」といった、${label}の現場で評価されやすいキーワードも含まれており、志望分野のイメージを持って準備できていることが伝わってきます。`
      : `さらに、チームワークや患者さん・利用者さんへの寄り添いといった、現場で大切にされる価値観を意識している部分も読み取れ、方向性としては良いラインに乗っています。`,
    positivity >= 0.6
      ? `全体のトーンも前向きで、「成長したい」「貢献したい」という意欲が文章からにじんでいる点は、${label}の採用担当としても安心感につながるポイントです。`
      : `表現はやや控えめながらも、自分なりに前向きに取り組んできた経験がにじんでおり、落ち着いた印象を与えられている点も強みになりうるでしょう。`,
  ].join("\n\n");

  // ---- 改善したい点（約40%）----
  const improveParts: string[] = [];

  if (avgChars < 180) {
    improveParts.push(
      `一方で、回答の平均文字数がやや少なく、面接官側から見ると「もう一歩踏み込んで聞いてみたい」と感じる場面が多くなりそうです。特にコアの三大質問では、最低でも200〜250文字程度は使って、「きっかけ → 具体的なエピソード → そこから学んだこと・今後どう活かすか」という流れを意識できると、説得力が一気に増します。`
    );
  } else {
    improveParts.push(
      `一方で、文字数としては十分に書けている反面、「結論」と「理由・具体例」の整理がやや曖昧になっている部分があります。読み手からすると、まず一文目で結論をはっきり伝え、そのあとで具体例を補足する構成に整えると、より頭に入りやすい回答になります。`
    );
  }

  if (riskFlags.length) {
    improveParts.push(
      `また、回答の中には、少しだけ気をつけたい表現や、誤解される可能性のあるポイントも見受けられました（例：${riskFlags
        .slice(0, 3)
        .join("、")} など）。これらは「能力がない」というより、言い方や順番の問題であることが多いため、「相手がどう受け取るか」をイメージしながら表現を一段階マイルドにすることをおすすめします。`
    );
  } else {
    improveParts.push(
      `大きなNG表現は見られませんが、「当たり前のことを言っているだけ」と受け止められないようにするためには、もう一歩だけ具体性を増やす工夫が必要です。「忙しい現場でも」「検査が立て込んだ状況で」「チーム内で意見が割れたときに」など、状況が目に浮かぶ一言を添えるだけでも、印象が大きく変わります。`
    );
  }

  improveParts.push(
    `さらに、${label}では「安全・正確さ」と同じくらい「コミュニケーション」や「多職種連携」への姿勢が重視されます。回答の中に、患者さん・利用者さん・同僚との関わり方や、他職種との連携エピソードをもう少しだけ混ぜ込んでいけると、現場でのイメージがぐっと伝わりやすくなります。`
  );

  const improve = improveParts.join("\n\n");

  // ---- 次の一手と励まし（約30%）----
  const nextParts: string[] = [];

  nextParts.push(
    `ここからのステップとしては、まず今回書いた（話した）内容をベースに、「各質問ごとに結論を一行で言ってみる」ことから始めてみてください。そのうえで、結論を裏付ける具体例を一つだけ選び、「いつ・どこで・誰と・何を・どうしたか」を短く整理していくと、自然と面接で話しやすい形にまとまってきます。`
  );

  nextParts.push(
    `次に、実際の面接を想定して、今回のトレーニングで作った回答を声に出して読んでみましょう。声に出してみることで、「言いにくい表現」「息継ぎしづらい長さ」が見えてきます。そこで、文を短く区切ったり、主語と述語の対応を整えたりすることで、聞き手にとっても理解しやすい話し方に近づきます。`
  );

  nextParts.push(
    `最後に、${label}の現場で働くイメージを具体的にするために、志望先の病院・健診センター・企業の公式サイトや採用ページを改めて確認し、「大切にしている価値観」「求める人物像」のキーワードを3〜5個メモしてみましょう。そのキーワードと今回の回答を照らし合わせて、「どこがつながっているか」「どこを補強するとよさそうか」を考えていくことで、志望動機や自己PRに一貫性が生まれます。`
  );

  nextParts.push(
    `一度で完璧な回答を作る必要はありません。今回の結果は、あくまで「現時点のスナップショット」です。ここから少しずつブラッシュアップしていければ、面接本番では今よりずっと自信を持って、自分の言葉で話せるようになっていきます。焦らず、一歩ずつ一緒に整えていきましょう。`
  );

  const next = nextParts.join("\n\n");

  return { good, improve, next };
}
