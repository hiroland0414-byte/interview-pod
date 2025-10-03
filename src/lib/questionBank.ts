export type BankItem = {
  id: string;
  text: string;
  tags?: string[];
  triggers?: string[];
  followups?: string[];
  weight?: number;
};

// localStorage からロード
export function loadBank(): BankItem[] {
  try {
    const raw = localStorage.getItem('interview.questionbank');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is BankItem => x && typeof x.id === 'string' && typeof x.text === 'string');
  } catch {
    return [];
  }
}

// 正規化（日本語はそのまま、英数は小文字、全角→半角）
function normalize(s: string): string {
  if (!s) return '';
  const toHalf = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  );
  return toHalf.toLowerCase();
}

// トリガーマッチのスコア
function scoreByTriggers(answer: string, item: BankItem): number {
  if (!item?.triggers?.length) return 0;
  const a = normalize(answer);
  let hit = 0;
  for (const t of item.triggers) {
    const tt = normalize(t);
    if (a.includes(tt)) hit += 1;
  }
  const w = typeof item.weight === 'number' ? item.weight : 1;
  return hit * w;
}

// ★ここを必ず export
export function pickNextFromBank(
  answer: string,
  bank: BankItem[],
  opts?: {
    excludeIds?: Set<string>;
    diversityTags?: string[];
    minScore?: number;
  }
): { item?: BankItem; reason: string } {
  if (!bank?.length) return { reason: 'bank-empty' };
  const exclude = opts?.excludeIds ?? new Set<string>();
  const minScore = typeof opts?.minScore === 'number' ? opts!.minScore : 0.5;

  const scored = bank
    .filter((b) => !exclude.has(b.id))
    .map((b) => ({ b, s: scoreByTriggers(answer, b) }))
    .filter((x) => x.s > 0);

  if (!scored.length) return { reason: 'no-trigger-match' };

  scored.sort((x, y) => y.s - x.s);
  const best = scored[0];

  if (best.s >= minScore) {
    return { item: best.b, reason: `matched score=${best.s.toFixed(2)}` };
  } else {
    return { reason: `score-too-low(${best.s.toFixed(2)} < ${minScore})` };
  }
}
