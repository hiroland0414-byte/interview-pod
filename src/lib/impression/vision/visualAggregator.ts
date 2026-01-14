// src/lib/impression/vision/visualAggregator.ts
import type { VisualMetrics } from "@/lib/impression/mediapipe/faceMetrics";

type Sample = {
  tSec: number;
  smile: number;      // 0..1
  eyeOpen: number;    // 0..1
  gazeCenter: number; // 0..1
  faceForward: number;// 0..1
  blink: number;      // 0..1（瞬きの“強さ”）
};

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export class VisualAggregator {
  private durationSec: number;
  private firstWindowSec: number;

  private sumSmile = 0;
  private sumEyeOpen = 0;
  private sumGaze = 0;
  private sumForward = 0;
  private n = 0;

  private sumSmile10 = 0;
  private sumEyeOpen10 = 0;
  private sumGaze10 = 0;
  private n10 = 0;

  private blinkCount = 0;
  private prevBlinkStrong = false;

  constructor(durationSec: number, firstWindowSec = 10) {
    this.durationSec = durationSec;
    this.firstWindowSec = firstWindowSec;
  }

  push(s: Sample) {
    const smile = clamp01(s.smile);
    const eyeOpen = clamp01(s.eyeOpen);
    const gaze = clamp01(s.gazeCenter);
    const forward = clamp01(s.faceForward);
    const blink = clamp01(s.blink);

    this.sumSmile += smile;
    this.sumEyeOpen += eyeOpen;
    this.sumGaze += gaze;
    this.sumForward += forward;
    this.n += 1;

    if (s.tSec <= this.firstWindowSec) {
      this.sumSmile10 += smile;
      this.sumEyeOpen10 += eyeOpen;
      this.sumGaze10 += gaze;
      this.n10 += 1;
    }

    // 瞬きカウント（閾値でエッジ検出）
    const strong = blink > 0.55;
    if (strong && !this.prevBlinkStrong) this.blinkCount += 1;
    this.prevBlinkStrong = strong;
  }

  finish(): VisualMetrics {
    const avg = (sum: number, n: number, fallback = 0.0) =>
      n > 0 ? sum / n : fallback;

    const smileAvg = avg(this.sumSmile, this.n, 0);
    const eyeOpenAvg = avg(this.sumEyeOpen, this.n, 0);
    const gazeAvg = avg(this.sumGaze, this.n, 0);
    const forwardAvg = avg(this.sumForward, this.n, 0);

    const smile10 = avg(this.sumSmile10, this.n10, smileAvg);
    const eye10 = avg(this.sumEyeOpen10, this.n10, eyeOpenAvg);
    const gaze10 = avg(this.sumGaze10, this.n10, gazeAvg);

    const minutes = Math.max(this.durationSec / 60, 0.01);
    const blinkPerMin = this.blinkCount / minutes;

    return {
      smileAvg,
      smileFirst10: smile10,
      eyeOpenAvg,
      eyeOpenFirst10: eye10,
      gazeCenterRatio: gazeAvg,
      gazeFirst10: gaze10,
      faceForwardRatio: forwardAvg,
      blinkPerMin,
    };
  }
}
