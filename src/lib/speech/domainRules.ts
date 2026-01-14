// -------------------------------------------------------------
//  domainRules.ts（完成版）
//  ・誤変換補正（死亡→志望 など）
//  ・貴院（きいん/きーん/きん）強制補正
//  ・句読点：まる → 。 （超軽量版）
//  ・録音中向け：realtimeSafeRules を別定義（誤爆しにくい最小集合）
// -------------------------------------------------------------

export type Rule = {
  find: string;
  replace: string;
  whenBefore?: string[];
  whenAfter?: string[];
  enabled?: boolean;
  note?: string;
};

const LS_KEY = "kcareer.domainRules";

// 文字エスケープ
export function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPattern(r: Rule): RegExp {
  if (r.whenBefore?.length) {
    return new RegExp(
      `${escapeReg(r.find)}(?=\\s*(?:${r.whenBefore.map(escapeReg).join("|")}))`,
      "g"
    );
  }
  if (r.whenAfter?.length) {
    return new RegExp(
      `(?<=${r.whenAfter.map(escapeReg).join("|")})\\s*${escapeReg(r.find)}`,
      "g"
    );
  }
  return new RegExp(escapeReg(r.find), "g");
}

// -------------------------------------------------------------
// 適用
// -------------------------------------------------------------
export function applyDomainRules(text: string, rules: Rule[]): string {
  if (!text || !rules?.length) return text;

  let t = text;

  for (const r of rules) {
    if (r.enabled === false) continue;
    t = t.replace(buildPattern(r), r.replace);
  }

  // 「。。。」→「。」にまとめる
  t = t.replace(/。。+/g, "。");

  return t;
}

// -------------------------------------------------------------
// 保存・読み込み
// -------------------------------------------------------------
export function loadCustomRules(): Rule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? (JSON.parse(raw) as Rule[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveCustomRules(rules: Rule[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rules));
  } catch {}
}

export function mergeRules(base: Rule[], custom: Rule[]): Rule[] {
  const map = new Map<string, Rule>();
  for (const r of base) map.set(r.find, r);
  for (const r of custom) map.set(r.find, r);
  return Array.from(map.values());
}

// -------------------------------------------------------------
// デフォルトの辞書ルール（停止後の本格補正で使う）
// ★ これは消さない（correctStrictFinal が参照する）
// -------------------------------------------------------------
export const defaultRules: Rule[] = [
  // --- 「志望」系 修正 ---
  { find: "死亡動機", replace: "志望動機" },
  { find: "死亡理由", replace: "志望理由" },
  { find: "死亡先", replace: "志望先" },
  { find: "死亡します", replace: "志望します" },
  { find: "死亡いたします", replace: "志望いたします" },
  { find: "死亡", replace: "志望" },

  { find: "しぼうどうき", replace: "志望動機" },
  { find: "しぼうする", replace: "志望する" },
  { find: "しぼうりゆう", replace: "志望理由" },
  { find: "しぼうさき", replace: "志望先" },
  { find: "しぼう", replace: "志望", whenBefore: ["動機", "理由", "先", "校", "大学", "病院"] },

  // ---------------------------------------------------------
  //  貴院：ここを強化！
  // ---------------------------------------------------------
  { find: "きいん", replace: "貴院" },
  { find: "きーん", replace: "貴院" },
  { find: "きん", replace: "貴院" },
  { find: "キーン", replace: "貴院" },
  { find: "金", replace: "貴院" },
  { find: "議員", replace: "貴院" },
  { find: "ギーン", replace: "貴院" },
  { find: "キリン", replace: "貴院", whenBefore: ["を", "に", "へ", "で", "の"] },
  { find: "きりん", replace: "貴院", whenBefore: ["を", "に", "へ", "で", "の"] },
  { find: "キー", replace: "貴院" },
  { find: "キ", replace: "貴院", enabled: false, note: "誤爆が強いので通常はOFF" },
  // Speechが出しがちな揺れ
  { find: "起因", replace: "貴院" },
  { find: "キーイン", replace: "貴院" },
  { find: "き いん", replace: "貴院" },
  { find: "きい ん", replace: "貴院" },
  
  // ---------------------------------------------------------
  // 施設系
  // ---------------------------------------------------------
  { find: "きしせつ", replace: "貴施設", whenBefore: ["に", "で", "へ", "の", "を"] },

  // 医療表記ゆれ
  { find: "MR I", replace: "MRI" },
  { find: "CTD I", replace: "CTDI" },
  { find: "被曝", replace: "被ばく" },

  // 病院グループ
  { find: "せきじゅうじ", replace: "赤十字" },
  { find: "さいせいかい", replace: "済生会" },
  { find: "ろうさい", replace: "労災" },

  // ---------------------------------------------------------
  // 句読点（超軽量）：まる → 。
  // ---------------------------------------------------------
  { find: "まる", replace: "。" },

  // 誤爆防止（まるで/まるごと等は対象外）
  { find: "まるで", replace: "まるで", enabled: false },
  { find: "まるごと", replace: "まるごと", enabled: false },
  { find: "まるっ", replace: "まるっ", enabled: false },
  { find: "まるた", replace: "まるた", enabled: false },
];

// -------------------------------------------------------------
// 録音中（リアルタイム）用：誤爆しにくい最小セット
// ★ correctLightRealtime から参照される
// -------------------------------------------------------------
export const realtimeSafeRules: Rule[] = [
  // 志望系（致命的誤変換だけ）
  { find: "死亡動機", replace: "志望動機" },
  { find: "死亡理由", replace: "志望理由" },
  { find: "死亡先", replace: "志望先" },
  { find: "死亡", replace: "志望" },

  // 貴院（面接で致命的なので救う）
  { find: "キリン", replace: "貴院", whenBefore: ["を", "に", "へ", "で", "の"] },
  { find: "きりん", replace: "貴院", whenBefore: ["を", "に", "へ", "で", "の"] },
  { find: "キー", replace: "貴院" },
  { find: "キ", replace: "貴院", enabled: false, note: "誤爆が強いので通常はOFF" },
  { find: "きいん", replace: "貴院" },
  { find: "きーん", replace: "貴院" },
  { find: "きん", replace: "貴院" },
  { find: "議員", replace: "貴院" },
  { find: "ギーン", replace: "貴院" },
  { find: "起因", replace: "貴院" },
  { find: "キーイン", replace: "貴院" },
  { find: "き いん", replace: "貴院" },
  { find: "きい ん", replace: "貴院" },

  // 句点（超軽量）
  { find: "まる", replace: "。" },
];

// テキストにドメイン辞書をまとめて適用するシンプルヘルパー
export function applyDomain(text: string): string {
  if (!text) return text;

  // 既定ルール + カスタムルールをマージ
  const merged = mergeRules(defaultRules, loadCustomRules());

  // まとめて置換
  return applyDomainRules(text, merged);
}

// -------------------------------------------------------------
if (typeof window !== "undefined") {
  (window as any).kcareerRules = {
    list: () => loadCustomRules(),
    add: (rs: Rule[]) => saveCustomRules([...(loadCustomRules() || []), ...rs]),
    clear: () => saveCustomRules([]),
  };
}
