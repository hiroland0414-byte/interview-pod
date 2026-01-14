// src/lib/speech/terms_facility.ts
export function facilityTermsFromSummary(summary: string): string[] {
  // 理念・方針の要約から固有語を抽出（2〜4文字の名詞を粗く拾う）
  const nouns = (summary || "").match(/[一-龥ぁ-んァ-ンA-Za-z0-9]{2,}/g) ?? [];
  // 汎用語を除外してユニーク化（本番はStopWordを増やす）
  const stop = new Set(["患者","地域","医療","安全","安心","提供","連携","質","向上"]);
  const uniq = Array.from(new Set(nouns.filter(w => !stop.has(w))));
  return uniq.slice(0, 30);
}
