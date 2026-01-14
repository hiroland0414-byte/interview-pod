// src/lib/impression/voiceMetrics.ts
export type VoiceMetrics = {
  // 0..1
  rmsAvg: number;
  rmsStd: number;
  peakAvg: number;

  // Hz
  pitchHzAvg: number | null;
  pitchHzStd: number | null;

  // 0..1
  clarityAvg: number;
  brightnessAvg: number;
  noisinessAvg: number;

  measuredSec: number;

  // ✅ 追加：推定「発話が乗っていた時間」
  speechSec: number;
  speechRatio: number; // speechSec / measuredSec
};

type Frame = {
  t: number;
  rms: number;
  peak: number;
  pitchHz: number | null;
  clarity: number;
  brightness: number;
  noisiness: number;
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function mean(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function std(nums: number[]) {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  const v = mean(nums.map((x) => (x - m) * (x - m)));
  return Math.sqrt(v);
}

/**
 * WebAudio(AnalyserNode) から取り出せる範囲で、
 * 面接練習用の「声の近似指標」を軽量に推定する。
 */
export class VoiceMetricsAggregator {
  private frames: Frame[] = [];
  private startedAtMs: number | null = null;

  // ✅ 発話時間の推定（連続時間で積算）
  private speechMs = 0;
  private lastSpeechT: number | null = null;

  // 発話判定の簡易しきい値（RMS）
  // ※「無音」でもノイズは乗るので、0.03前後が現実的
  private readonly speechRmsThresh = 0.03;

  start(nowMs: number) {
    this.startedAtMs = nowMs;
    this.frames = [];
    this.speechMs = 0;
    this.lastSpeechT = null;
  }

  push(opts: {
    nowMs: number;
    timeDomain: Uint8Array;
    freqDomain: Uint8Array;
    sampleRate: number;
  }) {
    if (this.startedAtMs == null) this.startedAtMs = opts.nowMs;

    const rms = this.calcRms01(opts.timeDomain);
    const peak = this.calcPeak01(opts.timeDomain);
    const pitchHz = this.estimatePitchHz(opts.timeDomain, opts.sampleRate);
    const { clarity, brightness, noisiness } = this.estimateSpectral(opts.freqDomain);

    this.frames.push({
      t: opts.nowMs,
      rms,
      peak,
      pitchHz,
      clarity,
      brightness,
      noisiness,
    });

    // ✅ 発話時間を積算（連続時間）
    if (rms >= this.speechRmsThresh) {
      if (this.lastSpeechT != null) {
        const dt = opts.nowMs - this.lastSpeechT;
        if (dt > 0 && dt < 200) this.speechMs += dt; // 異常値ガード
      }
      this.lastSpeechT = opts.nowMs;
    } else {
      this.lastSpeechT = null;
    }
  }

  finalize(nowMs: number): VoiceMetrics {
    if (!this.frames.length || this.startedAtMs == null) {
      return {
        rmsAvg: 0,
        rmsStd: 0,
        peakAvg: 0,
        pitchHzAvg: null,
        pitchHzStd: null,
        clarityAvg: 0,
        brightnessAvg: 0,
        noisinessAvg: 0,
        measuredSec: 0,
        speechSec: 0,
        speechRatio: 0,
      };
    }

    const rmsList = this.frames.map((f) => f.rms);
    const peakList = this.frames.map((f) => f.peak);
    const clarityList = this.frames.map((f) => f.clarity);
    const brightList = this.frames.map((f) => f.brightness);
    const noiseList = this.frames.map((f) => f.noisiness);

    const pitchList = this.frames.map((f) => f.pitchHz).filter((x): x is number => x != null);

    const measuredSec = Math.max(0, (nowMs - this.startedAtMs) / 1000);
    const speechSec = Math.max(0, this.speechMs / 1000);
    const speechRatio = measuredSec > 0 ? clamp01(speechSec / measuredSec) : 0;

    return {
      rmsAvg: clamp01(mean(rmsList)),
      rmsStd: clamp01(std(rmsList) * 2.0),
      peakAvg: clamp01(mean(peakList)),
      pitchHzAvg: pitchList.length ? mean(pitchList) : null,
      pitchHzStd: pitchList.length ? std(pitchList) : null,
      clarityAvg: clamp01(mean(clarityList)),
      brightnessAvg: clamp01(mean(brightList)),
      noisinessAvg: clamp01(mean(noiseList)),
      measuredSec,
      speechSec,
      speechRatio,
    };
  }

  /* ----------------- internals ----------------- */

  private calcRms01(u8: Uint8Array) {
    let sum = 0;
    for (let i = 0; i < u8.length; i++) {
      const v = (u8[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / u8.length);
  }

  private calcPeak01(u8: Uint8Array) {
    let p = 0;
    for (let i = 0; i < u8.length; i++) {
      const v = Math.abs((u8[i] - 128) / 128);
      if (v > p) p = v;
    }
    return p;
  }

  private estimatePitchHz(u8: Uint8Array, sampleRate: number): number | null {
    const rms = this.calcRms01(u8);
    if (rms < 0.02) return null;

    const buf = new Float32Array(u8.length);
    for (let i = 0; i < u8.length; i++) buf[i] = (u8[i] - 128) / 128;

    const minHz = 80;
    const maxHz = 320;
    const minLag = Math.floor(sampleRate / maxHz);
    const maxLag = Math.floor(sampleRate / minHz);

    let bestLag = -1;
    let best = 0;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < buf.length - lag; i++) sum += buf[i] * buf[i + lag];
      if (sum > best) {
        best = sum;
        bestLag = lag;
      }
    }

    if (bestLag <= 0) return null;

    const hz = sampleRate / bestLag;
    if (!isFinite(hz)) return null;
    if (hz < 70 || hz > 400) return null;

    return hz;
  }

  private estimateSpectral(freq: Uint8Array) {
    const n = freq.length;
    if (!n) return { clarity: 0, brightness: 0, noisiness: 0 };

    const p = new Float32Array(n);
    let total = 0;
    for (let i = 0; i < n; i++) {
      const v = freq[i] / 255;
      const pv = v * v;
      p[i] = pv;
      total += pv;
    }
    if (total <= 1e-9) return { clarity: 0, brightness: 0, noisiness: 0 };

    const iLow = Math.floor(n * 0.2);
    const iMid = Math.floor(n * 0.55);

    let low = 0,
      mid = 0,
      high = 0;
    for (let i = 0; i < n; i++) {
      if (i < iLow) low += p[i];
      else if (i < iMid) mid += p[i];
      else high += p[i];
    }

    low /= total;
    mid /= total;
    high /= total;

    const brightness = clamp01(high * 1.8);
    const clarity = clamp01((mid - low * 0.4 - high * 0.2) * 2.2 + 0.4);
    const noisiness = clamp01((high * 1.2 + (1 - mid) * 0.4) - 0.2);

    return { clarity, brightness, noisiness };
  }
}
