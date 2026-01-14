export type CanonTag =
  | "安全" | "被ばく" | "品質" | "連携" | "倫理" | "患者対応" | "改善" | "迅速性"
  | "接遇" | "効率" | "説明" | "観察" | "判断" | "チーム"
  | "志向" | "課題解決" | "法令" | "顧客" | "学習" | "事業理解";

const ALIASES: Array<[RegExp, CanonTag]> = [
  // A1
  [/alara|線量最適化|被曝|再撮影/i, "被ばく"],
  [/安全文化|インシデント|リスク/i, "安全"],
  [/画質|qc|qa|再現性/i, "品質"],
  [/多職種|報連相|申し送り|チーム/i, "連携"],
  [/倫理|説明責任|インフォームド/i, "倫理"],
  [/患者中心|配慮|安心感/i, "患者対応"],
  [/カイゼン|改善|標準化|振り返り/i, "改善"],
  [/迅速|スループット|待ち時間/i, "迅速性"],

  // A2/B
  [/傾聴|共感|安心感/i, "患者対応"],
  [/情報共有|多職種|チーム医療/i, "連携"],
  [/転倒|医療安全|kyt/i, "安全"],
  [/説明|アサーティブ|案内/i, "説明"],
  [/観察|兆候|バイタル/i, "観察"],
  [/判断|優先度|トリアージ/i, "判断"],
  [/接遇|第一印象|身だしなみ/i, "接遇"],
  [/効率|導線|待ち時間/i, "効率"],

  // C
  [/志向|医工連携|社会貢献/i, "志向"],
  [/課題|仮説検証|提案/i, "課題解決"],
  [/巻き込み|越境|他部署/i, "チーム"],
  [/薬機|個人情報|法令|コンプラ/i, "法令"],
  [/品質|qa|安全性|有効性/i, "品質"],
  [/顧客|cs|ユーザー/i, "顧客"],
  [/学び|情報収集|リスキル/i, "学習"],
  [/事業|収益|kpi|ビジネス/i, "事業理解"],
];

export function normalizeTag(raw: string): CanonTag | null {
  const s = (raw || "").replace(/\s+/g, "");
  if (!s) return null;
  for (const [re, canon] of ALIASES) {
    if (re.test(s)) return canon;
  }
  // 既に正準語が来る可能性もある
  const canonSet = new Set<CanonTag>([
    "安全","被ばく","品質","連携","倫理","患者対応","改善","迅速性",
    "接遇","効率","説明","観察","判断","チーム",
    "志向","課題解決","法令","顧客","学習","事業理解",
  ]);
  return (canonSet.has(s as any) ? (s as CanonTag) : null);
}

/** CSVの tags（カンマ区切り等）を正規化し、重複を除去 */
export function normalizeTagsCell(cell: string): CanonTag[] {
  const items = (cell || "")
    .split(/[,\u3001\/;；、]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const out: CanonTag[] = [];
  for (const it of items) {
    const n = normalizeTag(it);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}
