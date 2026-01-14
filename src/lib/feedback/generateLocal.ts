// src/lib/feedback/generateLocal.ts
"use client";

import type { ModeTag } from "@/lib/questions";

/** sessionStorage に入れてる回答の形（今の実装に合わせる） */
export type SavedAnswer = {
  questionText: string;
  answerText: string;
  kind?: string;
  section?: string;
  depthLevel?: number;
};

export type BundleType = "motivation" | "self_pr" | "gakuchika" | "additional";

/** bundleSimple 側と互換にする（main/deepDives が SavedAnswer でも string でもOK） */
export type AnswerBundle = {
  type: BundleType;
  main?: SavedAnswer | string;
  deepDives?: Array<SavedAnswer | string>;
};

export type BundledAnswers = {
  motivation: AnswerBundle;
  self_pr: AnswerBundle;
  gakuchika: AnswerBundle;
  additional?: AnswerBundle;
};

export type FeedbackItem = {
  title: string; // 見出し（例：志望動機）
  body: string; // 本文
};

/** 文字列化（SavedAnswerでもstringでもOKにする） */
function textOf(v?: SavedAnswer | string): string {
  if (!v) return "";
  if (typeof v === "string") return v.trim();
  return (v.answerText || "").trim();
}

function joinDeepDives(arr?: Array<SavedAnswer | string>) {
  const xs = (arr || []).map(textOf).filter(Boolean);
  return xs.join("\n");
}

// ------------------------------
// テンプレ（B 追加済・A1/A2/C も “責任者っぽい厳しさ” 強化）
// ------------------------------
const PERSONA_BY_MODE: Record<ModeTag, string> = {
  A1: "【放射線技師長／病院長（やや厳しめ、ただし励ます）】",
  A2: "【看護師長／病院長（厳しめ、ただし励ます）】",
  B: "【健診センター責任者／事務長（現場目線で厳しめ、ただし励ます）】",
  C: "【人事責任者／部長クラス（厳しめ、ただし励ます）】",
};

const FOCUS_BY_MODE: Record<ModeTag, string[]> = {
  A1: ["熱意", "チームワーク", "患者への思いやり・配慮"],
  A2: ["熱意", "報連相", "チームワーク", "患者への思いやり・配慮"],
  B: ["熱意", "受診者への配慮", "正確さ・スピードの両立", "報連相", "チームワーク"],
  C: ["熱意", "挑戦する気持ち", "チームワーク", "主体的経験（学チカ）"],
};

function labelOf(type: BundleType) {
  if (type === "motivation") return "志望動機（本体＋深掘り）";
  if (type === "self_pr") return "自己PR（本体＋深掘り）";
  if (type === "gakuchika") return "学チカ（本体＋深掘り）";
  return "追加質問";
}

/**
 * modeごとの“厳しめ＆励まし”の骨格を生成
 * - 文字数の厳密カウントはしない（UI側で担保）
 * - 重要観点が回答中に見えない場合は「不足」として指摘する（要件）
 * - ただし未回答（空）は upstream で保存されない運用なので、ここでは「何かしら回答あり」想定
 */
