// src/lib/questions/policy.ts
export type ModeTag = "A1" | "A2" | "B" | "C";
export type Ratio = Record<string, number>;

export type AdditionalPolicy = {
  /** 追加質問の目標件数 */
  total: number;
  /** 目標平均難易度（1〜3） */
  targetDifficulty: number;
  /** タグ比率（合計は自動で total に丸める） */
  tagRatio?: Ratio;
};

export type GlobalPolicy = {
  /** 追加質問の最小・最大（安全弁） */
  minAdditional: number;
  maxAdditional: number;
  /** 同一タグの連続許容（n連続までOK） */
  allowConsecutiveSameTag: number;
  /** 目標平均難易度からの許容ズレ */
  avgDifficultyTolerance: number;
};

export const MODE_POLICY: Record<ModeTag, AdditionalPolicy> = {
  // 放射線技師
  A1: {
    total: 6,
    targetDifficulty: 2.0,
    tagRatio: { "安全": 2, "被ばく": 2, "チーム": 1, "倫理": 1 },
  },
  // 看護師
  A2: {
    total: 6,
    targetDifficulty: 2.0,
    tagRatio: { "患者対応": 2, "連携": 1, "安全": 1, "教育": 1, "判断": 1 },
  },
  // 健診/クリニック
  B: {
    total: 5,
    targetDifficulty: 1.8,
    tagRatio: { "接遇": 2, "効率": 1, "説明": 1, "連携": 1 },
  },
  // 企業（医療関連）
  C: {
    total: 5,
    targetDifficulty: 2.0,
    tagRatio: { "志向": 2, "課題解決": 1, "チーム": 1, "法令": 1, "品質": 1 },
  },
};

export const GLOBAL_POLICY: GlobalPolicy = {
  minAdditional: 3,
  maxAdditional: 8,
  allowConsecutiveSameTag: 2,
  avgDifficultyTolerance: 0.3,
};
