// src/lib/facilities/loader.ts

// モード種別
export type ModeKey = "A1" | "A2" | "B" | "C";

// 施設情報の共通型
export type Facility = {
  name: string;
  prefecture?: string;
  city?: string;
  raw?: any;
};

// 都道府県一覧
const PREFS = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
];

// 表示優先順位：京都→滋賀→大阪→兵庫→和歌山→その他道府県コード順
const PREF_RANK: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  const head = ["京都府", "滋賀県", "大阪府", "兵庫県", "和歌山県"];
  let rank = 1;

  for (const p of head) {
    map[p] = rank++;
  }

  for (let i = 0; i < PREFS.length; i++) {
    const p = PREFS[i];
    if (map[p] != null) continue;
    map[p] = 10 + i; // 10〜
  }

  return map;
})();

// 全角→半角、空白除去、小文字化
export function normalize(text: string): string {
  return (text || "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xfee0),
    )
    .replace(/\s+/g, "")
    .toLowerCase();
}

// テキストから都道府県名らしきものをざっくり検出
export function detectPrefectureFromText(
  text: string | undefined,
): string | undefined {
  if (!text) return undefined;
  for (const pref of PREFS) {
    if (text.includes(pref)) return pref;
  }
  return undefined;
}

function getPrefRank(pref?: string): number {
  if (!pref) return 9999;
  const hit = PREFS.find((p) => pref.includes(p));
  const key = hit ?? pref;
  const r = PREF_RANK[key];
  return typeof r === "number" ? r : 9000;
}

// 健診・企業など CSV 施設リストのソート（都道府県優先→名称）
export function sortFacilities(list: Facility[]): Facility[] {
  return [...list].sort((a, b) => {
    const ra = getPrefRank(a.prefecture);
    const rb = getPrefRank(b.prefecture);
    if (ra !== rb) return ra - rb;
    return (a.name || "").localeCompare(b.name || "", "ja");
  });
}

// CSV 施設リストの曖昧検索＋ソート
export function filterFacilitiesByQuery(
  list: Facility[],
  query: string,
): Facility[] {
  const q = normalize(query);
  if (!q) return sortFacilities(list);
  return sortFacilities(
    list.filter((f) => normalize(f.name).includes(q)),
  );
}
