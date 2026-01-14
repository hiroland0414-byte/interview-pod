// src/lib/feedback/generate.ts

export type ModeTag = "A1" | "A2" | "B" | "C";

export type QAItem = {
  id: string;
  question: string;
  answer: string;
};

export type FeedbackSections = {
  good: string;    // 良かったところ
  improve: string; // 改善したいところ
  next: string;    // 次の一手と励まし
};

// 簡易スコアリング：テキスト全体から傾向をざっくり見る
function analyzeAnswers(allText: string) {
  const len = allText.length;

  const hasPatient = /患者|利用者|受診者|ご家族|高齢者/.test(allText);
  const hasEmpathy = /不安|安心|寄り添|気持ち|思い|立場|傾聴/.test(allText);
  const hasTeam =
    /チーム|協力|連携|報告|相談|連絡|カンファレンス|多職種/.test(allText);
  const hasChallenge =
    /挑戦|チャレンジ|工夫|改善|試行錯誤|継続|粘り強く|反省|振り返り/.test(
      allText
    );
  const hasLearning =
    /学び|学習|振り返り|フィードバック|復習|自己研鑽|勉強/.test(allText);

  const enthusiasmLevel =
    len > 800 || hasChallenge || hasLearning
      ? "高い"
      : len > 400
      ? "まずまず"
      : "やや弱い";

  const empathyLevel =
    hasPatient || hasEmpathy ? "見られる" : "やや弱いか不明";

  const teamworkLevel = hasTeam ? "一定に見られる" : "記述が少ない";

  return {
    len,
    enthusiasmLevel,
    empathyLevel,
    teamworkLevel,
    hasPatient,
    hasEmpathy,
    hasTeam,
    hasChallenge,
    hasLearning,
  };
}

// モードごとの面接官キャラ名
function getRoleLabel(mode: ModeTag): string {
  switch (mode) {
    case "A1":
      return "病院（診療放射線技師長）の立場から";
    case "A2":
      return "病院（看護師長）の立場から";
    case "B":
      return "健診・クリニック責任者の立場から";
    case "C":
      return "医療関連企業の採用担当の立場から";
    default:
      return "面接官の立場から";
  }
}

// モードごとの価値観コメント（導入文などで利用）
function getModeFocus(mode: ModeTag): string {
  switch (mode) {
    case "A1":
      return "医療安全・正確な検査・患者さんの不安を和らげる接遇の3つを特に重視して拝見しました。";
    case "A2":
      return "患者さんやご家族への思いやり、多職種連携、冷静な判断力の3点を軸に拝見しました。";
    case "B":
      return "短時間での丁寧な対応、業務の正確さ、説明のわかりやすさを中心に拝見しました。";
    case "C":
      return "医療業界への理解、論理性、自律的に課題へ取り組む姿勢の3点から総合的に拝見しました。";
    default:
      return "";
  }
}

