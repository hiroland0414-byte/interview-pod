// src/lib/feedback/quality.ts

export type FeedbackQuality = {
  ok: boolean;
  issues: string[];
  length: number;
};

const RE_EVIDENCE = /(あなたが|回答で|述べていた|語っていた|深掘り|質問に対して)/;
const RE_STRICT = /(一方で|ただし|不安|弱い|不足|曖昧|伝わりにく|懸念)/;
const RE_NEXT = /(次回|次に|意識して|一つに絞|具体的に|整理して|してみてください|して下さい)/;

export function checkFeedbackQuality(text: string): FeedbackQuality {
  const t = (text ?? "").trim();
  const len = countJPChars(t);

  const issues: string[] = [];
  if (len < 500 || len > 750) issues.push(`文字数が想定外です（現在：約${len}字、目安：600±150）`);
  if (!RE_EVIDENCE.test(t)) issues.push("回答内容を根拠として言及している痕跡が弱いです");
  if (!RE_STRICT.test(t)) issues.push("厳しめの指摘（不足・懸念）が明確ではありません");
  if (!RE_NEXT.test(t)) issues.push("次の一手（具体改善）が読み取れません");

  return { ok: issues.length === 0, issues, length: len };
}

function countJPChars(s: string) {
  return (s || "").replace(/\s/g, "").length;
}
