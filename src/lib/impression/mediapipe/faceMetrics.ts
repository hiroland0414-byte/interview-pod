// src/lib/impression/mediapipe/faceMetrics.ts
/**
 * MediaPipe FaceLandmarker の landmarks(2D) から、
 * “面接の非言語”に必要な最低限メトリクスを壊れにくく推定する。
 *
 * ポイント：
 * - スマイル：口角の横幅 / 口の開き（縦）から “口角が上がっている感” を近似
 * - 目の開き：Eye Aspect Ratio(EAR) の簡易版
 * - 視線：虹彩が取れる場合は iris center を使う。取れない場合は “顔正対” を代理指標に寄せる
 * - 正対：鼻と両目中心の左右対称性で “正面っぽさ” を近似
 * - 瞬き：eyeOpen が閾値を下回った瞬間をカウント（連続は1回扱い）
 */

export type VisualMetrics = {
  smileAvg: number; // 0..1
  smileFirst10: number; // 0..1
  eyeOpenAvg: number; // 0..1
  eyeOpenFirst10: number; // 0..1
  gazeCenterRatio: number; // 0..1
  gazeFirst10: number; // 0..1
  faceForwardRatio: number; // 0..1
  blinkPerMin: number; // 0..60目安
};

type Lm = { x: number; y: number; z?: number };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const dist2 = (a: Lm, b: Lm) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

// ---- landmark indices (FaceMesh / FaceLandmarker)
// ※ 468点が基本。虹彩(iris)が出る場合は 478/480 付近になることがある（環境差あり）。
// 口：左右口角 61,291 / 上唇 13 / 下唇 14
// 目：左目 外端33 内端133 上159 下145 / 右目 外端362 内端263 上386 下374
// 鼻：鼻先 1 / 目の中心は(外端+内端)/2
const IDX = {
  mouthL: 61,
  mouthR: 291,
  mouthTop: 13,
  mouthBot: 14,
  noseTip: 1,

  leftEyeOuter: 33,
  leftEyeInner: 133,
  leftEyeTop: 159,
  leftEyeBot: 145,

  rightEyeOuter: 362,
  rightEyeInner: 263,
  rightEyeTop: 386,
  rightEyeBot: 374,

  // iris は “存在したら使う” 方針（無ければ fallback）
  leftIrisGuess: 468, // 環境により 468..472 あたり
  rightIrisGuess: 473, // 環境により 473..477 あたり
};

function safeGet(lms: Lm[], i: number): Lm | null {
  if (!lms || i < 0 || i >= lms.length) return null;
  const p = lms[i];
  if (!p || typeof p.x !== "number" || typeof p.y !== "number") return null;
  return p;
}

