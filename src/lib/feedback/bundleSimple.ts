// src/lib/feedback/bundleSimple.ts
"use client";

import type { ModeTag } from "@/lib/questions";
import type { SavedAnswer, AnswerBundle, BundledAnswers, BundleType } from "@/lib/feedback/generateLocal";

/**
 * sessionStorage の answers（配列）を、
 * 志望動機 / 自己PR / 学チカ / 追加 に束ねる。
 *
 * ポイント：
 * - kind / section / depthLevel が入っていればそれを最優先で判定
 * - ない場合のみ questionText から “ゆるく推定”
 * - undefined 安全（out.additional が無い問題を消す）
 */

type SavedAnswerLike = SavedAnswer;

// 文字列から空白除去して比較しやすく
const compact = (s: string) => (s || "").replace(/\s+/g, "").trim();

function safeStr(v: unknown) {
  return v == null ? "" : String(v);
}

function isNonEmptyAnswer(a: SavedAnswerLike | null | undefined) {
  if (!a) return false;
  return compact(a.answerText ?? "").length > 0;
}

function ensureBundle(type: BundleType): AnswerBundle {
  return { type, main: undefined, deepDives: [] };
}

/** section から 3大タイプ推定（kind/sectionが無い古いデータ用の保険） */
function inferTypeFromSection(section?: string): BundleType | null {
  const s = safeStr(section).toLowerCase();
  if (s.includes("motivation")) return "motivation";
  if (s.includes("self") || s.includes("pr")) return "self_pr";
  if (s.includes("gaku") || s.includes("challenge")) return "gakuchika";
  return null;
}

/** questionText から雑に推定（最後の保険） */
function inferTypeFromQuestionText(questionText: string): BundleType | null {
  const t = compact(questionText).toLowerCase();

  // 志望動機っぽい
  if (t.includes("志望") || t.includes("動機") || t.includes("なぜ") || t.includes("理由")) {
    return "motivation";
  }

  // 自己PRっぽい
  if (t.includes("自己pr") || t.includes("自己ｐｒ") || t.includes("長所") || t.includes("強み")) {
    return "self_pr";
  }

  // 学チカっぽい
  if (t.includes("学生") || t.includes("学チカ") || t.includes("力を入れた") || t.includes("取り組んだ")) {
    return "gakuchika";
  }

  return null;
}

/**
 * 回答が「三大本体」か「深掘り」か「追加」かを判断して束ねる
 * - kind: "additional" は追加
 * - kind: "core" かつ depthLevel=0 は三大本体（typeはsectionで判定）
 * - depthLevel>0 は深掘り（typeはsection or questionTextで判定）
 */
function classifyAnswer(a: SavedAnswerLike): { type: BundleType; role: "main" | "deep" | "additional" } | null {
  const kind = safeStr(a.kind).toLowerCase();
  const depth = typeof a.depthLevel === "number" ? a.depthLevel : undefined;

  // 追加
  if (kind === "additional") {
    return { type: "additional", role: "additional" };
  }

  // section優先で type 推定
  const bySection = inferTypeFromSection(a.section);
  const byText = inferTypeFromQuestionText(a.questionText);
  const type = bySection || byText;

  if (!type) return null;

  // 三大本体
  if (kind === "core" && (depth ?? 0) === 0) {
    return { type, role: "main" };
  }

  // 深掘り（depthLevel>0 ならほぼ深掘り扱い）
  if ((depth ?? 0) > 0) {
    return { type, role: "deep" };
  }

  // kindがcoreDepth等でも深掘り扱いに倒す
  if (kind.includes("depth")) {
    return { type, role: "deep" };
  }

  // それ以外（古いデータ）は “main”寄りに置く（崩れにくい）
  return { type, role: "main" };
}

/**
 * public: bundleAnswersSimple
 * - qa は sessionStorage から読み込んだ配列をそのまま入れる想定
 * - mode は現状必須じゃないが、将来ここで mode別の並べ替え等をする余地がある
 */
export function bundleAnswersSimple(
  qa: SavedAnswerLike[],
  _mode?: ModeTag
): AnswerBundle[] {
  const out: BundledAnswers = {
    motivation: ensureBundle("motivation"),
    self_pr: ensureBundle("self_pr"),
    gakuchika: ensureBundle("gakuchika"),
    additional: ensureBundle("additional"),
  };

  for (const a of qa || []) {
    if (!a) continue;

    // 「未回答は触れない」仕様：空は束ねない
    if (!isNonEmptyAnswer(a)) continue;

    const c = classifyAnswer(a);
    if (!c) continue;

    if (c.type === "additional") {
      // additional は main に積む（複数あるので deepDives に積んでもOKだが、ここは読みやすさ優先）
      const b = out.additional!;
      if (!b.main) b.main = a;
      else {
        if (!b.deepDives) b.deepDives = [];
        b.deepDives.push(a);
      }
      continue;
    }

    const target = out[c.type];

    if (c.role === "main") {
      // main がまだなら main へ。すでにあるなら deepDives へ（複数mainが来た場合の保険）
      if (!target.main) target.main = a;
      else {
        if (!target.deepDives) target.deepDives = [];
        target.deepDives.push(a);
      }
    } else {
      if (!target.deepDives) target.deepDives = [];
      target.deepDives.push(a);
    }
  }

  // 返す順番を固定：三大（志望→自己PR→学チカ）＋追加（存在する場合のみ）
  const result: AnswerBundle[] = [];

  result.push(out.motivation);
  result.push(out.self_pr);
  result.push(out.gakuchika);

  // additional は回答がある時だけ返す（未回答は触れない方針）
  const add = out.additional;
  const hasAdd =
    !!add &&
    (isNonEmptyAnswer(typeof add.main === "string" ? { questionText: "", answerText: add.main } : (add.main as any)) ||
      (add.deepDives?.some((x) => {
        const a = typeof x === "string" ? { questionText: "", answerText: x } : x;
        return compact(a.answerText).length > 0;
      }) ?? false));

  if (hasAdd) result.push(add!);

  // ただし三大が全く無いケースでも配列を返す（UI側で空扱い可能）
  return result;
}
