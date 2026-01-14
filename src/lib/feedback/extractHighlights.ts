// -------------------------------------------------------------
//  extractHighlights.ts
//  回答文から「引用」や「強調すべき部分」を抽出する
//  ・良い引用
//  ・改善点として引用する部分
//  ・各セクション（志望動機／自己PR／学チカ）ごとに抽出
// -------------------------------------------------------------

export type Highlight = {
  quote: string;      // 抽出した引用文
  category: string;   // motivation/selfPr/gakuchika
  type: "good" | "bad";
};

export function extractHighlights(
  answers: { questionText: string; answerText: string }[]
): Highlight[] {
  const result: Highlight[] = [];

  for (const ans of answers) {
    const text = ans.answerText.trim();
    if (!text) continue;

    const category = classify(ans.questionText);

    // ---- 良い引用候補（good） ----
    const goodCandidates = text.match(
      /(取り組|努力|継続|成長|改善|工夫|関わ|貢献|学ん|意識|配慮)[^。]{5,20}。?/g
    );

    if (goodCandidates) {
      for (const q of goodCandidates.slice(0, 2)) {
        result.push({
          quote: q.replace(/。$/, ""),
          category,
          type: "good",
        });
      }
    }

    // ---- 改善引用候補（bad） ----
    const badCandidates = text.match(
      /(課題|不足|弱み|できなかった|失敗|反省)[^。]{5,20}。?/g
    );

    if (badCandidates) {
      for (const q of badCandidates.slice(0, 2)) {
        result.push({
          quote: q.replace(/。$/, ""),
          category,
          type: "bad",
        });
      }
    }

    // ---- テキストが短い場合は「先頭部分を引用」して改善材料にする ----
    if (text.length < 80) {
      result.push({
        quote: text.slice(0, 30),
        category,
        type: "bad",
      });
    }
  }

  return result;
}

// -------------------------------------------------------------
// 質問文をカテゴリ分類（志望動機／自己PR／学チカ）
// -------------------------------------------------------------
function classify(q: string): "motivation" | "selfPr" | "gakuchika" {
  if (q.includes("志望")) return "motivation";
  if (q.includes("PR") || q.includes("ＰＲ")) return "selfPr";
  return "gakuchika";
}
