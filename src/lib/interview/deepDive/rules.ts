// src/lib/interview/deepDive/rules.ts
// -------------------------------------------------------------
// 質問タイプ別の “面接官の思考” をルール化。
// テンプレは Tone（厳しめ/優しめ）で言い回しを変える。
// -------------------------------------------------------------

export type QuestionType = "motivation" | "self_pr" | "gakuchika";
export type Tone = "strict" | "gentle";

const T = (tone: Tone, strictText: string, gentleText: string) =>
  tone === "strict" ? strictText : gentleText;

export type Templates = {
  askAction: (tone: Tone) => string;
  askResult: (tone: Tone) => string;
  askNumbers: (tone: Tone) => string;
  askReflection: (tone: Tone) => string;

  // motivation
  askWhyHere: (tone: Tone) => string;
  askFuture: (tone: Tone) => string;

  // gakuchika
  askChallenge: (tone: Tone) => string;
  askIngenuity: (tone: Tone) => string;
  askTransfer: (tone: Tone) => string;

  // self_pr
  askStrengthClear: (tone: Tone) => string;
  askConcrete: (tone: Tone) => string;
  askTransferPR: (tone: Tone) => string;
};

export const RULES: Record<
  QuestionType,
  {
    name: string;
    templates: Templates;
  }
> = {
  motivation: {
    name: "志望動機",
    templates: {
      askAction: (tone) =>
        T(tone, "その志望を裏づけるために、あなたが自分で取った行動は？（調べた/見た/聞いた/試した）", "その志望につながる行動（調べたこと・見学など）はありますか？"),
      askResult: (tone) =>
        T(tone, "その行動で、何が分かって志望がどう固まった？", "その行動で分かったことや、気持ちの変化を教えてください。"),
      askNumbers: (tone) =>
        T(tone, "比較や検討の規模感を数字で言える？（説明会回数・期間など）", "期間や回数など、数字で言える部分があれば教えてください。"),
      askReflection: (tone) =>
        T(tone, "弱点や不安は？それをどう埋める？", "不安な点があれば、どう準備していくかも教えてください。"),
      askWhyHere: (tone) =>
        T(tone, "なぜ「ここ」なのか。決め手を1つに絞って言って。", "応募先を選んだ決め手を1つ、具体的に教えてください。"),
      askFuture: (tone) =>
        T(tone, "入職後、最初の3か月で何をやる？曖昧はNG。", "入職後にまず取り組みたいことを、できるだけ具体的に教えてください。"),
      askChallenge: (tone) => T(tone, "（未使用）", "（未使用）"),
      askIngenuity: (tone) => T(tone, "（未使用）", "（未使用）"),
      askTransfer: (tone) => T(tone, "（未使用）", "（未使用）"),
      askStrengthClear: (tone) => T(tone, "（未使用）", "（未使用）"),
      askConcrete: (tone) => T(tone, "（未使用）", "（未使用）"),
      askTransferPR: (tone) => T(tone, "（未使用）", "（未使用）"),
    },
  },

  self_pr: {
    name: "自己PR",
    templates: {
      askStrengthClear: (tone) =>
        T(tone, "最初に結論。『私の強みは〇〇です』で言って。〇〇は何？", "最初に一言で強みを言うとしたら、『私の強みは〇〇です』の〇〇は何ですか？"),
      askConcrete: (tone) =>
        T(tone, "強みが抽象的。『コミュ力』みたいな言葉で逃げないで、具体的に言い換えて。", "強みをもう少し具体的に言い換えるとどうなりますか？（どんな場面で、何ができる強みか）"),
      askAction: (tone) =>
        T(tone, "で、何をした？行動がないPRは評価できない。具体的に。", "その強みが出た場面で、実際に取った行動を具体的に教えてください。"),
      askResult: (tone) =>
        T(tone, "結果は？周りはどう変わった？", "その行動の結果、どんな変化や成果がありましたか？"),
      askNumbers: (tone) =>
        T(tone, "数字がないと説得力が弱い。人数・回数・期間・頻度で言える？", "規模感が伝わるように、数字で言える部分があれば教えてください。"),
      askReflection: (tone) =>
        T(tone, "弱み/課題は？改善策までセットで。", "改善したい点があれば、どう工夫していくかも教えてください。"),
      askTransferPR: (tone) =>
        T(tone, "仕事で再現できる？応募先の業務に結びつけて言って。", "その強みが応募先の業務でどう活きるか、具体例で教えてください。"),
      askWhyHere: (tone) => T(tone, "（未使用）", "（未使用）"),
      askFuture: (tone) => T(tone, "（未使用）", "（未使用）"),
      askChallenge: (tone) => T(tone, "（未使用）", "（未使用）"),
      askIngenuity: (tone) => T(tone, "（未使用）", "（未使用）"),
      askTransfer: (tone) => T(tone, "（未使用）", "（未使用）"),
    },
  },

  gakuchika: {
    name: "ガクチカ",
    templates: {
      askChallenge: (tone) =>
        T(tone, "何が一番しんどかった？そこで逃げなかった理由は？", "一番大変だった点と、それをどう乗り越えたか教えてください。"),
      askIngenuity: (tone) =>
        T(tone, "工夫が薄い。あなたならではの打ち手は？", "工夫した点（あなたならではの工夫）があれば教えてください。"),
      askTransfer: (tone) =>
        T(tone, "それ、仕事でどう使える？言語化して。", "その経験が仕事でどう活かせるか、具体的に教えてください。"),
      askAction: (tone) =>
        T(tone, "行動の中身を分解して。手順が見えるレベルで言って。", "あなたが取った行動を、順序立てて具体的に教えてください。"),
      askResult: (tone) =>
        T(tone, "結果は？成果が語れないなら評価しづらい。", "結果として、どんな成果や変化がありましたか？"),
      askNumbers: (tone) =>
        T(tone, "数字が出るなら出して。出ないなら理由を言って。", "数字で示せる部分（回数・期間・達成率など）があれば教えてください。"),
      askReflection: (tone) =>
        T(tone, "学びが浅い。次に再現するなら何を変える？", "学んだことと、次に活かす工夫を教えてください。"),
      askWhyHere: (tone) => T(tone, "（未使用）", "（未使用）"),
      askFuture: (tone) => T(tone, "（未使用）", "（未使用）"),
      askStrengthClear: (tone) => T(tone, "（未使用）", "（未使用）"),
      askConcrete: (tone) => T(tone, "（未使用）", "（未使用）"),
      askTransferPR: (tone) => T(tone, "（未使用）", "（未使用）"),
    },
  },
};