function mid(a: Lm, b: Lm): Lm {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function estimateSmile01(lms: Lm[]): number {
  const L = safeGet(lms, IDX.mouthL);
  const R = safeGet(lms, IDX.mouthR);
  const T = safeGet(lms, IDX.mouthTop);
  const B = safeGet(lms, IDX.mouthBot);
  if (!L || !R || !T || !B) return 0.5;

  const mouthW = dist2(L, R);
  const mouthH = dist2(T, B);

  // 口が開きすぎると smile が誤爆しやすいので、比を丸める
  const ratio = mouthW / Math.max(mouthH, 1e-4);

  // 経験的に ratio 2.2〜3.2あたりで“笑顔っぽさ”が変わる
  const s = (ratio - 2.2) / (3.2 - 2.2);
  return clamp01(s);
}

function eyeOpen01(lms: Lm[], side: "left" | "right"): number {
  const outer = safeGet(lms, side === "left" ? IDX.leftEyeOuter : IDX.rightEyeOuter);
  const inner = safeGet(lms, side === "left" ? IDX.leftEyeInner : IDX.rightEyeInner);
  const top = safeGet(lms, side === "left" ? IDX.leftEyeTop : IDX.rightEyeTop);
  const bot = safeGet(lms, side === "left" ? IDX.leftEyeBot : IDX.rightEyeBot);
  if (!outer || !inner || !top || !bot) return 0.5;

  const w = dist2(outer, inner);
  const h = dist2(top, bot);

  // EARっぽい：h/w（大きいほど目が開いている）
  const ear = h / Math.max(w, 1e-4);

  // ear の生値は 0.15〜0.33くらいを想定（個人差あり）
  const s = (ear - 0.16) / (0.30 - 0.16);
  return clamp01(s);
}

function estimateFaceForward01(lms: Lm[]): number {
  const nose = safeGet(lms, IDX.noseTip);
  const leO = safeGet(lms, IDX.leftEyeOuter);
  const leI = safeGet(lms, IDX.leftEyeInner);
  const reO = safeGet(lms, IDX.rightEyeOuter);
  const reI = safeGet(lms, IDX.rightEyeInner);
  if (!nose || !leO || !leI || !reO || !reI) return 0.5;

  const leC = mid(leO, leI);
  const reC = mid(reO, reI);

  // 鼻が左右の目中心の真ん中に近いほど正対っぽい
  const midEyes = mid(leC, reC);

  const dx = Math.abs(nose.x - midEyes.x);
  // dx 0.00〜0.05 くらいを良いとみなす（カメラ距離で変わるので緩め）
  const s = 1 - clamp01((dx - 0.01) / 0.05);
  return clamp01(s);
}

function estimateGazeCenter01(lms: Lm[]): number {
  // 虹彩が取れるなら iris center を使って “中央に寄っている感” を推定
  const leO = safeGet(lms, IDX.leftEyeOuter);
  const leI = safeGet(lms, IDX.leftEyeInner);
  const reO = safeGet(lms, IDX.rightEyeOuter);
  const reI = safeGet(lms, IDX.rightEyeInner);
  if (!leO || !leI || !reO || !reI) return 0.5;

  const leC = mid(leO, leI);
  const reC = mid(reO, reI);
  const leW = dist2(leO, leI);
  const reW = dist2(reO, reI);

  const li = safeGet(lms, IDX.leftIrisGuess);
  const ri = safeGet(lms, IDX.rightIrisGuess);

  // 虹彩が無い環境も普通にあるので fallback：正対を代理
  if (!li || !ri) {
    const forward = estimateFaceForward01(lms);
    return clamp01(0.45 + forward * 0.55);
  }

  // 眼球中心とのズレ（x方向中心寄りが良い）
  const leDx = Math.abs(li.x - leC.x) / Math.max(leW, 1e-4);
  const reDx = Math.abs(ri.x - reC.x) / Math.max(reW, 1e-4);
  const dx = (leDx + reDx) / 2;

  // dx が小さいほど中央。0.00〜0.12くらいを“良い”とみなす
  const s = 1 - clamp01((dx - 0.02) / 0.14);
  return clamp01(s);
}

export class FaceMetricsAggregator {
  private startedAtMs: number | null = null;
  private first10EndMs: number | null = null;

  private smileAll: number[] = [];
  private eyeAll: number[] = [];
  private gazeAll: number[] = [];
  private forwardAll: number[] = [];

  private smile10: number[] = [];
  private eye10: number[] = [];
  private gaze10: number[] = [];

  private faceSeenMs = 0;
  private lastFaceT: number | null = null;

  private blinkCount = 0;
  private blinkArmed = true;

  start(nowMs: number) {
    this.startedAtMs = nowMs;
    this.first10EndMs = nowMs + 10_000;

    this.smileAll = [];
    this.eyeAll = [];
    this.gazeAll = [];
    this.forwardAll = [];

    this.smile10 = [];
    this.eye10 = [];
    this.gaze10 = [];

    this.faceSeenMs = 0;
    this.lastFaceT = null;

    this.blinkCount = 0;
    this.blinkArmed = true;
  }

  push(nowMs: number, landmarks: Lm[]) {
    if (this.startedAtMs == null) this.start(nowMs);

    // faceSeenMs（連続時間で積算）
    if (this.lastFaceT != null) {
      const dt = nowMs - this.lastFaceT;
      if (dt > 0 && dt < 200) this.faceSeenMs += dt;
    }
    this.lastFaceT = nowMs;

    const smile = estimateSmile01(landmarks);
    const eyeL = eyeOpen01(landmarks, "left");
    const eyeR = eyeOpen01(landmarks, "right");
    const eye = clamp01((eyeL + eyeR) / 2);

    const gaze = estimateGazeCenter01(landmarks);
    const forward = estimateFaceForward01(landmarks);

    this.smileAll.push(smile);
    this.eyeAll.push(eye);
    this.gazeAll.push(gaze);
    this.forwardAll.push(forward);

    if (this.first10EndMs != null && nowMs <= this.first10EndMs) {
      this.smile10.push(smile);
      this.eye10.push(eye);
      this.gaze10.push(gaze);
    }

    // blink（eye が低い→高い を 1回とカウント）
    const blinkLow = eye < 0.20;
    const blinkHigh = eye > 0.28;
    if (this.blinkArmed && blinkLow) {
      this.blinkArmed = false;
      this.blinkCount += 1;
    } else if (!this.blinkArmed && blinkHigh) {
      this.blinkArmed = true;
    }
  }

  finalize(nowMs: number): { visual: VisualMetrics; faceSec: number } {
    const durationSec =
      this.startedAtMs != null ? Math.max(0, (nowMs - this.startedAtMs) / 1000) : 0;

    const smileAvg = clamp01(avg(this.smileAll) || 0.5);
    const eyeOpenAvg = clamp01(avg(this.eyeAll) || 0.5);
    const gazeCenterRatio = clamp01(avg(this.gazeAll) || 0.5);
    const faceForwardRatio = clamp01(avg(this.forwardAll) || 0.5);

    const smileFirst10 = clamp01(avg(this.smile10) || smileAvg);
    const eyeOpenFirst10 = clamp01(avg(this.eye10) || eyeOpenAvg);
    const gazeFirst10 = clamp01(avg(this.gaze10) || gazeCenterRatio);

    const faceSec = Math.max(0, this.faceSeenMs / 1000);
    const blinkPerMin = durationSec > 0 ? (this.blinkCount / durationSec) * 60 : 0;

    return {
      visual: {
        smileAvg,
        smileFirst10,
        eyeOpenAvg,
        eyeOpenFirst10,
        gazeCenterRatio,
        gazeFirst10,
        faceForwardRatio,
        blinkPerMin,
      },
      faceSec,
    };
  }
}
