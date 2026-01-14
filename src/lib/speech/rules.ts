// src/lib/speech/rules.ts

export type Rule = {
  re: RegExp;
  /** 置換文字列 or 置換関数（全角→半角などで使用） */
  rep: string | ((match: string, ...args: any[]) => string);
  note?: string;
};

/** 日本語共通：空白・句読点・全角半角などの軽量正規化（録音中でも軽い） */
export const BASIC_RULES_LIGHT: Rule[] = [
  { re: /\u3000/g, rep: " " },                  // 全角空白→半角
  { re: /[ \t]{2,}/g, rep: " " },               // 連続空白→1つ
  { re: /(\S)\s+([。、「」])/g, rep: "$1$2" },  // 句読点直前の空白除去
];

/** 医療特化＆表記統一（停止直後の本格補正で適用） */
export const MEDICAL_RULES_STRICT: Rule[] = [
  // 被ばく系
  { re: /被曝/g, rep: "被ばく" },
  { re: /アラーラ|ALARA/gi, rep: "ALARA" },
  // 画像/装置
  { re: /レントゲン/gi, rep: "X線" },
  { re: /CTスキャン/gi, rep: "CT" },
  // 品質・安全
  { re: /インシデント/gi, rep: "インシデント" },
  { re: /クオリティ(コントロール)?/gi, rep: "品質管理" },
  // 連携
  { re: /ほうれんそう|報連相/gi, rep: "報連相" },
];

/** 数値と単位の整形（半角統一など） */
export const NUM_UNIT_RULES: Rule[] = [
  // 全角数字→半角
  { re: /[０-９]+/g, rep: (m: string) => m.replace(/[０-９]/g, (s) => "０１２３４５６７８９".indexOf(s).toString()) },
  // 単位前の空白除去（mSv / Sv など）
  { re: /\s*(m?Sv)\b/gi, rep: "$1" },
];

/** 末尾に句点が無ければ付与（日本語用） */
export const SENTENCE_END_RULE: Rule = { re: /([^\n。！？])\s*$/u, rep: "$1。" };
