// src/lib/speech/correct.ts
import {
  BASIC_RULES_LIGHT,
  MEDICAL_RULES_STRICT,
  NUM_UNIT_RULES,
  SENTENCE_END_RULE,
} from "./rules";
import { facilityTermsFromSummary } from "./terms_facility";
import * as DR from "./domainRules";

function applyRules(
  s: string,
  rules: { re: RegExp; rep: string | ((...a: any[]) => string) }[]
) {
  let out = s;
  for (const r of rules) {
    out = out.replace(r.re, typeof r.rep === "function" ? (r.rep as any) : r.rep);
  }
  return out;
}

/** 録音中：軽整形＋リアルタイム安全ルールのみ */
export function correctLightRealtime(s: string): string {
  let out = applyRules(s, BASIC_RULES_LIGHT);

  // ✅ realtimeSafeRules が存在する前提（domainRules.ts に追加済み）
  out = DR.applyDomainRules(out, DR.realtimeSafeRules);

  return out;
}

/** 停止直後：本格補正にドメイン辞書を注入 */
export function correctStrictFinal(
  s: string,
  facilitySummary?: string
): { text: string; termsInjected: string[] } {
  let out = s.trim();

  out = applyRules(out, BASIC_RULES_LIGHT);
  out = applyRules(out, MEDICAL_RULES_STRICT);
  out = applyRules(out, NUM_UNIT_RULES);

  // ✅ ここは defaultRules（本格補正）+ カスタム をマージして適用
  const domainRules = DR.mergeRules(DR.defaultRules, DR.loadCustomRules());
  out = DR.applyDomainRules(out, domainRules);

  // 句点付与
  out = out.replace(SENTENCE_END_RULE.re, SENTENCE_END_RULE.rep as string);

  // 将来拡張用：施設要約から固有語注入（今はno-opで返すだけ）
  const extra = facilitySummary ? facilityTermsFromSummary(facilitySummary) : [];
  return { text: out, termsInjected: extra };
}
