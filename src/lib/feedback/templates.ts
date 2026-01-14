// src/lib/feedback/templates.ts
import type { ModeTag } from "@/lib/questions";

/* =========================
 * 面接官ペルソナ定義
 * ========================= */

export const PERSONA_BY_MODE: Record<
  ModeTag,
  Array<{
    title: string;
    voice: string;
    strictness: "low" | "mid" | "high";
    angle: string;
  }>
> = {
  A1: [
    {
      title: "放射線技師長",
      voice: "現場の安全と再現性を第一に見る立場",
      strictness: "high",
      angle: "患者安全・確認行為・チーム連携",
    },
    {
      title: "病院長",
      voice: "医療人としての姿勢と将来性を見る立場",
      strictness: "mid",
      angle: "使命感・説明力・信頼性",
    },
  ],

  A2: [
    {
      title: "看護師長",
      voice: "報連相と現場対応力を重視する立場",
      strictness: "high",
      angle: "チームワーク・観察力・配慮",
    },
    {
      title: "病院長",
      voice: "患者満足と人柄を見る立場",
      strictness: "mid",
      angle: "接遇・安心感・継続力",
    },
  ],

  /* ====== ★ここが今回の主役 ====== */
  B: [
    {
      title: "健診センター責任者",
      voice: "回転・正確性・クレーム耐性を重視する立場",
      strictness: "high",
      angle: "段取り・説明力・確認行為",
    },
    {
      title: "運営責任者",
      voice: "受診者満足と安定運用を見る立場",
      strictness: "mid",
      angle: "安心感・再現性・チーム連携",
    },
  ],

  C: [
    {
      title: "人事責任者",
      voice: "再現性と成長性を見る立場",
      strictness: "mid",
      angle: "主体性・論理性・再現性",
    },
    {
      title: "部長クラス",
      voice: "組織への影響力を見る立場",
      strictness: "high",
      angle: "挑戦・巻き込み・実行力",
    },
  ],
};

/* =========================
 * 評価観点（FOCUS）
 * ========================= */

export const FOCUS: Record<
  ModeTag,
  Array<{
    key: string;
    whatToSee: string;
    whatToHit: string;
    howToEncourage: string;
  }>
> = {
  A1: [
    {
      key: "熱意",
      whatToSee: "施設理解に基づく志望理由",
      whatToHit: "志望理由が一般論に留まっている",
      howToEncourage: "見学で見た具体場面を言語化してほしい",
    },
    {
      key: "チームワーク",
      whatToSee: "報連相や連携への意識",
      whatToHit: "個人作業の話に終始している",
      howToEncourage: "誰とどう連携したかを補足しよう",
    },
    {
      key: "思いやり",
      whatToSee: "患者不安への配慮",
      whatToHit: "技術視点に偏っている",
      howToEncourage: "説明・声かけの工夫を入れてみよう",
    },
  ],

  A2: [
    {
      key: "思いやり",
      whatToSee: "患者の状態を汲み取る姿勢",
      whatToHit: "行動が抽象的",
      howToEncourage: "具体的な看護場面を思い出そう",
    },
    {
      key: "チームワーク",
      whatToSee: "報連相の意識",
      whatToHit: "個人完結の話が多い",
      howToEncourage: "チームの中での役割を明確にしよう",
    },
  ],

  /* ====== ★健診特化FOCUS ====== */
  B: [
    {
      key: "正確性",
      whatToSee: "確認行為・ミス防止への意識",
      whatToHit: "スピード重視で安全への言及がない",
      howToEncourage: "確認手順を言葉にしてみよう",
    },
    {
      key: "段取り",
      whatToSee: "回転を意識した行動設計",
      whatToHit: "個別対応の話に終始している",
      howToEncourage: "全体の流れを意識した説明を加えよう",
    },
    {
      key: "説明力",
      whatToSee: "受診者に安心感を与える説明",
      whatToHit: "専門用語に頼りすぎている",
      howToEncourage: "相手目線の言い換えを意識しよう",
    },
    {
      key: "チームワーク",
      whatToSee: "受付・他職種との連携意識",
      whatToHit: "自分の業務範囲に閉じている",
      howToEncourage: "前後工程との関係性を語ってみよう",
    },
  ],

  C: [
    {
      key: "主体性",
      whatToSee: "自ら動いた経験",
      whatToHit: "指示待ちに見える",
      howToEncourage: "自分の意思決定を強調しよう",
    },
    {
      key: "挑戦",
      whatToSee: "困難への向き合い方",
      whatToHit: "成功談だけで終わっている",
      howToEncourage: "失敗からの学びを補足しよう",
    },
    {
      key: "チームワーク",
      whatToSee: "他者を巻き込む力",
      whatToHit: "個人成果に偏っている",
      howToEncourage: "周囲への影響を語ろう",
    },
  ],
};