function buildBody(mode: ModeTag, type: BundleType, main: string, deep: string): string {
  const persona = PERSONA_BY_MODE[mode];
  const focus = FOCUS_BY_MODE[mode];

    // --- 良かったところ（モード別） ---
  const goodPoint =
    mode === "A1"
      ? "あなたの回答から、「検査を回す人」ではなく「患者さんを診る放射線技師」であろうとする姿勢は伝わってきます。特に、患者さんの不安や安全に目を向けようとしている点は、現場責任者として評価できます。あとは、その思いを具体的な行動（声かけ・説明・確認）として語れるようになると、即戦力としてのイメージがより明確になります。\n"
      : mode === "A2"
      ? "あなたの回答からは、患者さんに誠実に向き合おうとする姿勢が感じられます。看護の現場では、その姿勢そのものが大切であり、評価すべき点です。今後は、それをチームの中でどう共有し、どう動くかまで言葉にできると、看護師としての完成度が一段上がります。\n"
      : mode === "B"
      ? "あなたの回答からは、健診の現場を単なる作業ではなく、受診者対応の積み重ねとして捉えようとしている点が読み取れます。特に、安心感や配慮を意識している点は、健診センターの責任者として評価できます。あとは、限られた時間の中で正確さをどう担保するかまで踏み込めると、現場で任せられる人材像がより明確になります。\n"
      : "あなたの回答からは、経験を前向きに捉え、学びに変えようとする姿勢が伝わります。特に、自分なりに意味づけを行っている点は評価できます。企業の立場からは、その経験が入社後にどう再現されるのかまで語れると、成長イメージがより具体的になります。\n";

  const combinedRaw = `${main}\n${deep}`.trim();
  const hasSome = combinedRaw.replace(/\s/g, "").length > 0;

  const focusLine = focus.map((x) => `・${x}`).join("\n");

  // “観点が回答に含まれない場合は不足評価”のための軽い判定（キーワードベース）
  // ※将来：同義語辞書を増やすと精度UP
  const combined = combinedRaw.toLowerCase();

  const lacks: string[] = [];
  for (const f of focus) {
    // ざっくり分岐（過剰に厳しくしすぎない）
    if (f === "熱意") {
      if (!combined.match(/したい|志望|貢献|学びたい|挑戦|成長|取り組|関わ/)) {
        lacks.push("熱意（志望理由・貢献の言語化）");
      }
      continue;
    }

    if (f.includes("チーム")) {
      if (!combined.match(/チーム|協力|連携|報連相|共有|相談|引き継/)) lacks.push(f);
      continue;
    }

    if (f.includes("報連相")) {
      if (!combined.match(/報連相|報告|連絡|相談|共有|エスカレーション/)) lacks.push(f);
      continue;
    }

    if (f.includes("思いやり") || f.includes("配慮")) {
      if (!combined.match(/配慮|思いやり|安心|不安|寄り添|説明|声かけ|傾聴/)) lacks.push(f);
      continue;
    }

    if (f.includes("受診者")) {
      if (!combined.match(/受診者|説明|不安|安心|待ち時間|導線|プライバシ|接遇/)) lacks.push(f);
      continue;
    }

    if (f.includes("正確") || f.includes("スピード")) {
      if (!combined.match(/正確|ミス|確認|ダブルチェック|迅速|スピード|時間|手順/)) lacks.push(f);
      continue;
    }

    if (f.includes("挑戦")) {
      if (!combined.match(/挑戦|改善|工夫|新しい|やりき|継続|乗り越/)) lacks.push(f);
      continue;
    }

    if (f.includes("主体")) {
      if (!combined.match(/主体|自分で|自発|提案|工夫|改善|巻き込/)) lacks.push(f);
      continue;
    }

    // デフォルト（単語が含まれない場合だけ不足扱い）
    const key = f.toLowerCase().replace(/・|／|\(|\)|（|）/g, "");
    if (key && !combined.includes(key)) lacks.push(f);
  }

  const lacksText =
    lacks.length > 0
      ? `\n【不足している点（重要）】\n${lacks.map((x) => `・${x}`).join("\n")}\n`
      : "";

  // ✅ モード別「責任者っぽい厳しさ」コメント（ここが今回の主役）
const modeStrictLine =
  mode === "A1"
    ? "病院は“人の体に触れる仕事”です。安全と信頼が最優先。\n"
      + "あなたの回答から意欲は見える一方で、「患者さんにどう安心を作るか」「説明や声かけをどうするか」「ミスをどう防ぐか」の手順がまだ薄い。\n"
      + "見学で感じたことを“感想”で止めず、観察→理由→自分の行動（貢献）まで落として語ってください。そこが採用の分かれ目です。\n"
  : mode === "A2"
    ? "看護はチームで回ります。独りで頑張る人より、“報連相で崩れない人”を残します。\n"
      + "患者さんへの思いは大事ですが、それだけでは現場は回らない。急変・転倒・クレームの芽は、情報共有の遅れから起きます。\n"
      + "あなたが「いつ」「誰に」「何を」「どう伝えるか」を具体例で言えるようにしてください。ここが弱いと、安心して任せられません。\n"
  : mode === "B"
    ? "健診の現場は“正確さ”と“スピード”の両方が同時に求められます。\n"
      + "流れ作業になった瞬間に、ミス・クレーム・信頼低下が起こるのが健診です。\n"
      + "だからこそ、あなた自身が「どこで確認し、どこで声をかけ、どこで報告するか」を自分の言葉で説明できる必要があります。\n"
  : mode === "C"
    ? "企業は再現性で見ます。“頑張りました”では評価できない。\n"
      + "目的→工夫→数字/成果→学び→次にどう活かす、までを一本の線で話してください。\n"
      + "加えて、チームの中であなたが担った役割（意思決定・調整・実行）を明確に。そこが曖昧だと、入社後に伸びるイメージが湧きません。\n"
  : "";

  return (
    `${persona}\n` +
    `【評価対象】${labelOf(type)}\n` +
    `【このモードで特に見たい観点】\n${focusLine}\n\n` +
   `【良かったところ】\n` +
(hasSome ? goodPoint : "現時点の回答だけでは、面接官があなたを採用した後の姿を具体的に描きにくいです。\n") +

    `\n【厳しめ指摘（改善点）】\n` +
    `結論→根拠→具体例→貢献、の順で整理してください。「なぜそれを言えるのか」を1つでも具体に落とすだけで説得力が跳ね上がります。\n` +
    modeStrictLine +
    lacksText +
    `\n【次の一手（励まし）】\n` +
    `あなたの素材はあります。あとは「場面」を1つ決めて、そこでの行動と言葉を具体化するだけです。次回は“見学で印象に残った場面”か“学内実習で工夫した場面”を1つ選び、30秒で話せる形にして持ってきてください。ちゃんと伸びます。`
  );
}

/** public API */
export function generateFeedbackLocal(
  mode: ModeTag,
  bundles: AnswerBundle[] | BundledAnswers
): FeedbackItem[] {
  const list: AnswerBundle[] = Array.isArray(bundles)
    ? bundles
    : [bundles.motivation, bundles.self_pr, bundles.gakuchika].filter(Boolean);

  const items: FeedbackItem[] = list.map((b) => {
    const main = textOf(b.main);
    const deep = joinDeepDives(b.deepDives);
    const body = buildBody(mode, b.type, main, deep);

    return {
      title: labelOf(b.type),
      body,
    };
  });

  return items;
}
