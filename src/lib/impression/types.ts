export type ImpressionAxisKey =
  | "voiceClarity"
  | "speechRhythm"
  | "expression"
  | "gaze"
  | "stability";

export type ImpressionRadarItem = {
  key: ImpressionAxisKey;
  label: string;
  score: number; // 0-100
  desc: string;  // 1行説明
};

export type ImpressionSnap = {
  startedAt: number;
  endedAt: number;
  durationSec: number;

  // Audio (既存実装で取得している想定：RMSなど)
  rmsAvg?: number;      // 平均RMS (0-1)
  rmsStd?: number;      // RMSの揺れ（リズムのヒント）
  voiceActiveRatio?: number; // 声活動率(0-1) ※内部用（無音“評価”はしないが、スコア算出の成立判定に使える）

  // Face (既存実装で取得している想定：検出率など)
  faceDetectedRatio?: number; // 0-1
  gazeStableRatio?: number;   // 0-1 （なければfaceDetectedRatioで代用）
  motionStability?: number;   // 0-1 （なければ未使用）
};

export type ImpressionResult = {
  isDataInsufficient: boolean;
  radar?: ImpressionRadarItem[];
  feedbackText: string; // 文章フィードバック（あなたの既存生成ロジックに接続してOK）
};
