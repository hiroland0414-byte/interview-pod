// src/lib/speech/guard.ts
export type GuardFinding = { start: number; end: number; label: "privacy"|"offense"; word: string };

const PRIVACY_RE = /(住所|電話|メール|LINE|個人情報|マイナンバー)/g;
const OFFENSE_RE = /(バカ|死ね|クソ|差別的表現)/g;

export function scanInappropriate(text: string): GuardFinding[] {
  const out: GuardFinding[] = [];
  const run = (re: RegExp, label: GuardFinding["label"]) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, label, word: m[0] });
  };
  run(PRIVACY_RE, "privacy");
  run(OFFENSE_RE, "offense");
  return out;
}