// ここで 3 セクション分の文章を生成
export function generateFeedback(
  mode: ModeTag,
  qaList: QAItem[]
): FeedbackSections {
  const allText = qaList.map((q) => q.answer || "").join("\n");
  const analysis = analyzeAnswers(allText);

  const roleLabel = getRoleLabel(mode);
  const modeFocus = getModeFocus(mode);

  // --- 良かったところ（約30%） ---
  const goodParts: string[] = [];
  goodParts.push(
    `${roleLabel}、今回の回答全体から、${modeFocus}。全体として、質問に対して丁寧に言葉を選びながら答えようとしている姿勢が伝わってきました。`
  );

  if (analysis.enthusiasmLevel === "高い") {
    goodParts.push(
      "志望動機や自己PRでは、自分の経験と志望先を結びつけようとする記述が多く、熱意ややる気の高さが感じられます。単なる「興味がある」というレベルを超えて、行動としてどう表れているかを書こうとしている点は評価できます。"
    );
  } else if (analysis.enthusiasmLevel === "まずまず") {
    goodParts.push(
      "志望動機や自己PRには、ある程度の熱意ややる気が読み取れます。特に、自分なりに工夫した点や継続してきた取り組みについて触れようとする姿勢は、今後の伸びしろにつながる良い要素です。"
    );
  } else {
    goodParts.push(
      "文章量は控えめですが、それでも限られた中で自分の考えを整理しようとする意識は感じられます。まだ十分に書き切れていない部分もありますが、「伝えよう」とする姿勢があること自体は評価できます。"
    );
  }

  if (analysis.empathyLevel === "見られる") {
    goodParts.push(
      "また、相手の気持ちや立場に配慮した表現が含まれており、思いやりの視点が一定程度表れています。医療の現場で求められる「患者さんの不安に寄り添う姿勢」や「チームメンバーへの気配り」の素地が感じられる点は、強みとして今後も伸ばしていける部分です。"
    );
  } else {
    goodParts.push(
      "今回の回答の中では、人と関わる場面の具体例は多くありませんが、それでも自分の役割や責任について考えている様子はうかがえます。今後、患者さんや周囲の人の気持ちに目を向けた経験を言葉にできると、思いやりの強みがより伝わりやすくなります。"
    );
  }

  if (analysis.teamworkLevel === "一定に見られる") {
    goodParts.push(
      "チームでの経験についても触れられており、自分の立場だけでなく、周囲との連携を意識して行動している様子が見られます。医療現場や企業では、一人で完結する仕事は少ないため、この視点を持っていることは大きな強みです。"
    );
  }

  const good = goodParts.join("\n\n");

  // --- 改善したいところ（約40%） ---
  const improveParts: string[] = [];

  improveParts.push(
    "一方で、全体を通して見ると、こちらが「もっと詳しく聞きたい」と感じるポイントがいくつかありました。特に、印象に残った経験やエピソードについて、背景・自分の役割・具体的な行動・結果・そこから得た学びの流れが、やや曖昧な箇所があります。"
  );

  if (!analysis.hasChallenge) {
    improveParts.push(
      "挑戦や工夫の場面についての記述が少ないため、「困難な状況に対してどう考え、どのように動いたのか」が伝わりにくくなっています。例えば「忙しかった」「大変だった」という表現にとどまらず、その中で自分なりに工夫したことや、失敗から何を学んだかまで踏み込めると、やる気や主体性がよりはっきりと伝わります。"
    );
  } else {
    improveParts.push(
      "挑戦や工夫に触れている一方で、「なぜその方法を選んだのか」「結果として何が変わったのか」という部分の記述が薄いところがあります。行動の根拠や、前後の変化まで言語化できると、論理性と説得力がさらに増してきます。"
    );
  }

  if (!analysis.hasEmpathy && !analysis.hasPatient) {
    improveParts.push(
      "また、医療系の職種を志望する上では、「患者さんや利用者さんの立場に立って考えた経験」や「相手の不安にどう向き合ったか」といった具体的な場面があると、思いやりの深さを評価しやすくなります。今後は、身近な経験の中からでも構わないので、人の気持ちに寄り添おうとした場面を一つひねり出して言葉にしてみることを意識してみてください。"
    );
  } else {
    improveParts.push(
      "思いやりや配慮の視点は見られますが、相手の表情や言葉の変化、自分がかけた一言など、もう一段具体的に描写できると、あなたの優しさや観察力がより強く伝わります。「その結果、相手がどう変わったか」まで書けると、医療職としての成長イメージがぐっとクリアになります。"
    );
  }

  if (analysis.enthusiasmLevel === "やや弱い") {
    improveParts.push(
      "志望動機については、「なぜ多くの選択肢の中からこの職種・この分野・この働き方を選ぶのか」を、もう一歩深掘りして言葉にしてみることをおすすめします。きっかけとなった出来事、影響を受けた人、印象に残っている場面などを具体的に示すことで、熱意の説得力が大きく変わってきます。"
    );
  }

  const improve = improveParts.join("\n\n");

  // --- 次の一手と励まし（約30%） ---
  const nextParts: string[] = [];

  nextParts.push(
    "今後の一歩としては、まず今回書いた内容をベースに、「面接でそのまま口に出すとどう聞こえるか」を意識しながら、声に出して練習してみてください。その際、文章を丸暗記するのではなく、伝えたいポイントを3つ程度に整理し、順番とキーワードだけを頭に入れて話す練習をすると、自然な熱意が伝わりやすくなります。"
  );

  nextParts.push(
    "あわせて、志望動機・自己PR・学生時代に力を入れたことのそれぞれについて、「具体例をもう一段階くわしく」「相手の視点から見てどう感じるか」の2点を意識して書き足してみると、内容の厚みが一気に増してきます。今回の回答は、すでに土台としての方向性は悪くありません。ここからは、表現を磨き、具体性と説得力を高めていく段階です。"
  );

  nextParts.push(
    "面接練習は、回数を重ねるほど自分の言葉が整理され、熱意や思いやりの伝わり方も変わっていきます。今回の振り返りをきっかけに、少しずつ表現をブラッシュアップしていけば、あなたの強みは必ず相手に届くようになります。焦らず、一歩ずつ積み重ねていきましょう。"
  );

  const next = nextParts.join("\n\n");

  return { good, improve, next };
}
